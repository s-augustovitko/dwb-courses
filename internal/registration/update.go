package registration

import (
	"context"

	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
)

type updateRequest struct {
	TokenPath
	SelectionFields
}

// Update replaces the selection, currency, donation and dietary preference of a
// draft.
func (s server) Update(c fiber.Ctx) error {
	var body updateRequest
	if err := c.Bind().All(&body); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	release, err := s.lockByToken(c, body.Token)
	if err != nil {
		return err
	}
	defer release()

	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	var cart cartResponse

	err = api.WithTx(ctx, s, s.Logger(c), func(q *database.Queries) error {
		row, err := orderByToken(ctx, q, body.Token)
		if err != nil {
			return err
		}

		if err := requireDraft(
			row.Status,
			row.PaymentPendingAt,
		); err != nil {
			return err
		}

		cart, err = s.rebuildDraft(ctx, q, row, body.SelectionFields)

		return err
	})
	if err != nil {
		return err
	}

	return api.Success(c, cart)
}

func (s server) rebuildDraft(
	ctx context.Context,
	q *database.Queries,
	row database.GetOrderByIdRow,
	body SelectionFields,
) (cartResponse, error) {
	sub, form, err := loadSubmissionAndVisibleForm(ctx, q, row)
	if err != nil {
		return cartResponse{}, err
	}

	formCurrencies, err := q.ListActiveFormCurrencies(ctx, form.ID)
	if err != nil {
		return cartResponse{}, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	if err := checkAudience(
		sub.Audience,
		body.CurrencyCode,
		formCurrencies,
	); err != nil {
		return cartResponse{}, err
	}

	err = q.UpdateDraftOrderCurrency(
		ctx,
		database.UpdateDraftOrderCurrencyParams{
			CurrencyCode: body.CurrencyCode, ID: row.ID,
		},
	)
	if err != nil {
		return cartResponse{}, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	order := orderRef{id: row.ID, currency: body.CurrencyCode}

	if err := s.applySelection(ctx, q, form, sub, order, body); err != nil {
		return cartResponse{}, err
	}

	return loadCart(ctx, q, row.ID)
}
