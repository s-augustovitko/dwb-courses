package auth

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
)

// Guard is the only way to register a handler on an authenticated route.
func Guard(
	s api.Server,
	requiredPerm Permission,
	handler fiber.Handler,
) fiber.Handler {
	return func(c fiber.Ctx) error {
		session, err := authorize(c, s, requiredPerm)
		if err != nil {
			return err
		}

		setSessionLocals(c, session)

		return handler(c)
	}
}

// authorize validates the session, checks requiredPerm and refreshes it.
func authorize(
	c fiber.Ctx,
	s api.Server,
	requiredPerm Permission,
) (UserSession, error) {
	session, err := authenticate(c, s)
	if err != nil {
		return UserSession{}, err
	}

	// Recheck role and rotate the session, throttled by RefreshRate
	needsRefresh := api.Now().
		After(session.CreatedAt.Add(s.Cfg().Auth.RefreshRate))
	if needsRefresh {
		role, err := refreshRole(c, s, session.UserID)
		if err != nil {
			return UserSession{}, err
		}

		session.Role = role
	}

	if !session.Role.hasPermission(requiredPerm) {
		return UserSession{}, api.Error(api.ErrorTypePermission, nil)
	}

	if needsRefresh {
		session.CreatedAt = api.Now()
		if err := session.save(c, s); err != nil {
			return UserSession{}, api.Error(api.ErrorTypeUnexpected, err)
		}
	}

	return session, nil
}

// authenticate loads the session from its cookie, revoking it if invalid.
func authenticate(c fiber.Ctx, s api.Server) (UserSession, error) {
	session, err := getSessionCookie(c, s)
	if err != nil {
		revokeSessionAndLog(c, s)

		return UserSession{}, api.Error(api.ErrorTypeUnauthorized, err)
	}

	if !session.isValid(c) {
		revokeSessionAndLog(c, s)

		return UserSession{}, api.Error(api.ErrorTypeUnauthorized, nil)
	}

	return session, nil
}

// refreshRole re-fetches the session's role from the DB, revoking on failure.
func refreshRole(
	c fiber.Ctx,
	s api.Server,
	userID uuid.UUID,
) (Role, error) {
	ctx, cancel := s.Cfg().SmCtx(c)
	defer cancel()

	user, err := database.New(s.DB()).GetUserById(ctx, userID[:])
	if err != nil {
		revokeSessionAndLog(c, s)

		return "", api.Error(api.ErrorTypeFromSQL(err), err)
	}

	return Role(user.Role), nil
}

// revokeSessionAndLog revokes the session, logging any storage error.
func revokeSessionAndLog(c fiber.Ctx, s api.Server) {
	if err := revokeSession(c, s); err != nil {
		s.Logger(c).Error().Err(err).Msg("Could not revoke session")
	}
}
