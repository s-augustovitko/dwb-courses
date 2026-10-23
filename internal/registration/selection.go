package registration

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
)

const (
	audienceLocal     = "LOCAL"
	audienceForeigner = "FOREIGNER"
)

var (
	errNoItems   = errors.New("no session or meal selected")
	errNoSession = errors.New(
		"no session selected on a form with session selection",
	)
	errItemNotOffered  = errors.New("item is not an active item of the form")
	errItemNotPriced   = errors.New("item has no price in the order currency")
	errDietaryRequired = errors.New(
		"a dietary preference is required with meals",
	)
	errDonation = errors.New("donation not allowed or above the maximum")
	errAudience = errors.New("currency does not match the audience")
)

// SelectionFields is the order's currency, items, donation and dietary
// preference.
type SelectionFields struct {
	CurrencyCode      string      `json:"currencyCode"      validate:"required,iso4217"`
	SessionIDs        []uuid.UUID `json:"sessionIds"        validate:"unique,max=100,dive,required"`
	MealIDs           []uuid.UUID `json:"mealIds"           validate:"unique,max=100,dive,required"`
	DonationCents     int64       `json:"donationCents"     validate:"min=0,max=100000000"`
	DietaryPreference string      `json:"dietaryPreference" validate:"omitempty,oneof=REGULAR VEGETARIAN"`
}

type orderRef struct {
	id       []byte
	currency string
}

// checkAudience enforces LOCAL = default currency, FOREIGNER = another currency
// of the form.
func checkAudience(
	audience, currencyCode string,
	formCurrencies []database.ListActiveFormCurrenciesRow,
) error {
	for _, option := range formCurrencies {
		if option.Code == currencyCode &&
			option.IsDefault == (audience == audienceLocal) {
			return nil
		}
	}

	return api.Error(api.ErrorTypeBadRequest, errAudience)
}

// applySelection replaces the submission's sessions, meals and the order's
// items with the validated selection.
func (s server) applySelection(
	ctx context.Context,
	q *database.Queries,
	form database.Form,
	sub database.Submission,
	order orderRef,
	sel SelectionFields,
) error {
	if err := clearSelection(ctx, q, sub.ID, order.id); err != nil {
		return err
	}

	sessions := sessionKind(q, form, sub, order)
	if !sessions.selectAll && len(sel.SessionIDs) == 0 {
		return api.Error(api.ErrorTypeBadRequest, errNoSession)
	}

	if err := linkSelection(ctx, sessions, sel.SessionIDs); err != nil {
		return err
	}

	meals := mealKind(q, form, sub, order)
	if err := linkSelection(ctx, meals, sel.MealIDs); err != nil {
		return err
	}

	if err := storeDietary(ctx, q, sub.ID, sel.DietaryPreference); err != nil {
		return err
	}

	if err := requireSelection(ctx, q, form, sub.ID); err != nil {
		return err
	}

	return s.snapshotItems(ctx, q, form, sub, order, sel.DonationCents)
}

func clearSelection(
	ctx context.Context,
	q *database.Queries,
	submissionID, orderID []byte,
) error {
	return sqlFailure(
		q.ClearSubmissionSessions(ctx, submissionID),
		q.ClearSubmissionMeals(ctx, submissionID),
		q.ClearOrderSessionItems(ctx, orderID),
		q.ClearOrderMealItems(ctx, orderID),
		q.ClearOrderDiscountItems(ctx, orderID),
		q.ClearOrderDonationItem(ctx, orderID),
	)
}

// linkSelection links the requested items to the submission once each is
// confirmed to be an active item of the form; a form that does not let the
// registrant choose links every active item.
func linkSelection(
	ctx context.Context, kind itemKind, ids []uuid.UUID,
) error {
	if kind.selectAll {
		if err := kind.linkAll(ctx); err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}

		return nil
	}

	active, err := kind.active(ctx)
	if err != nil {
		return err
	}

	for _, id := range ids {
		if !active[id] {
			return api.Error(api.ErrorTypeBadRequest, errItemNotOffered)
		}

		if err := kind.link(ctx, id); err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}
	}

	return nil
}

func submissionItemCounts(
	ctx context.Context,
	q *database.Queries,
	submissionID []byte,
) (int64, int64, error) {
	sessions, err := q.CountSubmissionSessions(ctx, submissionID)
	if err != nil {
		return 0, 0, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	meals, err := q.CountSubmissionMeals(ctx, submissionID)
	if err != nil {
		return 0, 0, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	return sessions, meals, nil
}

// requireSelection rejects an order without items, or without a session when
// the form requires one.
func requireSelection(
	ctx context.Context,
	q *database.Queries,
	form database.Form,
	submissionID []byte,
) error {
	sessions, meals, err := submissionItemCounts(ctx, q, submissionID)
	if err != nil {
		return err
	}

	if !form.DisableSessionSelection && sessions == 0 {
		return api.Error(api.ErrorTypeBadRequest, errNoSession)
	}

	if sessions+meals == 0 {
		return api.Error(api.ErrorTypeBadRequest, errNoItems)
	}

	return nil
}

// storeDietary requires a preference while meals are selected and clears it
// otherwise.
func storeDietary(
	ctx context.Context,
	q *database.Queries,
	submissionID []byte,
	preference string,
) error {
	_, meals, err := submissionItemCounts(ctx, q, submissionID)
	if err != nil {
		return err
	}

	if meals > 0 && preference == "" {
		return api.Error(api.ErrorTypeBadRequest, errDietaryRequired)
	}

	err = q.SetSubmissionDietaryPreference(
		ctx,
		database.SetSubmissionDietaryPreferenceParams{
			DietaryPreference: sql.NullString{
				String: preference,
				Valid:  meals > 0,
			},
			ID: submissionID,
		},
	)
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	return nil
}

// snapshotItems copies the chosen sessions, meals, donation and automatic
// discounts into the order.
func (s server) snapshotItems(
	ctx context.Context,
	q *database.Queries,
	form database.Form,
	sub database.Submission,
	order orderRef,
	donationCents int64,
) error {
	if err := snapshotPricedItems(ctx, q, sub.ID, order); err != nil {
		return err
	}

	if donationCents > 0 {
		maxCents := s.Cfg().Registration.MaxDonationCents

		err := addDonation(ctx, q, form, order.id, donationCents, maxCents)
		if err != nil {
			return err
		}
	}

	if err := addEligibleDiscounts(ctx, q, form, sub, order, nil); err != nil {
		return err
	}

	return capAutomaticDiscounts(ctx, q, order.id)
}

// snapshotPricedItems copies the selected sessions and meals; a missing price
// in the currency is a bad request.
func snapshotPricedItems(
	ctx context.Context,
	q *database.Queries,
	submissionID []byte,
	order orderRef,
) error {
	sessions, err := q.CreateOrderSessionItemsFromSubmission(
		ctx,
		database.CreateOrderSessionItemsFromSubmissionParams{
			OrderID:      order.id,
			CurrencyCode: order.currency,
			SubmissionID: submissionID,
		},
	)
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	meals, err := q.CreateOrderMealItemsFromSubmission(
		ctx,
		database.CreateOrderMealItemsFromSubmissionParams{
			OrderID:      order.id,
			CurrencyCode: order.currency,
			SubmissionID: submissionID,
		},
	)
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	sessionCount, mealCount, err := submissionItemCounts(ctx, q, submissionID)
	if err != nil {
		return err
	}

	if int64(len(sessions)) != sessionCount || int64(len(meals)) != mealCount {
		return api.Error(api.ErrorTypeBadRequest, errItemNotPriced)
	}

	return nil
}

func addDonation(
	ctx context.Context,
	q *database.Queries,
	form database.Form,
	orderID []byte,
	cents, maxCents int64,
) error {
	if form.DisableDonation || cents > maxCents {
		return api.Error(api.ErrorTypeBadRequest, errDonation)
	}

	id, err := uuid.NewV7()
	if err != nil {
		return api.Error(api.ErrorTypeUnexpected, err)
	}

	_, err = q.CreateOrderDonationItem(
		ctx,
		database.CreateOrderDonationItemParams{
			ID: id[:], OrderID: orderID, AmountCents: cents,
		},
	)
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	return nil
}
