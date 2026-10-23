package auth

import (
	"encoding/json"
	"errors"
	"hash/fnv"
	"slices"
	"sync"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/utils/v2"
	"github.com/google/uuid"

	"dwb-courses/internal/api"
)

const (
	sessionKey         = "user_session"
	sessionTokenLength = 64
	rotateLockShards   = 64
)

// rotateLocks serializes rotation per token shard so concurrent requests with
// the same cookie cannot each mint a token, without blocking other sessions.
var rotateLocks [rotateLockShards]sync.Mutex

func rotateLockFor(token string) *sync.Mutex {
	h := fnv.New32a()
	_, _ = h.Write([]byte(token))

	return &rotateLocks[h.Sum32()%rotateLockShards]
}

var validRoles = []Role{RoleReader, RoleWriter, RoleAdmin}

// Permission is a single granular access right.
type Permission string

// Known Permission values.
const (
	PermissionRead  Permission = "READ"
	PermissionWrite Permission = "WRITE"
	PermissionAdmin Permission = "ADMIN"
)

// Role is a user's assigned access level.
type Role string

// Known Role values.
const (
	RoleReader Role = "READER"
	RoleWriter Role = "WRITER"
	RoleAdmin  Role = "ADMIN"
)

func (r Role) getPermissions() []Permission {
	switch r {
	case RoleReader:
		return []Permission{PermissionRead}
	case RoleWriter:
		return []Permission{PermissionRead, PermissionWrite}
	case RoleAdmin:
		return []Permission{PermissionRead, PermissionWrite, PermissionAdmin}
	}

	return []Permission{}
}

func (r Role) hasPermission(perm Permission) bool {
	return slices.Contains(r.getPermissions(), perm)
}

func (r Role) isValid() bool {
	return slices.Contains(validRoles, r)
}

// UserSession holds the session data retrieved from cache.
type UserSession struct {
	UserID    uuid.UUID `json:"userId"`
	Role      Role      `json:"role"`
	CreatedAt time.Time `json:"createdAt"`
	UserAgent string    `json:"userAgent"`
	IP        string    `json:"ip"`
}

// GetSessionLocals returns the session stored in fiber locals.
func GetSessionLocals(c fiber.Ctx) (UserSession, bool) {
	session, ok := c.Locals(sessionKey).(UserSession)

	return session, ok
}

func setSessionLocals(c fiber.Ctx, sess UserSession) {
	c.Locals(sessionKey, sess)
}

func getSessionCookie(c fiber.Ctx, srv api.Server) (UserSession, error) {
	token := utils.CopyString(c.Cookies(srv.Cfg().Auth.CookieName))
	if token == "" {
		return UserSession{}, errors.New("empty session token")
	}

	rawUserData, err := srv.Storage().Get(tokenKey(token))
	if err != nil || rawUserData == nil {
		return UserSession{}, errors.New("did not find valid session")
	}

	var session UserSession

	err = json.Unmarshal(rawUserData, &session)
	if err != nil {
		return UserSession{}, err
	}

	return session, nil
}

// isValid checks the IP and UserAgent.
// Does NOT check createdAt.
func (sess UserSession) isValid(c fiber.Ctx) bool {
	if c.UserAgent() != sess.UserAgent {
		return false
	}

	if c.IP() != sess.IP {
		return false
	}

	return sess.Role.hasPermission(PermissionRead)
}

// save stores the user session in cookies, storage and locals. If a concurrent
// request already rotated this session's token, save is a no-op.
func (sess UserSession) save(c fiber.Ctx, srv api.Server) error {
	oldToken := utils.CopyString(c.Cookies(srv.Cfg().Auth.CookieName))

	lock := rotateLockFor(oldToken)
	lock.Lock()
	defer lock.Unlock()

	_ = revokeSession(c, srv)

	name := srv.Cfg().Auth.CookieName
	token := utils.GenerateSecureToken(sessionTokenLength)
	maxAge := srv.Cfg().Auth.CookieMaxAge

	c.Cookie(
		//exhaustruct:ignore
		&fiber.Cookie{
			Name:     name,
			Value:    token,
			Path:     "/",
			SameSite: "Strict",
			MaxAge:   int(maxAge.Seconds()),
			Secure:   true,
			HTTPOnly: true,
		})

	sessionData, err := json.Marshal(sess)
	if err != nil {
		return err
	}

	if err := srv.Storage().
		Set(tokenKey(token), sessionData, maxAge); err != nil {
		return err
	}

	return nil
}

// revokeSession deletes the user session from cookies, storage and locals.
// Skips if no session currently exists.
func revokeSession(c fiber.Ctx, srv api.Server) error {
	token := utils.CopyString(c.Cookies(srv.Cfg().Auth.CookieName))
	if token == "" {
		return nil
	}

	err := srv.Storage().Delete(tokenKey(token))
	if err != nil {
		return err
	}

	name := srv.Cfg().Auth.CookieName
	c.Cookie(
		//exhaustruct:ignore
		&fiber.Cookie{
			Name:     name,
			Path:     "/",
			SameSite: "Strict",
			MaxAge:   -1,
			Expires:  api.FromUnix(0),
			Secure:   true,
			HTTPOnly: true,
		})
	c.ClearCookie(name)

	return nil
}

func tokenKey(token string) string {
	return sessionKey + ":" + token
}
