package validate

import "github.com/google/uuid"

// MinLetterDocumentLen is the shortest document number an id type that allows
// letters can hold.
const MinLetterDocumentLen = 6

// IDPath is a UUID identifier bound from the :id route param.
type IDPath struct {
	ID uuid.UUID `json:"id" uri:"id" validate:"required,uuid"`
}

// OrderField is a one-or-greater sort-order value.
type OrderField struct {
	Order int64 `json:"order" validate:"required,min=1,max=1000000"`
}

// OrderItem is a UUID identifier paired with its new sort order, used for
// reorder-request array items.
type OrderItem struct {
	OrderField

	ID uuid.UUID `json:"id" validate:"required,uuid"`
}

// WithFormPath is a UUID identifier bound from the :formId route param.
type WithFormPath struct {
	FormID uuid.UUID `json:"formId" uri:"formId" validate:"required,uuid"`
}

// FormItemPath is a UUID identifier and its form, bound from the :id and
// :formId route params.
type FormItemPath struct {
	IDPath
	WithFormPath
}

// CurrencyCodeField is an ISO 4217 currency code, bound from the JSON body or
// the :code route param.
type CurrencyCodeField struct {
	Code string `json:"code" uri:"code" validate:"required,iso4217"`
}

// PriceField is a currencyCode and amountCents fields.
type PriceField struct {
	CurrencyCode string `json:"currencyCode" validate:"required,iso4217"`
	AmountCents  int64  `json:"amountCents"  validate:"min=0,max=100000000"`
}
