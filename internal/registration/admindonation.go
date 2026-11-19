package registration

import (
	"context"

	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/validate"
)

type donationRequest struct {
	validate.IDPath

	DonationCents int64 `json:"donationCents" validate:"min=0,max=100000000"`
}

// AdminEditDonation replaces the order's donation; zero removes it.
func (s server) AdminEditDonation(c fiber.Ctx) error {
	var body donationRequest
	if err := c.Bind().All(&body); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	return s.editOrder(
		c,
		body.ID,
		func(ctx context.Context, q *database.Queries, order database.GetOrderByIdRow) error {
			return s.editDonation(ctx, q, order, body.DonationCents)
		},
	)
}

func (s server) editDonation(
	ctx context.Context,
	q *database.Queries,
	order database.GetOrderByIdRow,
	cents int64,
) error {
	_, form, err := loadSubmissionAndForm(ctx, q, order)
	if err != nil {
		return err
	}

	if err := q.ClearOrderDonationItem(ctx, order.ID); err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	if cents > 0 {
		maxCents := s.Cfg().Registration.MaxDonationCents

		err := addDonation(ctx, q, form, order.ID, cents, maxCents)
		if err != nil {
			return err
		}
	}

	_, err = refreshStatus(ctx, q, order.ID)

	return err
}
