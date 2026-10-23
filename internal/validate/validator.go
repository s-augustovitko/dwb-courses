package validate

import "github.com/go-playground/validator/v10"

// StructValidator is the Fiber StructValidator backed by Validator.
type StructValidator struct {
	Validator *validator.Validate
}

// Validate validates a bound request struct.
func (v StructValidator) Validate(out any) error {
	return v.Validator.Struct(out)
}
