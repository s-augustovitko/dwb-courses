package user

import (
	"time"

	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/auth"
	"dwb-courses/internal/database"
)

type listResponse struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Role      auth.Role `json:"role"`
	CreatedAt time.Time `json:"createdAt"`
}

func listResFromDB(user database.ListUsersRow) listResponse {
	return listResponse{
		ID:        api.UUIDString(user.ID),
		Name:      user.Name,
		Email:     user.Email,
		Role:      auth.Role(user.Role),
		CreatedAt: api.FromUnix(user.CreatedAt),
	}
}

// List returns every user, without their password hash.
func (s server) List(c fiber.Ctx) error {
	ctx, cancel := s.Cfg().SmCtx(c)
	defer cancel()

	users, err := database.New(s.DB()).ListUsers(ctx)
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	out := make([]listResponse, 0, len(users))
	for _, user := range users {
		out = append(out, listResFromDB(user))
	}

	return api.Success(c, out)
}
