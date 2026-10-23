package api

import (
	"database/sql"
	"errors"

	"github.com/gofiber/fiber/v3"
	"github.com/mattn/go-sqlite3"
)

// ErrorType categorizes errors for HTTP status-code mapping.
type ErrorType string

// Known ErrorType values.
const (
	ErrorTypeInvalidLogin ErrorType = "INVALID_LOGIN"
	ErrorTypeBadRequest   ErrorType = "BAD_REQUEST"
	ErrorTypeUnexpected   ErrorType = "UNEXPECTED"
	ErrorTypeUnauthorized ErrorType = "UNAUTHORIZED"
	ErrorTypePermission   ErrorType = "PERMISSION"
	ErrorTypeDuplicate    ErrorType = "DUPLICATE"
	ErrorTypeEmailSend    ErrorType = "EMAIL_SEND"
	ErrorTypeRateLimit    ErrorType = "RATE_LIMIT"
	ErrorTypeLastAdmin    ErrorType = "LAST_ADMIN"
	ErrorTypeNotFound     ErrorType = "NOT_FOUND"
	ErrorTypeConflict     ErrorType = "CONFLICT"
)

// Code maps an ErrorType to its HTTP status code.
func (e ErrorType) Code() int {
	switch e {
	case ErrorTypeUnauthorized, ErrorTypeInvalidLogin:
		return fiber.StatusUnauthorized
	case ErrorTypePermission:
		return fiber.StatusForbidden
	case ErrorTypeBadRequest, ErrorTypeDuplicate, ErrorTypeLastAdmin:
		return fiber.StatusBadRequest
	case ErrorTypeNotFound:
		return fiber.StatusNotFound
	case ErrorTypeConflict:
		return fiber.StatusConflict
	case ErrorTypeUnexpected, ErrorTypeEmailSend:
		return fiber.StatusInternalServerError
	case ErrorTypeRateLimit:
		return fiber.StatusTooManyRequests
	}

	return fiber.StatusInternalServerError
}

// ErrorTypeFromSQL maps a SQL error to an ErrorType.
func ErrorTypeFromSQL(err error) ErrorType {
	if errors.Is(err, sql.ErrNoRows) {
		return ErrorTypeNotFound
	}

	if sqliteErr, ok := errors.AsType[sqlite3.Error](err); ok {
		switch sqliteErr.ExtendedCode {
		case sqlite3.ErrConstraintUnique, sqlite3.ErrConstraintPrimaryKey:
			return ErrorTypeDuplicate
		case sqlite3.ErrConstraintForeignKey, sqlite3.ErrConstraintTrigger:
			// An unknown referenced id, or (ON DELETE RESTRICT, reported as a
			// trigger) a row still in use.
			return ErrorTypeBadRequest
		}
	}

	return ErrorTypeUnexpected
}

// ErrorHandler is the Fiber error handler. The message is always an ErrorType,
// which the SPA translates.
func ErrorHandler(c fiber.Ctx, err error) error {
	appErr, isAppErr := errors.AsType[AppError](err)
	if !isAppErr {
		appErr = AppError{
			Code:    fiber.StatusInternalServerError,
			Message: string(ErrorTypeUnexpected),
			Err:     err,
		}

		if fiberErr, ok := errors.AsType[*fiber.Error](err); ok {
			appErr.Code = fiberErr.Code
			appErr.Message = string(fiberErrorType(fiberErr.Code))
		}
	}

	return appErr.Send(c)
}

func fiberErrorType(code int) ErrorType {
	switch {
	case code == fiber.StatusNotFound, code == fiber.StatusMethodNotAllowed:
		return ErrorTypeNotFound
	case code == fiber.StatusTooManyRequests:
		return ErrorTypeRateLimit
	case code >= fiber.StatusBadRequest &&
		code < fiber.StatusInternalServerError:
		return ErrorTypeBadRequest
	}

	return ErrorTypeUnexpected
}
