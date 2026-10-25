package jobs

import (
	"context"
	"database/sql"
	"errors"

	"github.com/rs/zerolog/log"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/registration"
)

type emailDataRegistration struct {
	To        string
	FirstName string
	Link      string
}

// rotation stores a new token hash, restoring the old state if the
// send fails.
type rotation struct {
	orderID  []byte
	failures int64 // failed sends in a row before this one
	// mark stores hash, resets failures and reports the rows matched;
	// 0 means the row no longer qualifies.
	mark func(
		ctx context.Context,
		q *database.Queries,
		hash sql.NullString,
	) (int64, error)
	undo func(
		ctx context.Context,
		q *database.Queries,
		hash sql.NullString,
		failures int64,
	) error
	send func(ctx context.Context, link string) error
}

func rotateAndEmail(ctx context.Context, d deps, r rotation) error {
	token, hash, err := registration.NewToken()
	if err != nil {
		return err
	}

	q := database.New(d.DB())
	sent := sql.NullString{String: hash, Valid: true}

	updated, err := r.mark(ctx, q, sent)
	if err != nil {
		return err
	}

	if updated == 0 {
		return nil
	}

	sendErr := r.send(ctx, d.Cfg().Email.Link+"/registrations/"+token)
	if sendErr == nil {
		return nil
	}

	// The send may have used up the job's budget; the undo still
	// needs to run.
	undoCtx, cancel := d.Cfg().
		MdCtx(context.WithoutCancel(ctx))
	defer cancel()

	failures := r.failures + 1
	if err := r.undo(undoCtx, q, sent, failures); err != nil {
		return errors.Join(sendErr, err)
	}

	if failures >= int64(d.Cfg().Jobs.MaxEmailAttempts) {
		log.Error().
			Str("order", api.UUIDString(r.orderID)).
			Int64("attempts", failures).
			Msg("gave up emailing this order; " +
				"check the email provider and the registrant's email")
	}

	return sendErr
}

func sendDraftReminderEmail(
	ctx context.Context,
	deps api.MailDeps,
	data emailDataRegistration,
) error {
	return api.SendRegistrationEmail(ctx, deps, draftReminderContent(data))
}

func draftReminderContent(data emailDataRegistration) api.EmailContent {
	return api.EmailContent{
		To:      data.To,
		Subject: "Termina tu inscripción",
		Name:    data.FirstName,
		Intros: []string{
			"Empezaste una inscripción y aún no la has terminado.",
			"Tu enlace vence en 24 horas más. " +
				"Ignora este correo si ya terminaste tu inscripción.",
		},
		ActionText: "Continuar mi inscripción",
		Link:       data.Link,
		Table:      nil,
		QRPNG:      nil,
	}
}

func sendPaymentReminderEmail(
	ctx context.Context,
	deps api.MailDeps,
	data emailDataRegistration,
	balance string,
) error {
	return api.SendRegistrationEmail(
		ctx,
		deps,
		paymentReminderContent(data, balance),
	)
}

func paymentReminderContent(
	data emailDataRegistration,
	balance string,
) api.EmailContent {
	return api.EmailContent{
		To:      data.To,
		Subject: "Recordatorio de pago",
		Name:    data.FirstName,
		Intros: []string{
			"Tu inscripción tiene un saldo pendiente de " + balance + ".",
			"Ignora este correo si ya realizaste el pago.",
		},
		ActionText: "Ver mi inscripción",
		Link:       data.Link,
		Table:      nil,
		QRPNG:      nil,
	}
}
