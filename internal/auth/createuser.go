package auth

import (
	"context"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/utils/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
)

const tempPasswordLength = 12

var userValidator = validator.New()

type (
	// CreateUserRequest is the request body for creating a user.
	CreateUserRequest struct {
		Name  string `json:"name"  validate:"required,max=100"`
		Email string `json:"email" validate:"required,lowercase,email,ascii,max=254"`
		Role  Role   `json:"role"  validate:"required,oneof=READER WRITER ADMIN"`
	}

	createUserResponse struct {
		ID        string    `json:"id"`
		Name      string    `json:"name"`
		Email     string    `json:"email"`
		Role      Role      `json:"role"`
		CreatedAt time.Time `json:"createdAt"`
	}
)

// CreateUser handles admin-created users.
func (s server) CreateUser(c fiber.Ctx) error {
	var body CreateUserRequest
	if err := c.Bind().Body(&body); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	user, err := CreateUser(s, body, s.Logger(c))
	if err != nil {
		return err
	}

	return api.Success(c, createUserResponse{
		ID:        api.UUIDString(user.ID),
		Name:      user.Name,
		Email:     user.Email,
		Role:      Role(user.Role),
		CreatedAt: api.FromUnix(user.CreatedAt),
	})
}

// CreateUser creates a user and sends an email with the password.
// Returns error of type api.Error.
func CreateUser(
	srv api.Server,
	data CreateUserRequest,
	logger *zerolog.Logger,
) (database.CreateUserRow, error) {
	if err := userValidator.Struct(data); err != nil {
		return database.CreateUserRow{}, api.Error(api.ErrorTypeBadRequest, err)
	}

	userID, err := uuid.NewV7()
	if err != nil {
		return database.CreateUserRow{}, api.Error(api.ErrorTypeUnexpected, err)
	}

	pass := utils.GenerateSecureToken(tempPasswordLength)

	hashPass, err := defaultHash.HashPassword(pass)
	if err != nil {
		return database.CreateUserRow{}, api.Error(api.ErrorTypeUnexpected, err)
	}

	ctx, cancel := srv.Cfg().MdCtx(context.Background())
	defer cancel()

	user, err := database.
		New(srv.DB()).
		CreateUser(ctx, database.CreateUserParams{
			ID:           userID[:],
			Name:         data.Name,
			Email:        data.Email,
			Role:         string(data.Role),
			PasswordHash: hashPass,
		})
	if err != nil {
		return database.CreateUserRow{}, api.Error(
			api.ErrorTypeFromSQL(err),
			err,
		)
	}

	if err := sendCredentials(srv, user, pass, logger); err != nil {
		return database.CreateUserRow{}, err
	}

	return user, nil
}

func sendCredentials(
	srv api.Server,
	user database.CreateUserRow,
	pass string,
	logger *zerolog.Logger,
) error {
	err := sendCreateUserEmail(srv, emailDataCreateUser{
		Email:    user.Email,
		Name:     user.Name,
		Password: pass,
	})
	if err == nil {
		return nil
	}

	// A fresh context: the send may have outlived the one used for the insert.
	ctx, cancel := srv.Cfg().MdCtx(context.Background())
	defer cancel()

	delErr := database.New(srv.DB()).DeleteUser(ctx, user.ID)
	if delErr != nil {
		logger.Error().
			Err(delErr).
			Msg("remove user after failed credentials email")
	}

	return api.Error(api.ErrorTypeEmailSend, err)
}
