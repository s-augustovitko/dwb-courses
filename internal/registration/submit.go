package registration

import (
	"context"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"dwb-courses/internal/api"
	"dwb-courses/internal/config"
	"dwb-courses/internal/database"
)

type submitResponse struct {
	OrderID string `json:"orderId"`
	QRURL   string `json:"qrUrl"`
}

func staffRegistrationURL(cfg *config.Config, orderID string) string {
	return cfg.Email.Link + cfg.Templates.AdminPath + "/registrations/" + orderID
}

func registrantQRPageURL(cfg *config.Config, token string) string {
	if token == "" {
		return ""
	}

	return cfg.Email.Link + "/registrations/" + token + "/qr"
}

// Submit confirms a draft as a pay-in-person registration.
func (s server) Submit(c fiber.Ctx) error {
	var params TokenPath
	if err := c.Bind().URI(&params); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	release, err := s.lockByToken(c, params.Token)
	if err != nil {
		return err
	}
	defer release()

	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	var (
		orderID uuid.UUID
		sub     database.Submission
	)

	err = api.WithTx(ctx, s, s.Logger(c), func(q *database.Queries) error {
		var err error

		sub, orderID, err = confirmDraft(
			ctx,
			q,
			params.Token,
		)

		return err
	})
	if err != nil {
		return err
	}

	s.emailRegistered(c, sub, orderID, params.Token)

	return api.Success(
		c,
		submitResponse{
			OrderID: orderID.String(),
			QRURL:   staffRegistrationURL(s.Cfg(), orderID.String()),
		},
	)
}

func confirmDraft(
	ctx context.Context,
	q *database.Queries,
	token string,
) (database.Submission, uuid.UUID, error) {
	row, err := orderByToken(ctx, q, token)
	if err != nil {
		return database.Submission{}, uuid.UUID{}, err
	}

	if err := requireDraft(
		row.Status,
		row.PaymentPendingAt,
	); err != nil {
		return database.Submission{}, uuid.UUID{}, err
	}

	sub, form, err := loadSubmissionAndVisibleForm(ctx, q, row)
	if err != nil {
		return database.Submission{}, uuid.UUID{}, err
	}

	if err := requireSelection(ctx, q, form, sub.ID); err != nil {
		return database.Submission{}, uuid.UUID{}, err
	}

	if err := q.SetOrderPending(ctx, row.ID); err != nil {
		return database.Submission{}, uuid.UUID{}, api.Error(
			api.ErrorTypeFromSQL(err),
			err,
		)
	}

	if _, err := refreshStatus(ctx, q, row.ID); err != nil {
		return database.Submission{}, uuid.UUID{}, err
	}

	return sub, api.UUIDFromBytes(row.ID), nil
}
