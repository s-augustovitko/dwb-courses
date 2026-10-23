package api

import (
	"database/sql"

	"github.com/gofiber/fiber/v3"
	"github.com/rs/zerolog"

	"dwb-courses/internal/config"
	"dwb-courses/internal/database"
)

// Server exposes the shared dependencies used by route handlers.
type Server interface {
	DB() database.DBTX
	DBConn() *sql.DB
	Storage() fiber.Storage
	Cfg() *config.Config
	Mailer() *config.Mailer

	Ready(c fiber.Ctx) bool
	Logger(c fiber.Ctx) *zerolog.Logger
}

// MailDeps exposes the dependencies for emails.
type MailDeps interface {
	Cfg() *config.Config
	Mailer() *config.Mailer
}
