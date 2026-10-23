package registration

import (
	"bytes"
	"context"
	"errors"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
)

type priceOverride struct {
	ItemID     uuid.UUID `json:"itemId"     validate:"required"`
	PriceCents *int64    `json:"priceCents" validate:"required,min=0,max=100000000"`
}

var errOverrideNotAdded = errors.New(
	"price override for an item the request does not add",
)

type adminCreateRequest struct {
	registrationCore

	Overrides []priceOverride `json:"overrides" validate:"max=200,unique=ItemID,dive"`
}

// AdminCreate registers someone from the admin (PENDING, or PAID when free),
// without a public token, and emails the registrant.
func (s server) AdminCreate(c fiber.Ctx) error {
	var body adminCreateRequest
	if err := c.Bind().Body(&body); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	form, held, err := s.prepareWithLock(c, &body.registrationCore)
	if err != nil {
		return err
	}
	defer held.release()

	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	var (
		view    staffResponse
		sub     database.Submission
		orderID uuid.UUID
	)

	err = api.WithTx(ctx, s, s.Logger(c), func(q *database.Queries) error {
		var err error

		sub, orderID, err = s.createPending(ctx, q, form, body, held.orderID)
		if err != nil {
			return err
		}

		view, err = staffView(ctx, q, orderID[:])

		return err
	})
	if err != nil {
		return err
	}

	s.emailRegistered(c, sub, orderID, "")

	return api.Success(c, view)
}

func (s server) createPending(
	ctx context.Context,
	q *database.Queries,
	form database.Form,
	body adminCreateRequest,
	lockedOrderID []byte,
) (database.Submission, uuid.UUID, error) {
	err := replaceDraft(ctx, q, body.key(), lockedOrderID, anyEmail)
	if err != nil {
		return database.Submission{}, uuid.UUID{}, err
	}

	sub, order, err := startRegistration(
		ctx, q, form, body.registrationCore,
		func(orderID, submissionID []byte) error {
			_, err := q.CreateOrder(ctx, database.CreateOrderParams{
				ID:           orderID,
				SubmissionID: submissionID,
				CurrencyCode: body.CurrencyCode,
			})

			return err
		},
	)
	if err != nil {
		return database.Submission{}, uuid.UUID{}, err
	}

	if err := s.priceOrder(ctx, q, form, sub, order, body); err != nil {
		return database.Submission{}, uuid.UUID{}, err
	}

	sub, err = q.GetSubmissionById(ctx, sub.ID)
	if err != nil {
		return database.Submission{}, uuid.UUID{}, api.Error(
			api.ErrorTypeFromSQL(err), err)
	}

	return sub, api.UUIDFromBytes(order.id), nil
}

func (s server) priceOrder(
	ctx context.Context,
	q *database.Queries,
	form database.Form,
	sub database.Submission,
	order orderRef,
	body adminCreateRequest,
) error {
	err := s.applySelection(ctx, q, form, sub, order, body.SelectionFields)
	if err != nil {
		return err
	}

	if err := applyOverrides(ctx, q, order.id, body.Overrides); err != nil {
		return err
	}

	if err := syncAutomaticDiscounts(ctx, q, form, sub, order); err != nil {
		return err
	}

	_, err = refreshStatus(ctx, q, order.id)

	return err
}

func applyOverrides(
	ctx context.Context,
	q *database.Queries,
	orderID []byte,
	overrides []priceOverride,
) error {
	if len(overrides) == 0 {
		return nil
	}

	sessions, sessionsErr := q.ListOrderSessionItems(ctx, orderID)
	meals, mealsErr := q.ListOrderMealItems(ctx, orderID)

	if err := sqlFailure(sessionsErr, mealsErr); err != nil {
		return err
	}

	for _, override := range overrides {
		if err := applyOverride(ctx, q, sessions, meals, override); err != nil {
			return err
		}
	}

	return nil
}

func applyOverride(
	ctx context.Context,
	q *database.Queries,
	sessions []database.OrderSessionItem,
	meals []database.OrderMealItem,
	override priceOverride,
) error {
	for _, item := range sessions {
		if bytes.Equal(item.SessionID, override.ItemID[:]) {
			_, err := q.UpdateOrderSessionItem(
				ctx,
				database.UpdateOrderSessionItemParams{
					NameSnapshot:   item.NameSnapshot,
					UnitPriceCents: *override.PriceCents,
					ID:             item.ID,
				},
			)
			if err != nil {
				return api.Error(api.ErrorTypeFromSQL(err), err)
			}

			return nil
		}
	}

	for _, item := range meals {
		if bytes.Equal(item.MealID, override.ItemID[:]) {
			_, err := q.UpdateOrderMealItem(
				ctx,
				database.UpdateOrderMealItemParams{
					NameSnapshot:   item.NameSnapshot,
					UnitPriceCents: *override.PriceCents,
					ID:             item.ID,
				},
			)
			if err != nil {
				return api.Error(api.ErrorTypeFromSQL(err), err)
			}

			return nil
		}
	}

	return api.Error(api.ErrorTypeBadRequest, errOverrideNotAdded)
}
