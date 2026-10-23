package registration

import (
	"context"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"dwb-courses/internal/database"
	"dwb-courses/internal/qr"
)

type confirmationKind int

const (
	confirmationRegistered confirmationKind = iota
	confirmationPaid
)

func (kind confirmationKind) failureMessage() string {
	if kind == confirmationPaid {
		return "could not send payment confirmation email"
	}

	return "could not send registration confirmation email"
}

// emailRegistered emails the confirmation of a registration; token is empty for
// registrations made by staff, which have no public page.
func (s server) emailRegistered(
	c fiber.Ctx,
	sub database.Submission,
	orderID uuid.UUID,
	token string,
) {
	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	logger := s.Logger(c).With().Str("order", orderID.String()).Logger()

	s.emailConfirmation(
		ctx, &logger, sub, orderID, token, confirmationRegistered,
	)
}

// emailConfirmation sends the confirmation; a failure is only logged because
// the registration or payment is already stored. The logger carries the order
// id.
func (s server) emailConfirmation(
	ctx context.Context,
	logger *zerolog.Logger,
	sub database.Submission,
	orderID uuid.UUID,
	token string,
	kind confirmationKind,
) {
	link := registrantQRPageURL(s.Cfg(), token)

	if err := s.sendConfirmation(ctx, sub, orderID, link, kind); err != nil {
		logger.Error().Err(err).Msg(kind.failureMessage())
	}
}

// sendConfirmation emails the registrant the order summary and the QR code;
// link may be empty (no token).
func (s server) sendConfirmation(
	ctx context.Context,
	sub database.Submission,
	orderID uuid.UUID,
	link string,
	kind confirmationKind,
) error {
	cart, err := loadCart(
		ctx,
		database.New(s.DB()),
		orderID[:],
	)
	if err != nil {
		return err
	}

	image, err := qr.Render(staffRegistrationURL(s.Cfg(), orderID.String()))
	if err != nil {
		return err
	}

	return sendRegistrationConfirmedEmail(s, emailDataRegistrationConfirmation{
		To:           sub.Email,
		FirstName:    sub.FirstName,
		Link:         link,
		CurrencyCode: cart.CurrencyCode,
		Lines:        summaryLines(cart),
		TotalCents:   cart.TotalCents,
		QRPNG:        image,
		Paid:         kind == confirmationPaid,
		Free: kind == confirmationRegistered &&
			cart.Status == statusPaid,
	})
}

func summaryLines(cart cartResponse) []summaryLine {
	lines := make(
		[]summaryLine,
		0,
		len(cart.Sessions)+len(cart.Meals)+len(cart.Discounts)+1,
	)

	for _, line := range cart.Sessions {
		lines = append(
			lines,
			summaryLine{
				Name:        line.Name,
				AmountCents: line.AmountCents,
				Discount:    false,
			},
		)
	}

	for _, line := range cart.Meals {
		lines = append(
			lines,
			summaryLine{
				Name:        line.Name,
				AmountCents: line.AmountCents,
				Discount:    false,
			},
		)
	}

	if cart.DonationCents > 0 {
		lines = append(
			lines,
			summaryLine{
				Name:        "Donación",
				AmountCents: cart.DonationCents,
				Discount:    false,
			},
		)
	}

	for _, line := range cart.Discounts {
		lines = append(
			lines,
			summaryLine{
				Name:        line.Name,
				AmountCents: line.AmountCents,
				Discount:    true,
			},
		)
	}

	return lines
}
