package registration

import (
	"database/sql"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"

	"dwb-courses/internal/api"
	"dwb-courses/internal/countries"
	"dwb-courses/internal/database"
	"dwb-courses/internal/validate"
)

const (
	dayDuration        = 24 * time.Hour
	travelMonthsBack   = 3
	travelYearsForward = 1
)

var (
	errDocumentFormat = errors.New("document number does not match the id type")
	errPersonName     = errors.New("invalid name")
	errDialCode       = errors.New("unknown dial code")
	errTravelDates    = errors.New("invalid travel dates")
	errEmergencyPhone = errors.New("invalid emergency contact phone")
	errEmergencyEmail = errors.New("invalid emergency contact email")
)

var fieldValidator = validator.New()

var (
	personNamePattern = regexp.MustCompile(
		`^[\p{L}\p{M}]+(?:(?:\. |[ '.-])[\p{L}\p{M}]+)*\.?$`,
	)
	digitsPattern   = regexp.MustCompile(`^[0-9]+$`)
	alphanumPattern = regexp.MustCompile(`^[A-Z0-9]+$`)
)

// PersonFields is the registrant's personal data. It is exported so the request
// structs embedding it can be
// bound with Bind().All, which skips unexported embedded fields.
type PersonFields struct {
	IDTypeID       uuid.UUID `json:"idTypeId"       validate:"required"`
	DocumentNumber string    `json:"documentNumber" validate:"required,max=32"`
	FirstName      string    `json:"firstName"      validate:"required,max=100"`
	LastName       string    `json:"lastName"       validate:"required,max=100"`
	CountryCode    string    `json:"countryCode"    validate:"required,startswith=+,min=2,max=5"`
	PhoneNumber    string    `json:"phoneNumber"    validate:"required,number,min=6,max=15"`
	Email          string    `json:"email"          validate:"required,email,ascii,max=254"`

	ArrivalDate   *int64 `json:"arrivalDate"   validate:"omitempty,min=0"`
	DepartureDate *int64 `json:"departureDate" validate:"omitempty,min=0"`

	InsuranceProvider     *string `json:"insuranceProvider"     validate:"omitempty,max=100"`
	InsurancePolicyNumber *string `json:"insurancePolicyNumber" validate:"omitempty,max=64"`

	EmergencyContactName        *string `json:"emergencyContactName"        validate:"omitempty,max=100"`
	EmergencyContactPhone       *string `json:"emergencyContactPhone"       validate:"omitempty,max=64"`
	EmergencyContactCountryCode *string `json:"emergencyContactCountryCode" validate:"omitempty,max=8"`
	EmergencyContactEmail       *string `json:"emergencyContactEmail"       validate:"omitempty,max=254"`
}

// personRules is what the form, the id type and the clock allow in a
// registrant's data; stored is what the submission already holds.
type personRules struct {
	catalog *countries.Catalog
	idType  database.IDType
	form    database.Form
	now     time.Time
	stored  travelDates
}

type travelDates struct {
	arrival   sql.NullInt64
	departure sql.NullInt64
}

var noStoredTravel travelDates

func (p *PersonFields) normalizeAndValidate(rules personRules) error {
	p.normalizeIdentity()

	if err := p.validateIdentity(rules); err != nil {
		return err
	}

	if err := p.validateTravel(rules); err != nil {
		return err
	}

	p.normalizeInsurance(rules.form)

	return p.normalizeEmergencyContact(rules.catalog, rules.form)
}

func (p *PersonFields) normalizeIdentity() {
	p.FirstName = collapseSpaces(p.FirstName)
	p.LastName = collapseSpaces(p.LastName)
	p.Email = strings.ToLower(strings.TrimSpace(p.Email))
	p.DocumentNumber = strings.ToUpper(strings.TrimSpace(p.DocumentNumber))
}

func (p *PersonFields) validateIdentity(rules personRules) error {
	if !personNamePattern.MatchString(p.FirstName) ||
		!personNamePattern.MatchString(p.LastName) {
		return api.Error(api.ErrorTypeBadRequest, errPersonName)
	}

	if !rules.catalog.IsDialCode(p.CountryCode) {
		return api.Error(api.ErrorTypeBadRequest, errDialCode)
	}

	if !documentMatches(p.DocumentNumber, rules.idType) {
		return api.Error(api.ErrorTypeBadRequest, errDocumentFormat)
	}

	return nil
}

func documentMatches(document string, idType database.IDType) bool {
	length := int64(len(document))

	if !idType.AllowLetters {
		return digitsPattern.MatchString(document) && length == idType.MaxLen
	}

	return alphanumPattern.MatchString(document) &&
		length >= validate.MinLetterDocumentLen && length <= idType.MaxLen
}

// validateTravel checks the dates that were sent: arrival not after departure
// and each new date from 3 months back to 1 year ahead. Both are optional.
func (p *PersonFields) validateTravel(rules personRules) error {
	if !rules.form.ShowArrivalAndDeparture {
		p.ArrivalDate, p.DepartureDate = nil, nil

		return nil
	}

	if p.ArrivalDate != nil && p.DepartureDate != nil &&
		*p.DepartureDate < *p.ArrivalDate {
		return api.Error(api.ErrorTypeBadRequest, errTravelDates)
	}

	if p.ArrivalDate != nil &&
		!travelDateAllowed(*p.ArrivalDate, rules.stored.arrival, rules.now) {
		return api.Error(api.ErrorTypeBadRequest, errTravelDates)
	}

	if p.DepartureDate != nil &&
		!travelDateAllowed(
			*p.DepartureDate,
			rules.stored.departure,
			rules.now,
		) {
		return api.Error(api.ErrorTypeBadRequest, errTravelDates)
	}

	return nil
}

func travelDateAllowed(date int64, stored sql.NullInt64, now time.Time) bool {
	if stored.Valid && stored.Int64 == date {
		return true
	}

	today := now.UTC().Truncate(dayDuration)

	return date >= today.AddDate(0, -travelMonthsBack, 0).Unix() &&
		date <= today.AddDate(travelYearsForward, 0, 0).Unix()
}

func (p *PersonFields) normalizeInsurance(form database.Form) {
	if !form.ShowInsurance {
		p.InsuranceProvider, p.InsurancePolicyNumber = nil, nil

		return
	}

	p.InsuranceProvider = trimmedOrNil(p.InsuranceProvider)
	p.InsurancePolicyNumber = trimmedOrNil(p.InsurancePolicyNumber)
}

func (p *PersonFields) normalizeEmergencyContact(
	catalog *countries.Catalog,
	form database.Form,
) error {
	if !form.ShowEmergencyContact {
		p.EmergencyContactName, p.EmergencyContactPhone = nil, nil
		p.EmergencyContactCountryCode, p.EmergencyContactEmail = nil, nil

		return nil
	}

	p.EmergencyContactName = trimmedOrNil(p.EmergencyContactName)
	p.EmergencyContactPhone = trimmedOrNil(p.EmergencyContactPhone)
	p.EmergencyContactEmail = lowerOrNil(p.EmergencyContactEmail)

	if p.EmergencyContactName != nil {
		name := collapseSpaces(*p.EmergencyContactName)
		p.EmergencyContactName = &name

		if !personNamePattern.MatchString(name) {
			return api.Error(api.ErrorTypeBadRequest, errPersonName)
		}
	}

	p.EmergencyContactCountryCode = trimmedOrNil(p.EmergencyContactCountryCode)

	if p.EmergencyContactEmail != nil &&
		fieldValidator.Var(
			*p.EmergencyContactEmail,
			"email,ascii,max=254",
		) != nil {
		return api.Error(api.ErrorTypeBadRequest, errEmergencyEmail)
	}

	if p.EmergencyContactPhone == nil {
		p.EmergencyContactCountryCode = nil

		return nil
	}

	if fieldValidator.Var(
		*p.EmergencyContactPhone,
		"number,min=6,max=15",
	) != nil {
		return api.Error(api.ErrorTypeBadRequest, errEmergencyPhone)
	}

	if p.EmergencyContactCountryCode == nil ||
		!catalog.IsDialCode(*p.EmergencyContactCountryCode) {
		return api.Error(api.ErrorTypeBadRequest, errDialCode)
	}

	return nil
}

func trimmedOrNil(value *string) *string {
	if isBlank(value) {
		return nil
	}

	trimmed := strings.TrimSpace(*value)

	return &trimmed
}

func lowerOrNil(value *string) *string {
	trimmed := trimmedOrNil(value)
	if trimmed == nil {
		return nil
	}

	lowered := strings.ToLower(*trimmed)

	return &lowered
}

func collapseSpaces(value string) string {
	return strings.Join(strings.Fields(value), " ")
}

func isBlank(value *string) bool {
	return value == nil || strings.TrimSpace(*value) == ""
}

func nullString(value *string) sql.NullString {
	if value == nil || *value == "" {
		return sql.NullString{String: "", Valid: false}
	}

	return sql.NullString{String: *value, Valid: true}
}

func nullInt(value *int64) sql.NullInt64 {
	if value == nil {
		return sql.NullInt64{Int64: 0, Valid: false}
	}

	return sql.NullInt64{Int64: *value, Valid: true}
}

func clientReferenceError(err error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	return api.Error(api.ErrorTypeFromSQL(err), err)
}
