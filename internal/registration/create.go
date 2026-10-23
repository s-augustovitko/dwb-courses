package registration

import (
	"bytes"
	"context"
	"database/sql"
	"errors"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"dwb-courses/internal/api"
	"dwb-courses/internal/countries"
	"dwb-courses/internal/database"
)

type registrationCore struct {
	PersonFields
	SelectionFields

	FormID   uuid.UUID `json:"formId"   validate:"required"`
	Audience string    `json:"audience" validate:"required,oneof=LOCAL FOREIGNER"`
}

// key identifies the registration a person holds on a form: one per document.
func (p *PersonFields) key(formID []byte) database.GetRegistrationByKeyParams {
	return database.GetRegistrationByKeyParams{
		FormID:         formID,
		IDTypeID:       p.IDTypeID[:],
		DocumentNumber: p.DocumentNumber,
	}
}

func (core registrationCore) key() database.GetRegistrationByKeyParams {
	return core.PersonFields.key(core.FormID[:])
}

var (
	errInactiveIDType  = errors.New("id type is not active")
	errDraftOtherEmail = errors.New(
		"the draft holding the document has another email",
	)
	errKeyTaken = errors.New(
		"the document is held by another registration",
	)
)

type createResponse struct {
	Token string       `json:"token"`
	Cart  cartResponse `json:"cart"`
}

// Create starts a registration draft. An unfinished draft for the same document
// is replaced only when the email matches, so knowing someone's document number
// is not enough to take over their registration.
func (s server) Create(c fiber.Ctx) error {
	var body registrationCore
	if err := c.Bind().Body(&body); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	form, held, err := s.prepareWithLock(c, &body)
	if err != nil {
		return err
	}
	defer held.release()

	// Created after the lock wait, so waiting behind a payment does not use up
	// this request's budget.
	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	var out createResponse

	err = api.WithTx(ctx, s, s.Logger(c), func(q *database.Queries) error {
		err := replaceDraft(
			ctx, q, body.key(), held.orderID, sameEmail(body.Email),
		)
		if err != nil {
			return err
		}

		out, err = s.insertDraft(ctx, q, form, body)

		return err
	})
	if err != nil {
		return err
	}

	return api.Success(c, out)
}

// heldKey is the lock on the registration holding a document key; orderID is
// nil when nothing holds it.
type heldKey struct {
	orderID []byte
	unlock  func()
}

func (h heldKey) release() {
	if h.unlock != nil {
		h.unlock()
	}
}

func (s server) prepareWithLock(
	c fiber.Ctx, core *registrationCore,
) (database.Form, heldKey, error) {
	ctx, cancel := s.Cfg().SmCtx(c)
	defer cancel()

	q := database.New(s.DB())

	form, err := validateRegistration(ctx, q, s.catalog, core)
	if err != nil {
		return database.Form{}, heldKey{}, err
	}

	held, err := s.lockKeyHolder(ctx, q, core.key())

	return form, held, err
}

func validateRegistration(
	ctx context.Context,
	q *database.Queries,
	catalog *countries.Catalog,
	core *registrationCore,
) (database.Form, error) {
	form, err := q.GetVisibleFormById(ctx, core.FormID[:])
	if err != nil {
		return database.Form{}, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	formCurrencies, err := q.ListActiveFormCurrencies(ctx, form.ID)
	if err != nil {
		return database.Form{}, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	idType, err := activeIDType(ctx, q, core.IDTypeID)
	if err != nil {
		return database.Form{}, err
	}

	err = core.normalizeAndValidate(personRules{
		catalog: catalog,
		idType:  idType,
		form:    form,
		now:     api.Now(),
		stored:  noStoredTravel,
	})
	if err != nil {
		return database.Form{}, err
	}

	err = checkAudience(core.Audience, core.CurrencyCode, formCurrencies)
	if err != nil {
		return database.Form{}, err
	}

	return form, nil
}

// lockKeyHolder takes the per-order lock of the registration that holds the
// key, so nothing else (a payment, a staff edit) changes it while this request
// replaces it. It runs before the transaction because waiting for the lock
// inside one would hold the database write lock.
func (s server) lockKeyHolder(
	ctx context.Context,
	q *database.Queries,
	key database.GetRegistrationByKeyParams,
) (heldKey, error) {
	holder, found, err := findRegistration(ctx, q, key)
	if err != nil || !found {
		return heldKey{}, err
	}

	return heldKey{
		orderID: holder.OrderID,
		unlock:  s.locks.lock(api.UUIDString(holder.OrderID)),
	}, nil
}

// draftHoldingKey is the check that follows lockKeyHolder, made inside the
// transaction with the lock held. The registration holding the key may have
// changed since lockKeyHolder looked, so it must still be the locked order and
// still a draft that can be replaced. Otherwise the key is taken.
func draftHoldingKey(
	ctx context.Context,
	q *database.Queries,
	key database.GetRegistrationByKeyParams,
	lockedOrderID []byte,
) (database.GetRegistrationByKeyRow, bool, error) {
	holder, found, err := findRegistration(ctx, q, key)
	if err != nil || !found {
		return holder, false, err
	}

	isLockedOrder := bytes.Equal(holder.OrderID, lockedOrderID)
	isDraft := requireDraft(holder.Status, holder.PaymentPendingAt) == nil

	if !isLockedOrder || !isDraft {
		return holder, false, api.Error(
			api.ErrorTypeConflict, errKeyTaken)
	}

	return holder, true, nil
}

type replacementCheck func(draft database.GetRegistrationByKeyRow) error

// sameEmail lets only the email that created a draft replace it.
func sameEmail(email string) replacementCheck {
	return func(draft database.GetRegistrationByKeyRow) error {
		if draft.Email != email {
			return api.Error(api.ErrorTypeConflict, errDraftOtherEmail)
		}

		return nil
	}
}

func anyEmail(database.GetRegistrationByKeyRow) error {
	return nil
}

// replaceDraft deletes the draft holding the key, if there is one and the check
// allows it, so a new registration can take its place.
func replaceDraft(
	ctx context.Context,
	q *database.Queries,
	key database.GetRegistrationByKeyParams,
	lockedOrderID []byte,
	mayReplace replacementCheck,
) error {
	draft, found, err := draftHoldingKey(ctx, q, key, lockedOrderID)
	if err != nil || !found {
		return err
	}

	if err := mayReplace(draft); err != nil {
		return err
	}

	return deleteRegistration(ctx, q, draft.OrderID, draft.SubmissionID)
}

func findRegistration(
	ctx context.Context,
	q *database.Queries,
	key database.GetRegistrationByKeyParams,
) (database.GetRegistrationByKeyRow, bool, error) {
	var none database.GetRegistrationByKeyRow

	holder, err := q.GetRegistrationByKey(ctx, key)
	if errors.Is(err, sql.ErrNoRows) {
		return none, false, nil
	}

	if err != nil {
		return none, false, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	return holder, true, nil
}

func activeIDType(
	ctx context.Context,
	q *database.Queries,
	id uuid.UUID,
) (database.IDType, error) {
	idType, err := q.GetIdTypeById(ctx, id[:])
	if err != nil {
		return database.IDType{}, clientReferenceError(err)
	}

	if !idType.IsActive {
		return database.IDType{},
			api.Error(api.ErrorTypeBadRequest, errInactiveIDType)
	}

	return idType, nil
}

func (s server) insertDraft(
	ctx context.Context,
	q *database.Queries,
	form database.Form,
	core registrationCore,
) (createResponse, error) {
	token, hash, err := NewToken()
	if err != nil {
		return createResponse{}, api.Error(api.ErrorTypeUnexpected, err)
	}

	sub, order, err := startRegistration(
		ctx, q, form, core,
		func(orderID, submissionID []byte) error {
			_, err := q.CreateDraftOrder(ctx, database.CreateDraftOrderParams{
				ID:              orderID,
				SubmissionID:    submissionID,
				CurrencyCode:    core.CurrencyCode,
				AccessTokenHash: sql.NullString{String: hash, Valid: true},
			})

			return err
		},
	)
	if err != nil {
		return createResponse{}, err
	}

	err = s.applySelection(ctx, q, form, sub, order, core.SelectionFields)
	if err != nil {
		return createResponse{}, err
	}

	cart, err := loadCart(ctx, q, order.id)
	if err != nil {
		return createResponse{}, err
	}

	return createResponse{Token: token, Cart: cart}, nil
}

// startRegistration inserts the submission and, through insertOrder, its order;
// the selection is applied by the caller.
func startRegistration(
	ctx context.Context,
	q *database.Queries,
	form database.Form,
	core registrationCore,
	insertOrder func(orderID, submissionID []byte) error,
) (database.Submission, orderRef, error) {
	sub, err := createSubmission(ctx, q, form.ID, core)
	if err != nil {
		return database.Submission{}, orderRef{}, err
	}

	orderID, err := uuid.NewV7()
	if err != nil {
		return database.Submission{}, orderRef{}, api.Error(
			api.ErrorTypeUnexpected, err)
	}

	if err := insertOrder(orderID[:], sub.ID); err != nil {
		return database.Submission{}, orderRef{}, api.Error(
			api.ErrorTypeFromSQL(err), err)
	}

	return sub, orderRef{id: orderID[:], currency: core.CurrencyCode}, nil
}

func createSubmission(
	ctx context.Context,
	q *database.Queries,
	formID []byte,
	core registrationCore,
) (database.Submission, error) {
	id, err := uuid.NewV7()
	if err != nil {
		return database.Submission{}, api.Error(api.ErrorTypeUnexpected, err)
	}

	sub, err := q.CreateSubmission(
		ctx, newSubmissionParams(id, formID, core))
	if err != nil {
		return database.Submission{}, api.Error(
			api.ErrorTypeFromSQL(err), err)
	}

	return sub, nil
}

func deleteRegistration(
	ctx context.Context, q *database.Queries, orderID, submissionID []byte,
) error {
	if err := q.DeleteOrder(ctx, orderID); err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	if err := q.DeleteSubmission(ctx, submissionID); err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	return nil
}

func newSubmissionParams(
	id uuid.UUID,
	formID []byte,
	body registrationCore,
) database.CreateSubmissionParams {
	return database.CreateSubmissionParams{
		ID:                    id[:],
		FormID:                formID,
		FirstName:             body.FirstName,
		LastName:              body.LastName,
		DocumentNumber:        body.DocumentNumber,
		IDTypeID:              body.IDTypeID[:],
		CountryCode:           body.CountryCode,
		PhoneNumber:           body.PhoneNumber,
		Email:                 body.Email,
		ArrivalDate:           nullInt(body.ArrivalDate),
		DepartureDate:         nullInt(body.DepartureDate),
		InsuranceProvider:     nullString(body.InsuranceProvider),
		InsurancePolicyNumber: nullString(body.InsurancePolicyNumber),
		EmergencyContactName:  nullString(body.EmergencyContactName),
		EmergencyContactPhone: nullString(body.EmergencyContactPhone),
		EmergencyContactCountryCode: nullString(
			body.EmergencyContactCountryCode,
		),
		EmergencyContactEmail: nullString(body.EmergencyContactEmail),
		Audience:              body.Audience,
		DietaryPreference:     sql.NullString{String: "", Valid: false},
	}
}
