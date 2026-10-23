package registration

import (
	"github.com/matcornic/hermes/v2"

	"dwb-courses/internal/api"
)

type summaryLine struct {
	Name        string
	AmountCents int64
	Discount    bool
}

type emailDataRegistrationConfirmation struct {
	To        string
	FirstName string
	Link      string

	CurrencyCode string
	Lines        []summaryLine
	TotalCents   int64
	QRPNG        []byte
	Paid         bool
	// Free is a registration with nothing to pay.
	Free bool
}

func sendRegistrationConfirmedEmail(
	deps api.MailDeps,
	data emailDataRegistrationConfirmation,
) error {
	return api.SendRegistrationEmail(deps, registrationConfirmedContent(data))
}

func registrationConfirmedContent(
	data emailDataRegistrationConfirmation,
) api.EmailContent {
	subject := "Tu inscripción fue registrada"
	intro := "Tu inscripción fue registrada. Presenta este código QR al pagar en persona."

	switch {
	case data.Paid:
		subject = "Recibimos tu pago"
		intro = "Recibimos tu pago. Presenta este código QR para validar tu inscripción."
	case data.Free:
		intro = "Tu inscripción fue registrada. Presenta este código QR para validar tu inscripción."
	}

	return api.EmailContent{
		To:         data.To,
		Subject:    subject,
		Name:       data.FirstName,
		Intros:     []string{intro, api.QRMarker},
		Table:      summaryTable(data),
		ActionText: "Ver mi código QR en la web",
		Link:       data.Link,
		QRPNG:      data.QRPNG,
	}
}

func summaryTable(data emailDataRegistrationConfirmation) [][]hermes.Entry {
	rows := make([][]hermes.Entry, 0, len(data.Lines)+1)

	for _, line := range data.Lines {
		amount := api.FormatCents(line.AmountCents, data.CurrencyCode)
		if line.Discount {
			amount = "- " + amount
		}

		rows = append(rows, []hermes.Entry{
			{Key: api.NameColumn, Value: line.Name},
			{Key: api.AmountColumn, Value: amount},
		})
	}

	return append(rows, []hermes.Entry{
		{Key: api.NameColumn, Value: "Total"},
		{
			Key:   api.AmountColumn,
			Value: api.FormatCents(data.TotalCents, data.CurrencyCode),
		},
	})
}
