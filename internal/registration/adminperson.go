package registration

import (
	"bytes"
	"context"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/validate"
)

type updatePersonRequest struct {
	validate.IDPath
	PersonFields
}

// AdminUpdatePerson corrects the registrant's personal data.
func (s server) AdminUpdatePerson(c fiber.Ctx) error {
	var body updatePersonRequest
	if err := c.Bind().All(&body); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	return s.editOrder(
		c,
		body.ID,
		func(ctx context.Context, q *database.Queries, order database.GetOrderByIdRow) error {
			return s.updatePerson(ctx, q, order, &body.PersonFields)
		},
	)
}

func (s server) updatePerson(
	ctx context.Context,
	q *database.Queries,
	order database.GetOrderByIdRow,
	person *PersonFields,
) error {
	sub, form, err := loadSubmissionAndForm(ctx, q, order)
	if err != nil {
		return err
	}

	idType, err := staffIDType(ctx, q, person.IDTypeID, sub.IDTypeID)
	if err != nil {
		return err
	}

	err = person.normalizeAndValidate(personRules{
		catalog: s.catalog,
		idType:  idType,
		form:    form,
		now:     api.Now(),
		stored: travelDates{
			arrival:   sub.ArrivalDate,
			departure: sub.DepartureDate,
		},
	})
	if err != nil {
		return err
	}

	if err := requireFreeKey(ctx, q, form.ID, *person, order.ID); err != nil {
		return err
	}

	err = q.UpdateSubmission(ctx, database.UpdateSubmissionParams{
		FirstName:             person.FirstName,
		LastName:              person.LastName,
		DocumentNumber:        person.DocumentNumber,
		IDTypeID:              person.IDTypeID[:],
		CountryCode:           person.CountryCode,
		PhoneNumber:           person.PhoneNumber,
		Email:                 person.Email,
		ArrivalDate:           nullInt(person.ArrivalDate),
		DepartureDate:         nullInt(person.DepartureDate),
		InsuranceProvider:     nullString(person.InsuranceProvider),
		InsurancePolicyNumber: nullString(person.InsurancePolicyNumber),
		EmergencyContactName:  nullString(person.EmergencyContactName),
		EmergencyContactPhone: nullString(person.EmergencyContactPhone),
		EmergencyContactCountryCode: nullString(
			person.EmergencyContactCountryCode,
		),
		EmergencyContactEmail: nullString(person.EmergencyContactEmail),
		ID:                    sub.ID,
	})
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	return nil
}

// staffIDType is activeIDType, except that the stored id type stays usable
// after it was deactivated.
func staffIDType(
	ctx context.Context, q *database.Queries, id uuid.UUID, stored []byte,
) (database.IDType, error) {
	if !bytes.Equal(id[:], stored) {
		return activeIDType(ctx, q, id)
	}

	// Does not check for active
	idType, err := q.GetIdTypeById(ctx, stored)
	if err != nil {
		return database.IDType{}, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	return idType, nil
}

func requireFreeKey(
	ctx context.Context,
	q *database.Queries,
	formID []byte,
	person PersonFields,
	orderID []byte,
) error {
	holder, found, err := findRegistration(ctx, q, person.key(formID))
	if err != nil || !found {
		return err
	}

	if !bytes.Equal(holder.OrderID, orderID) {
		return api.Error(api.ErrorTypeConflict, nil)
	}

	return nil
}
