package main

import (
	"database/sql"

	"github.com/gofiber/fiber/v3"
	"github.com/rs/zerolog"

	"dwb-courses/internal/config"
	"dwb-courses/internal/database"
)

type server struct {
	db      *sql.DB
	storage fiber.Storage
	cfg     *config.Config
	mailer  *config.Mailer
}

func (s server) DB() database.DBTX {
	return s.db
}

func (s server) DBConn() *sql.DB {
	return s.db
}

func (s server) Storage() fiber.Storage {
	return s.storage
}

func (s server) Cfg() *config.Config {
	return s.cfg
}

func (s server) Mailer() *config.Mailer {
	return s.mailer
}

// Logger returns the request-scoped logger.
func (s server) Logger(c fiber.Ctx) *zerolog.Logger {
	return requestLogger(c)
}

// Ready reports whether all dependencies are initialized and reachable.
func (s server) Ready(c fiber.Ctx) bool {
	ctx, cancel := s.Cfg().SmCtx(c)
	defer cancel()

	return s.db != nil &&
		s.storage != nil &&
		s.cfg != nil &&
		s.mailer != nil &&
		s.db.PingContext(ctx) == nil
}
