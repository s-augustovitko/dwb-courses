package registration

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
)

// Discount types as stored in discounts.discount_type; only OTHER is applied by
// staff.
const (
	discountTypeOther         = "OTHER"
	discountTypeMealsIncluded = "MEALS_INCLUDED"
)

var errDiscountsExceedItems = errors.New(
	"discounts exceed the sessions and meals subtotal",
)

func isAutomatic(discountType string) bool {
	return discountType != discountTypeOther
}

type qualification struct {
	allSessions bool
	hasMeals    bool
}

func (q qualification) allowsDiscountType(discountType string) bool {
	return q.allSessions &&
		(discountType != discountTypeMealsIncluded || q.hasMeals)
}

// syncAutomaticDiscounts keeps automatic lines while every session is selected
// (a granted early bird survives late edits), drops them otherwise and adds
// newly eligible ones. OTHER lines are never touched.
func syncAutomaticDiscounts(
	ctx context.Context,
	q *database.Queries,
	form database.Form,
	sub database.Submission,
	order orderRef,
) error {
	lines, err := q.ListOrderDiscountLines(ctx, order.id)
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	qualifies, err := selectionQualifies(ctx, q, form, sub.ID)
	if err != nil {
		return err
	}

	kept := make(map[uuid.UUID]bool, len(lines))

	for _, line := range lines {
		if !isAutomatic(line.DiscountType) {
			continue
		}

		if err := reconcileLine(
			ctx,
			q,
			order.id,
			line,
			qualifies,
			kept,
		); err != nil {
			return err
		}
	}

	if err := addEligibleDiscounts(ctx, q, form, sub, order, kept); err != nil {
		return err
	}

	if err := capAutomaticDiscounts(ctx, q, order.id); err != nil {
		return err
	}

	return requireDiscountsWithinItems(ctx, q, order.id)
}

func reconcileLine(
	ctx context.Context,
	q *database.Queries,
	orderID []byte,
	line database.ListOrderDiscountLinesRow,
	qualifies qualification,
	kept map[uuid.UUID]bool,
) error {
	if !qualifies.allowsDiscountType(line.DiscountType) {
		if err := q.DeleteOrderDiscountItem(ctx, line.ID); err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}

		return nil
	}

	kept[api.UUIDFromBytes(line.DiscountID)] = true

	if line.DiscountType != discountTypeMealsIncluded {
		return nil
	}

	mealsTotal, err := mealSnapshotsTotal(ctx, q, orderID)
	if err != nil {
		return err
	}

	return setDiscountAmount(ctx, q, line, mealsTotal)
}

func setDiscountAmount(
	ctx context.Context,
	q *database.Queries,
	line database.ListOrderDiscountLinesRow,
	amount int64,
) error {
	if amount == line.AmountCents {
		return nil
	}

	_, err := q.UpdateOrderDiscountItem(
		ctx,
		database.UpdateOrderDiscountItemParams{
			NameSnapshot: line.NameSnapshot, AmountCents: amount, ID: line.ID,
		},
	)
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	return nil
}

func selectionQualifies(
	ctx context.Context,
	q *database.Queries,
	form database.Form,
	submissionID []byte,
) (qualification, error) {
	selected, meals, err := submissionItemCounts(ctx, q, submissionID)
	if err != nil {
		return qualification{}, err
	}

	unselected, err := q.CountUnselectedActiveSessions(
		ctx,
		database.CountUnselectedActiveSessionsParams{
			FormID: form.ID, SubmissionID: submissionID,
		},
	)
	if err != nil {
		return qualification{}, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	// Sessions deactivated after the registration still count as selected.
	return qualification{
		allSessions: selected > 0 && unselected == 0,
		hasMeals:    meals > 0,
	}, nil
}

func mealSnapshotsTotal(
	ctx context.Context,
	q *database.Queries,
	orderID []byte,
) (int64, error) {
	meals, err := q.ListOrderMealItems(ctx, orderID)
	if err != nil {
		return 0, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	var total int64
	for _, meal := range meals {
		total += meal.UnitPriceCents
	}

	return total, nil
}

func itemsSubtotal(
	ctx context.Context,
	q *database.Queries,
	orderID []byte,
) (int64, error) {
	sessions, err := q.ListOrderSessionItems(ctx, orderID)
	if err != nil {
		return 0, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	total, err := mealSnapshotsTotal(ctx, q, orderID)
	if err != nil {
		return 0, err
	}

	for _, session := range sessions {
		total += session.UnitPriceCents
	}

	return total, nil
}

func addEligibleDiscounts(
	ctx context.Context,
	q *database.Queries,
	form database.Form,
	sub database.Submission,
	order orderRef,
	kept map[uuid.UUID]bool,
) error {
	eligible, err := q.ListEligibleDiscountsForSubmission(
		ctx,
		database.ListEligibleDiscountsForSubmissionParams{
			FormID: form.ID, SubmissionID: sub.ID, CurrencyCode: order.currency,
		},
	)
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	for _, discount := range eligible {
		if kept[api.UUIDFromBytes(discount.ID)] ||
			!isAutomatic(discount.DiscountType) {
			continue
		}

		amount := discount.AmountCents
		if discount.DiscountType == discountTypeMealsIncluded {
			if amount, err = mealSnapshotsTotal(ctx, q, order.id); err != nil {
				return err
			}
		}

		err := addDiscountLine(
			ctx,
			q,
			order.id,
			discount.ID,
			discount.Name,
			amount,
		)
		if err != nil {
			return err
		}
	}

	return nil
}

func addDiscountLine(
	ctx context.Context,
	q *database.Queries,
	orderID, discountID []byte,
	name string,
	amount int64,
) error {
	id, err := uuid.NewV7()
	if err != nil {
		return api.Error(api.ErrorTypeUnexpected, err)
	}

	_, err = q.CreateOrderDiscountItem(
		ctx,
		database.CreateOrderDiscountItemParams{
			ID:           id[:],
			OrderID:      orderID,
			DiscountID:   discountID,
			NameSnapshot: name,
			AmountCents:  amount,
		},
	)
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	return nil
}

// capAutomaticDiscounts lowers automatic lines in order so that, with the
// manual ones, they never exceed
// sessions+meals (never the donation); a capped line stays capped.
func capAutomaticDiscounts(
	ctx context.Context,
	q *database.Queries,
	orderID []byte,
) error {
	remaining, err := itemsSubtotal(ctx, q, orderID)
	if err != nil {
		return err
	}

	lines, err := q.ListOrderDiscountLines(ctx, orderID)
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	for _, line := range lines {
		if !isAutomatic(line.DiscountType) {
			remaining -= line.AmountCents
		}
	}

	remaining = max(remaining, 0)

	for _, line := range lines {
		if !isAutomatic(line.DiscountType) {
			continue
		}

		amount := min(line.AmountCents, remaining)
		remaining -= amount

		if err := setDiscountAmount(ctx, q, line, amount); err != nil {
			return err
		}
	}

	return nil
}

// requireDiscountsWithinItems rejects manual discounts that would reach into
// the donation or below zero.
func requireDiscountsWithinItems(
	ctx context.Context,
	q *database.Queries,
	orderID []byte,
) error {
	subtotal, err := itemsSubtotal(ctx, q, orderID)
	if err != nil {
		return err
	}

	lines, err := q.ListOrderDiscountLines(ctx, orderID)
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	var discounts int64
	for _, line := range lines {
		discounts += line.AmountCents
	}

	if discounts > subtotal {
		return api.Error(api.ErrorTypeBadRequest, errDiscountsExceedItems)
	}

	return nil
}
