package registration

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
)

const (
	csvDateLayout   = "02/01/2006"
	csvUTCOffset    = -5 * time.Hour
	csvCentsPerUnit = 100
)

var (
	csvLocation = time.FixedZone("UTC-5", int(csvUTCOffset/time.Second))
	csvColumns  = []string{
		"Nombre completo",
		"Curso",
		"Tipo de documento",
		"Número de documento",
		"Estado",
		"Moneda",
		"Total",
		"Saldo",
		"Creada",
	}
	csvStatusLabels = map[string]string{
		statusDraft:             "Borrador",
		statusPending:           "Pendiente",
		statusPartiallyPaid:     "Pago parcial",
		statusPaid:              "Pagado",
		statusPartiallyRefunded: "Reembolso parcial",
		statusRefunded:          "Reembolsado",
		statusCancelled:         "Cancelado",
	}
)

// AdminExport returns the filtered registrations as a CSV download for staff.
func (s server) AdminExport(c fiber.Ctx) error {
	var params listParams
	if err := c.Bind().Query(&params); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	args, err := exportRegistrationsArgs(params)
	if err != nil {
		return err
	}

	ctx, cancel := s.Cfg().LgCtx(c)
	defer cancel()

	rows, err := database.New(s.DB()).ExportRegistrations(ctx, args)
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	body, err := registrationCSV(rows)
	if err != nil {
		return api.Error(api.ErrorTypeUnexpected, err)
	}

	c.Attachment("inscripciones.csv")
	c.Set(fiber.HeaderContentType, "text/csv; charset=utf-8")

	return c.Send(body)
}

func exportRegistrationsArgs(
	params listParams,
) (database.ExportRegistrationsParams, error) {
	filters, err := registrationFiltersFromParams(params)
	if err != nil {
		return database.ExportRegistrationsParams{}, err
	}

	return database.ExportRegistrationsParams{
		FormID:   filters.FormID,
		Statuses: filters.Statuses,
		Search:   filters.Search,
	}, nil
}

func registrationCSV(rows []database.ExportRegistrationsRow) ([]byte, error) {
	var buffer bytes.Buffer
	buffer.WriteString("\uFEFF")

	writer := csv.NewWriter(&buffer)

	if err := writer.Write(csvColumns); err != nil {
		return nil, err
	}

	for _, row := range rows {
		if err := writer.Write(csvRegistrationRow(row)); err != nil {
			return nil, err
		}
	}

	writer.Flush()

	if err := writer.Error(); err != nil {
		return nil, err
	}

	return buffer.Bytes(), nil
}

func csvRegistrationRow(row database.ExportRegistrationsRow) []string {
	return []string{
		row.FirstName + " " + row.LastName,
		row.FormTitle,
		row.IDTypeLabel,
		row.DocumentNumber,
		csvStatusLabel(row.Status),
		row.CurrencyCode,
		formatCSVCents(row.TotalAmountCents),
		formatCSVCents(row.TotalAmountCents - row.AmountPaidCents),
		api.FromUnix(row.CreatedAt).In(csvLocation).Format(csvDateLayout),
	}
}

func csvStatusLabel(status string) string {
	if label, ok := csvStatusLabels[status]; ok {
		return label
	}

	return status
}

func formatCSVCents(cents int64) string {
	sign := ""
	if cents < 0 {
		sign = "-"
		cents = -cents
	}

	return fmt.Sprintf(
		"%s%d.%02d",
		sign,
		cents/csvCentsPerUnit,
		cents%csvCentsPerUnit,
	)
}
