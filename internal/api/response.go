package api

import (
	"errors"

	"github.com/gofiber/fiber/v3"
	"github.com/rs/zerolog"
)

// Response is the standard JSON response envelope.
type Response[T any] struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    T      `json:"data"`
}

// Success writes a successful JSON response.
func Success[T any](c fiber.Ctx, data T) error {
	return c.JSON(Response[T]{Success: true, Message: "Success", Data: data})
}

// AppError is an error that carries an HTTP status code.
type AppError struct {
	Code    int
	Message string
	Err     error
}

func (e AppError) Error() string {
	return e.Message
}

// Send writes the error as a JSON response.
func (e AppError) Send(c fiber.Ctx) error {
	return c.Status(e.Code).JSON(Response[any]{
		Success: false,
		Message: e.Message,
		Data:    nil,
	})
}

// Error builds an AppError for the given type and cause.
func Error(typ ErrorType, err error) AppError {
	return AppError{Code: typ.Code(), Message: string(typ), Err: err}
}

// ErrorLoggerDict builds a structured log entry for an error and its cause.
func ErrorLoggerDict(err error) *zerolog.Event {
	errDict := zerolog.Dict().Str("message", err.Error())

	if e, ok := errors.AsType[AppError](err); ok && e.Err != nil {
		errDict.Str("err_message", e.Err.Error())
	}

	return errDict
}
