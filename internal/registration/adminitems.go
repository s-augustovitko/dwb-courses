package registration

import (
	"context"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/validate"
)

type itemsRequest struct {
	validate.IDPath

	SessionIDs        []uuid.UUID     `json:"sessionIds"        validate:"unique,max=100,dive,required"`
	MealIDs           []uuid.UUID     `json:"mealIds"           validate:"unique,max=100,dive,required"`
	DietaryPreference string          `json:"dietaryPreference" validate:"omitempty,oneof=REGULAR VEGETARIAN"`
	Overrides         []priceOverride `json:"overrides"         validate:"max=200,unique=ItemID,dive"`
}

type itemChanges struct {
	add    []uuid.UUID
	remove map[uuid.UUID][]byte // item id -> order line id
}

// AdminEditItems replaces the selected sessions and meals; existing lines keep
// their price snapshots.
func (s server) AdminEditItems(c fiber.Ctx) error {
	var body itemsRequest
	if err := c.Bind().All(&body); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	return s.editOrder(
		c,
		body.ID,
		func(ctx context.Context, q *database.Queries, order database.GetOrderByIdRow) error {
			return editItems(ctx, q, order, body)
		},
	)
}

func editItems(
	ctx context.Context,
	q *database.Queries,
	order database.GetOrderByIdRow,
	body itemsRequest,
) error {
	sub, form, err := loadSubmissionAndForm(ctx, q, order)
	if err != nil {
		return err
	}

	ref := orderRef{id: order.ID, currency: order.CurrencyCode}
	sessions := sessionKind(q, form, sub, ref)
	meals := mealKind(q, form, sub, ref)

	sessionChanges, err := diffKind(ctx, sessions, body.SessionIDs)
	if err != nil {
		return err
	}

	mealChanges, err := diffKind(ctx, meals, body.MealIDs)
	if err != nil {
		return err
	}

	prices, err := overridePrices(
		body.Overrides,
		sessionChanges.add,
		mealChanges.add,
	)
	if err != nil {
		return err
	}

	if err := applyChanges(ctx, sessions, sessionChanges, prices); err != nil {
		return err
	}

	if err := applyChanges(ctx, meals, mealChanges, prices); err != nil {
		return err
	}

	if err := requireSelection(ctx, q, form, sub.ID); err != nil {
		return err
	}

	if err := storeDietary(ctx, q, sub.ID, body.DietaryPreference); err != nil {
		return err
	}

	if err := syncAutomaticDiscounts(ctx, q, form, sub, ref); err != nil {
		return err
	}

	_, err = refreshStatus(ctx, q, order.ID)

	return err
}

// overridePrices indexes the overrides by item id; each must name an item this
// request adds.
func overridePrices(
	overrides []priceOverride,
	added ...[]uuid.UUID,
) (map[uuid.UUID]*int64, error) {
	addedIDs := make(map[uuid.UUID]bool)

	for _, ids := range added {
		for _, id := range ids {
			addedIDs[id] = true
		}
	}

	prices := make(map[uuid.UUID]*int64, len(overrides))

	for _, override := range overrides {
		if !addedIDs[override.ItemID] {
			return nil, api.Error(api.ErrorTypeBadRequest, errOverrideNotAdded)
		}

		prices[override.ItemID] = override.PriceCents
	}

	return prices, nil
}

// diffKind compares the requested ids with the order's lines; lines already on
// the order stay allowed
// even if the item was deactivated since.
func diffKind(
	ctx context.Context,
	kind itemKind,
	requested []uuid.UUID,
) (itemChanges, error) {
	existing, err := kind.lines(ctx)
	if err != nil {
		return itemChanges{}, err
	}

	allowed, err := kind.active(ctx)
	if err != nil {
		return itemChanges{}, err
	}

	for id := range existing {
		allowed[id] = true
	}

	return diffItems(requested, existing, allowed)
}

func diffItems(
	requested []uuid.UUID,
	existing map[uuid.UUID][]byte,
	allowed map[uuid.UUID]bool,
) (itemChanges, error) {
	changes := itemChanges{add: nil, remove: make(map[uuid.UUID][]byte)}
	wanted := make(map[uuid.UUID]bool, len(requested))

	for _, id := range requested {
		if !allowed[id] {
			return itemChanges{}, api.Error(
				api.ErrorTypeBadRequest,
				errItemNotOffered,
			)
		}

		wanted[id] = true

		if _, found := existing[id]; !found {
			changes.add = append(changes.add, id)
		}
	}

	for id, line := range existing {
		if !wanted[id] {
			changes.remove[id] = line
		}
	}

	return changes, nil
}

func applyChanges(
	ctx context.Context,
	kind itemKind,
	changes itemChanges,
	prices map[uuid.UUID]*int64,
) error {
	for id, line := range changes.remove {
		if err := kind.remove(ctx, id, line); err != nil {
			return err
		}
	}

	for _, id := range changes.add {
		if err := kind.add(ctx, id, prices[id]); err != nil {
			return err
		}
	}

	return nil
}
