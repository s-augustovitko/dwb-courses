package registration

import (
	"context"
	"database/sql"
	"time"

	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/validate"
)

type paymentLine struct {
	Method            string    `json:"method"`
	AmountCents       int64     `json:"amountCents"`
	ProviderReference string    `json:"providerReference"`
	Note              string    `json:"note"`
	CreatedAt         time.Time `json:"createdAt"`
}

type staffResponse struct {
	orderLines

	OrderID      string     `json:"orderId"`
	FormID       string     `json:"formId"`
	FormTitle    string     `json:"formTitle"`
	Status       string     `json:"status"`
	Audience     string     `json:"audience"`
	CurrencyCode string     `json:"currencyCode"`
	TotalCents   int64      `json:"totalCents"`
	PaidCents    int64      `json:"paidCents"`
	BalanceCents int64      `json:"balanceCents"`
	CancelledAt  *time.Time `json:"cancelledAt"`

	PaymentPending bool `json:"paymentPending"`

	FirstName         string `json:"firstName"`
	LastName          string `json:"lastName"`
	IDTypeID          string `json:"idTypeId"`
	IDTypeLabel       string `json:"idTypeLabel"`
	DocumentNumber    string `json:"documentNumber"`
	Email             string `json:"email"`
	CountryCode       string `json:"countryCode"`
	PhoneNumber       string `json:"phoneNumber"`
	DietaryPreference string `json:"dietaryPreference"`

	ArrivalDate           *time.Time `json:"arrivalDate"`
	DepartureDate         *time.Time `json:"departureDate"`
	InsuranceProvider     string     `json:"insuranceProvider"`
	InsurancePolicyNumber string     `json:"insurancePolicyNumber"`

	EmergencyContactName        string `json:"emergencyContactName"`
	EmergencyContactPhone       string `json:"emergencyContactPhone"`
	EmergencyContactCountryCode string `json:"emergencyContactCountryCode"`
	EmergencyContactEmail       string `json:"emergencyContactEmail"`

	Payments []paymentLine `json:"payments"`
}

// AdminGet returns the full registration for logged-in staff, as opened from
// the QR code.
func (s server) AdminGet(c fiber.Ctx) error {
	var params validate.IDPath
	if err := c.Bind().URI(&params); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	out, err := staffView(
		ctx,
		database.New(s.DB()),
		params.ID[:],
	)
	if err != nil {
		return err
	}

	return api.Success(c, out)
}

// staffView loads the full registration for the staff screens; every admin
// action returns it.
func staffView(
	ctx context.Context,
	q *database.Queries,
	orderID []byte,
) (staffResponse, error) {
	order, err := q.GetOrderById(ctx, orderID)
	if err != nil {
		return staffResponse{}, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	sub, form, err := loadSubmissionAndForm(ctx, q, order)
	if err != nil {
		return staffResponse{}, err
	}

	idType, err := q.GetIdTypeById(ctx, sub.IDTypeID)
	if err != nil {
		return staffResponse{}, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	lines, err := loadLines(ctx, q, order.ID)
	if err != nil {
		return staffResponse{}, err
	}

	payments, err := q.ListPaymentsByOrder(ctx, order.ID)
	if err != nil {
		return staffResponse{}, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	return newStaffResponse(order, sub, form, idType, lines, payments), nil
}

func newStaffResponse(
	order database.GetOrderByIdRow,
	sub database.Submission,
	form database.Form,
	idType database.IDType,
	lines orderLines,
	payments []database.Payment,
) staffResponse {
	return staffResponse{
		OrderID:      api.UUIDString(order.ID),
		FormID:       api.UUIDString(sub.FormID),
		FormTitle:    form.Title,
		Status:       order.Status,
		Audience:     sub.Audience,
		CurrencyCode: order.CurrencyCode,
		TotalCents:   order.TotalAmountCents,
		PaidCents:    order.AmountPaidCents,
		BalanceCents: order.TotalAmountCents - order.AmountPaidCents,
		CancelledAt:  nullUnixToTime(sub.CancelledAt),
		PaymentPending: paymentPending(
			order.PaymentPendingAt),
		FirstName:                   sub.FirstName,
		LastName:                    sub.LastName,
		IDTypeID:                    api.UUIDString(idType.ID),
		IDTypeLabel:                 idType.Label,
		DocumentNumber:              sub.DocumentNumber,
		Email:                       sub.Email,
		CountryCode:                 sub.CountryCode,
		PhoneNumber:                 sub.PhoneNumber,
		DietaryPreference:           sub.DietaryPreference.String,
		InsuranceProvider:           sub.InsuranceProvider.String,
		InsurancePolicyNumber:       sub.InsurancePolicyNumber.String,
		EmergencyContactName:        sub.EmergencyContactName.String,
		EmergencyContactPhone:       sub.EmergencyContactPhone.String,
		EmergencyContactCountryCode: sub.EmergencyContactCountryCode.String,
		EmergencyContactEmail:       sub.EmergencyContactEmail.String,
		ArrivalDate:                 nullUnixToTime(sub.ArrivalDate),
		DepartureDate:               nullUnixToTime(sub.DepartureDate),
		Payments:                    paymentLines(payments),
		orderLines:                  lines,
	}
}

func paymentLines(payments []database.Payment) []paymentLine {
	out := make([]paymentLine, len(payments))
	for i, payment := range payments {
		out[i] = paymentLine{
			Method:            payment.Method,
			AmountCents:       payment.AmountCents,
			ProviderReference: payment.ProviderReference.String,
			Note:              payment.Note.String,
			CreatedAt:         api.FromUnix(payment.CreatedAt),
		}
	}

	return out
}

func nullUnixToTime(value sql.NullInt64) *time.Time {
	if !value.Valid {
		return nil
	}

	parsed := api.FromUnix(value.Int64)

	return &parsed
}
