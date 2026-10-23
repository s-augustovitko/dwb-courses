package registration

import (
	"bytes"
	"context"
	"errors"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/validate"
)

var errDiscountNotManual = errors.New(
	"not an active OTHER discount of the form",
)

type addDiscountRequest struct {
	validate.IDPath

	DiscountID  uuid.UUID `json:"discountId"  validate:"required"`
	AmountCents *int64    `json:"amountCents" validate:"omitempty,min=1,max=100000000"`
}

type discountLinePath struct {
	validate.IDPath

	LineID uuid.UUID `uri:"lineId" validate:"required"`
}

// AdminAddDiscount adds an OTHER discount of the form to the registration,
// optionally overriding its amount.
func (s server) AdminAddDiscount(c fiber.Ctx) error {
	var body addDiscountRequest
	if err := c.Bind().All(&body); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	return s.editOrder(
		c,
		body.ID,
		func(ctx context.Context, q *database.Queries, order database.GetOrderByIdRow) error {
			return addManualDiscount(ctx, q, order, body)
		},
	)
}

func addManualDiscount(
	ctx context.Context,
	q *database.Queries,
	order database.GetOrderByIdRow,
	body addDiscountRequest,
) error {
	sub, err := loadSubmission(ctx, q, order)
	if err != nil {
		return err
	}

	discount, err := q.GetDiscountById(ctx, body.DiscountID[:])
	if err != nil {
		return clientReferenceError(err)
	}

	if !bytes.Equal(discount.FormID, sub.FormID) || !discount.IsActive ||
		discount.DiscountType != discountTypeOther {
		return api.Error(api.ErrorTypeBadRequest, errDiscountNotManual)
	}

	amount, err := discountAmount(
		ctx,
		q,
		discount.ID,
		order.CurrencyCode,
		body.AmountCents,
	)
	if err != nil {
		return err
	}

	if err := addDiscountLine(
		ctx,
		q,
		order.ID,
		discount.ID,
		discount.Name,
		amount,
	); err != nil {
		return err
	}

	if err := requireDiscountsWithinItems(ctx, q, order.ID); err != nil {
		return err
	}

	_, err = refreshStatus(ctx, q, order.ID)

	return err
}

func discountAmount(
	ctx context.Context,
	q *database.Queries,
	discountID []byte,
	currencyCode string,
	override *int64,
) (int64, error) {
	if override != nil {
		return *override, nil
	}

	price, err := q.GetDiscountPrice(ctx, database.GetDiscountPriceParams{
		DiscountID: discountID, CurrencyCode: currencyCode,
	})
	if err != nil {
		return 0, clientReferenceError(err)
	}

	return price.AmountCents, nil
}

// AdminRemoveDiscount removes a manual discount line; automatic ones follow the
// selection instead.
func (s server) AdminRemoveDiscount(c fiber.Ctx) error {
	var params discountLinePath
	if err := c.Bind().URI(&params); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	return s.editOrder(
		c,
		params.ID,
		func(ctx context.Context, q *database.Queries, order database.GetOrderByIdRow) error {
			if err := removeManualDiscount(
				ctx,
				q,
				order.ID,
				params.LineID,
			); err != nil {
				return err
			}

			_, err := refreshStatus(ctx, q, order.ID)

			return err
		},
	)
}

func removeManualDiscount(
	ctx context.Context,
	q *database.Queries,
	orderID []byte,
	lineID uuid.UUID,
) error {
	lines, err := q.ListOrderDiscountLines(ctx, orderID)
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	for _, line := range lines {
		if !bytes.Equal(line.ID, lineID[:]) {
			continue
		}

		if line.DiscountType != discountTypeOther {
			return api.Error(api.ErrorTypeConflict, nil)
		}

		if err := q.DeleteOrderDiscountItem(ctx, line.ID); err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}

		return nil
	}

	return api.Error(api.ErrorTypeNotFound, nil)
}
