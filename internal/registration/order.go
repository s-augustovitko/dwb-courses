package registration

import (
	"context"
	"database/sql"

	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
)

// orderByToken resolves a bearer token to its order;
// unknown tokens are not found.
func orderByToken(
	ctx context.Context,
	q *database.Queries,
	token string,
) (database.GetOrderByIdRow, error) {
	row, err := q.GetOrderByTokenHash(
		ctx,
		sql.NullString{
			String: hashToken(token),
			Valid:  true,
		})
	if err != nil {
		return database.GetOrderByIdRow{}, api.Error(
			api.ErrorTypeFromSQL(err),
			err,
		)
	}

	return database.GetOrderByIdRow(row), nil
}

// lockByToken takes the per-order lock for a bearer token,
// so changes never overlap an online payment.
func (s server) lockByToken(c fiber.Ctx, token string) (func(), error) {
	ctx, cancel := s.Cfg().SmCtx(c)
	defer cancel()

	row, err := orderByToken(ctx, database.New(s.DB()), token)
	if err != nil {
		return nil, err
	}

	orderID := api.UUIDString(row.ID)

	return s.locks.lock(orderID), nil
}

type formLoader func(ctx context.Context, id []byte) (database.Form, error)

func loadSubmission(
	ctx context.Context, q *database.Queries, order database.GetOrderByIdRow,
) (database.Submission, error) {
	sub, err := q.GetSubmissionById(ctx, order.SubmissionID)
	if err != nil {
		return database.Submission{}, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	return sub, nil
}

// loadSubmissionAndForm loads the order's submission and its form, enabled or
// not.
func loadSubmissionAndForm(
	ctx context.Context, q *database.Queries, order database.GetOrderByIdRow,
) (database.Submission, database.Form, error) {
	return loadWithForm(ctx, q, order, q.GetFormById)
}

// loadSubmissionAndVisibleForm is loadSubmissionAndForm for the public flow:
// a disabled form is not found.
func loadSubmissionAndVisibleForm(
	ctx context.Context, q *database.Queries, order database.GetOrderByIdRow,
) (database.Submission, database.Form, error) {
	return loadWithForm(ctx, q, order, q.GetVisibleFormById)
}

func loadWithForm(
	ctx context.Context,
	q *database.Queries,
	order database.GetOrderByIdRow,
	loadForm formLoader,
) (database.Submission, database.Form, error) {
	sub, err := loadSubmission(ctx, q, order)
	if err != nil {
		return database.Submission{}, database.Form{}, err
	}

	form, err := loadForm(ctx, sub.FormID)
	if err != nil {
		return database.Submission{}, database.Form{}, api.Error(
			api.ErrorTypeFromSQL(err),
			err,
		)
	}

	return sub, form, nil
}
