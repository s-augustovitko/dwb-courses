package auth

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
)

type logInRequest struct {
	Email    string `json:"email"    validate:"required,lowercase,email,ascii,max=254"`
	Password string `json:"password" validate:"required,max=255"`
}

// LogIn authenticates a user and starts a new session.
func (s server) LogIn(c fiber.Ctx) error {
	var body logInRequest
	if err := c.Bind().Body(&body); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	ctx, cancel := s.Cfg().SmCtx(c)
	defer cancel()

	user, err := database.New(s.DB()).GetUserByEmail(ctx, body.Email)
	if err != nil {
		// Compare against a dummy hash so a missing email takes as long as a
		// wrong password, preventing user enumeration via response timing.
		_, _ = compareHash(dummyHash, body.Password)

		return api.Error(api.ErrorTypeInvalidLogin, err)
	}

	isValidPass, err := compareHash(user.PasswordHash, body.Password)
	if err != nil || !isValidPass {
		return api.Error(api.ErrorTypeInvalidLogin, err)
	}

	userID := api.UUIDFromBytes(user.ID)

	role := Role(user.Role)
	if !role.isValid() {
		return api.Error(api.ErrorTypeUnexpected, nil)
	}

	session := UserSession{
		UserID:    userID,
		Role:      role,
		CreatedAt: api.Now(),
		UserAgent: c.UserAgent(),
		IP:        c.IP(),
	}

	if err := session.save(c, s); err != nil {
		return api.Error(api.ErrorTypeUnexpected, err)
	}

	return api.Success(c, true)
}
