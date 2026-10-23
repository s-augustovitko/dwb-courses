package registration

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
)

// itemKind is what differs between the sessions and the meals of a form: the
// queries that link them to a submission and snapshot them into an order.
type itemKind struct {
	selectAll bool
	linkAll   func(ctx context.Context) error
	link      func(ctx context.Context, itemID uuid.UUID) error
	lines     func(ctx context.Context) (map[uuid.UUID][]byte, error)
	active    func(ctx context.Context) (map[uuid.UUID]bool, error)
	remove    func(ctx context.Context, itemID uuid.UUID, lineID []byte) error
	add       func(ctx context.Context, itemID uuid.UUID, price *int64) error
}

func sessionKind(
	q *database.Queries,
	form database.Form,
	sub database.Submission,
	order orderRef,
) itemKind {
	return itemKind{
		selectAll: form.DisableSessionSelection,
		linkAll:   linkAllSessions(q, form, sub),
		link:      linkSession(q, sub),
		lines:     sessionLines(q, order),
		active:    activeSessions(q, form),
		remove:    removeSession(q, sub),
		add:       addSessionLine(q, sub, order),
	}
}

func mealKind(
	q *database.Queries,
	form database.Form,
	sub database.Submission,
	order orderRef,
) itemKind {
	return itemKind{
		selectAll: form.DisableMealSelection,
		linkAll:   linkAllMeals(q, form, sub),
		link:      linkMeal(q, sub),
		lines:     mealLines(q, order),
		active:    activeMeals(q, form),
		remove:    removeMeal(q, sub),
		add:       addMealLine(q, sub, order),
	}
}

func linkAllSessions(
	q *database.Queries, form database.Form, sub database.Submission,
) func(ctx context.Context) error {
	return func(ctx context.Context) error {
		return q.LinkAllActiveSessionsToSubmission(
			ctx,
			database.LinkAllActiveSessionsToSubmissionParams{
				SubmissionID: sub.ID, FormID: form.ID,
			},
		)
	}
}

func linkAllMeals(
	q *database.Queries, form database.Form, sub database.Submission,
) func(ctx context.Context) error {
	return func(ctx context.Context) error {
		return q.LinkAllActiveMealsToSubmission(
			ctx,
			database.LinkAllActiveMealsToSubmissionParams{
				SubmissionID: sub.ID, FormID: form.ID,
			},
		)
	}
}

func linkSession(
	q *database.Queries, sub database.Submission,
) func(ctx context.Context, itemID uuid.UUID) error {
	return func(ctx context.Context, itemID uuid.UUID) error {
		return q.AddSubmissionSession(
			ctx,
			database.AddSubmissionSessionParams{
				SubmissionID: sub.ID, SessionID: itemID[:],
			},
		)
	}
}

func linkMeal(
	q *database.Queries, sub database.Submission,
) func(ctx context.Context, itemID uuid.UUID) error {
	return func(ctx context.Context, itemID uuid.UUID) error {
		return q.AddSubmissionMeal(
			ctx,
			database.AddSubmissionMealParams{
				SubmissionID: sub.ID, MealID: itemID[:],
			},
		)
	}
}

func sessionLines(
	q *database.Queries, order orderRef,
) func(ctx context.Context) (map[uuid.UUID][]byte, error) {
	return func(ctx context.Context) (map[uuid.UUID][]byte, error) {
		rows, err := q.ListOrderSessionItems(ctx, order.id)
		if err != nil {
			return nil, api.Error(api.ErrorTypeFromSQL(err), err)
		}

		return lineIndex(
			rows,
			func(row database.OrderSessionItem) ([]byte, []byte) {
				return row.SessionID, row.ID
			},
		), nil
	}
}

func mealLines(
	q *database.Queries, order orderRef,
) func(ctx context.Context) (map[uuid.UUID][]byte, error) {
	return func(ctx context.Context) (map[uuid.UUID][]byte, error) {
		rows, err := q.ListOrderMealItems(ctx, order.id)
		if err != nil {
			return nil, api.Error(api.ErrorTypeFromSQL(err), err)
		}

		return lineIndex(
			rows,
			func(row database.OrderMealItem) ([]byte, []byte) {
				return row.MealID, row.ID
			},
		), nil
	}
}

func activeSessions(
	q *database.Queries, form database.Form,
) func(ctx context.Context) (map[uuid.UUID]bool, error) {
	return func(ctx context.Context) (map[uuid.UUID]bool, error) {
		rows, err := q.ListActiveSessionsByForm(ctx, form.ID)
		if err != nil {
			return nil, api.Error(api.ErrorTypeFromSQL(err), err)
		}

		return idSet(rows, func(row database.Session) []byte {
			return row.ID
		}), nil
	}
}

func activeMeals(
	q *database.Queries, form database.Form,
) func(ctx context.Context) (map[uuid.UUID]bool, error) {
	return func(ctx context.Context) (map[uuid.UUID]bool, error) {
		rows, err := q.ListActiveMealsByForm(ctx, form.ID)
		if err != nil {
			return nil, api.Error(api.ErrorTypeFromSQL(err), err)
		}

		return idSet(rows, func(row database.Meal) []byte {
			return row.ID
		}), nil
	}
}

func removeSession(
	q *database.Queries, sub database.Submission,
) func(ctx context.Context, itemID uuid.UUID, lineID []byte) error {
	return func(ctx context.Context, itemID uuid.UUID, lineID []byte) error {
		return sqlFailure(
			q.DeleteOrderSessionItem(ctx, lineID),
			q.RemoveSubmissionSession(
				ctx,
				database.RemoveSubmissionSessionParams{
					SubmissionID: sub.ID, SessionID: itemID[:],
				},
			),
		)
	}
}

func removeMeal(
	q *database.Queries, sub database.Submission,
) func(ctx context.Context, itemID uuid.UUID, lineID []byte) error {
	return func(ctx context.Context, itemID uuid.UUID, lineID []byte) error {
		return sqlFailure(
			q.DeleteOrderMealItem(ctx, lineID),
			q.RemoveSubmissionMeal(
				ctx,
				database.RemoveSubmissionMealParams{
					SubmissionID: sub.ID, MealID: itemID[:],
				},
			),
		)
	}
}

//nolint:dupl // mirrors addMealLine with the session queries
func addSessionLine(
	q *database.Queries, sub database.Submission, order orderRef,
) func(ctx context.Context, itemID uuid.UUID, price *int64) error {
	return func(ctx context.Context, itemID uuid.UUID, price *int64) error {
		session, err := q.GetSessionById(ctx, itemID[:])
		if err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}

		cents, err := linePrice(price, func() (int64, error) {
			row, err := q.GetSessionPrice(ctx, database.GetSessionPriceParams{
				SessionID: itemID[:], CurrencyCode: order.currency,
			})

			return row.AmountCents, err
		})
		if err != nil {
			return err
		}

		return createLine(func(lineID []byte) error {
			_, err := q.CreateOrderSessionItem(
				ctx,
				database.CreateOrderSessionItemParams{
					ID: lineID, OrderID: order.id, SessionID: itemID[:],
					NameSnapshot: session.Name, UnitPriceCents: cents,
				},
			)
			if err != nil {
				return err
			}

			return q.AddSubmissionSession(
				ctx,
				database.AddSubmissionSessionParams{
					SubmissionID: sub.ID, SessionID: itemID[:],
				},
			)
		})
	}
}

//nolint:dupl // mirrors addSessionLine with the meal queries
func addMealLine(
	q *database.Queries, sub database.Submission, order orderRef,
) func(ctx context.Context, itemID uuid.UUID, price *int64) error {
	return func(ctx context.Context, itemID uuid.UUID, price *int64) error {
		meal, err := q.GetMealById(ctx, itemID[:])
		if err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}

		cents, err := linePrice(price, func() (int64, error) {
			row, err := q.GetMealPrice(ctx, database.GetMealPriceParams{
				MealID: itemID[:], CurrencyCode: order.currency,
			})

			return row.AmountCents, err
		})
		if err != nil {
			return err
		}

		return createLine(func(lineID []byte) error {
			_, err := q.CreateOrderMealItem(
				ctx,
				database.CreateOrderMealItemParams{
					ID: lineID, OrderID: order.id, MealID: itemID[:],
					NameSnapshot: meal.Name, UnitPriceCents: cents,
				},
			)
			if err != nil {
				return err
			}

			return q.AddSubmissionMeal(ctx, database.AddSubmissionMealParams{
				SubmissionID: sub.ID, MealID: itemID[:],
			})
		})
	}
}

// linePrice is the staff override, else the catalog price; an item without a
// price in the currency is a bad request.
func linePrice(override *int64, catalog func() (int64, error)) (int64, error) {
	if override != nil {
		return *override, nil
	}

	price, err := catalog()
	if errors.Is(err, sql.ErrNoRows) {
		return 0, api.Error(api.ErrorTypeBadRequest, errItemNotPriced)
	}

	if err != nil {
		return 0, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	return price, nil
}

func createLine(create func(lineID []byte) error) error {
	lineID, err := uuid.NewV7()
	if err != nil {
		return api.Error(api.ErrorTypeUnexpected, err)
	}

	if err := create(lineID[:]); err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	return nil
}

func idSet[T any](rows []T, id func(T) []byte) map[uuid.UUID]bool {
	ids := make(map[uuid.UUID]bool, len(rows))
	for _, row := range rows {
		ids[api.UUIDFromBytes(id(row))] = true
	}

	return ids
}

func lineIndex[T any](
	rows []T, ids func(T) (itemID, lineID []byte),
) map[uuid.UUID][]byte {
	index := make(map[uuid.UUID][]byte, len(rows))

	for _, row := range rows {
		itemID, lineID := ids(row)
		index[api.UUIDFromBytes(itemID)] = lineID
	}

	return index
}

// sqlFailure is the first database error among errs as an API error.
func sqlFailure(errs ...error) error {
	if err := errors.Join(errs...); err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	return nil
}
