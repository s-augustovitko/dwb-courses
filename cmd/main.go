package main

import (
	"context"
	"flag"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/storage/ristretto/v2"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"dwb-courses/internal/api"
	"dwb-courses/internal/auth"
	"dwb-courses/internal/config"
	"dwb-courses/internal/countries"
	"dwb-courses/internal/database"
	"dwb-courses/internal/jobs"
	"dwb-courses/internal/validate"
)

const (
	// Ristretto cache sizing; see the MaxCost note above.
	cacheNumCounters = 5e5
	cacheMaxCostByte = 50 << 20
	cacheBufferItems = 64

	bodyLimitBytes = 4 << 20
)

func main() {
	if err := run(); err != nil {
		os.Exit(1)
	}
}

// run wires up dependencies and serves until shutdown; all defers below run
// before it returns, unlike log.Fatal which would skip them via os.Exit.
func run() error {
	time.Local = time.UTC //nolint:gosmopolitan // forces UTC on purpose

	var configPath string
	flag.StringVar(&configPath, "config", "", "config file path")
	flag.Parse()

	cfg, err := config.Load(configPath)
	if err != nil {
		log.Error().Err(err).Msg("could not parse config")

		return err
	}

	setupLogger(cfg)
	auth.SetMaxConcurrentHashes(cfg.Auth.MaxConcurrentHashes)

	db, err := config.InitDB(cfg)
	if err != nil {
		log.Error().Err(err).Msg("could not init db")

		return err
	}
	defer logDeferredError(db.Close, "db shutdown error")

	mailer, err := config.InitMailer(cfg)
	if err != nil {
		log.Error().Err(err).Msg("could not init mailer")

		return err
	}
	defer logDeferredError(mailer.Close, "mailer shutdown error")

	catalog, err := countries.Load()
	if err != nil {
		log.Error().Err(err).Msg("could not load countries")

		return err
	}

	storage := newStorage()
	defer logDeferredError(storage.Close, "storage shutdown error")

	srv := server{
		db:      db,
		storage: storage,
		cfg:     cfg,
		mailer:  mailer,
	}

	if err := createInitialAdminOrLog(srv); err != nil {
		return err
	}

	app := newApp(cfg, srv, storage, catalog)

	shutdown := func() error { return app.ShutdownWithTimeout(cfg.Timeout.Lg) }
	defer logDeferredError(shutdown, "server shutdown error")

	defer startWorkers(srv)()

	return serve(app, cfg)
}

// startWorkers runs the background jobs and returns a function that stops them
// and waits for exit.
func startWorkers(srv server) func() {
	ctx, cancel := context.WithCancel(context.Background())

	var workers sync.WaitGroup

	workers.Go(func() { jobs.RunRegistrations(ctx, srv) })

	return func() {
		cancel()
		workers.Wait()
	}
}

func newStorage() *ristretto.Storage {
	return ristretto.New(ristretto.Config{
		NumCounters:      cacheNumCounters,
		MaxCost:          cacheMaxCostByte,
		BufferItems:      cacheBufferItems,
		DefaultCost:      0,
		SkipWaitForWrite: false,
	})
}

func setupLogger(cfg *config.Config) {
	log.Logger = zerolog.New(os.Stdout).With().Dict(
		"service",
		zerolog.Dict().
			Str("name", cfg.Service.Name).
			Str("env", cfg.Service.Env),
	).Timestamp().Logger()

	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix

	zerolog.SetGlobalLevel(zerolog.InfoLevel)
}

// newApp builds the Fiber app, wires middlewares, and registers routes.
func newApp(
	cfg *config.Config,
	srv server,
	storage fiber.Storage,
	catalog *countries.Catalog,
) *fiber.App {
	//exhaustruct:ignore
	app := fiber.New(fiber.Config{
		// Base setup
		AppName:        cfg.Service.Name,
		RequestMethods: cfg.Cors.Methods,

		ReadTimeout:  cfg.Timeout.Md,
		WriteTimeout: cfg.Timeout.Lg,
		BodyLimit:    bodyLimitBytes,

		Concurrency: cfg.Service.Concurrency,

		StructValidator: validate.StructValidator{Validator: validator.New()},

		// Error handling
		ErrorHandler: api.ErrorHandler,

		// Proxy and IP
		ProxyHeader: fiber.HeaderXForwardedFor,
		TrustProxy:  true,
		TrustProxyConfig: fiber.TrustProxyConfig{
			Private:    true,
			Proxies:    []string{},
			LinkLocal:  false,
			Loopback:   false,
			UnixSocket: false,
		},
		EnableIPValidation: true,
	})

	setupMiddlewares(app, cfg, storage)

	group := app.Group("/api/v1")
	registerRoutes(group, srv, catalog)

	app.Use(func(_ fiber.Ctx) error {
		return api.Error(api.ErrorTypeNotFound, nil)
	})

	return app
}

// serve runs the Fiber app and blocks until shutdown or a listen failure.
func serve(app *fiber.App, cfg *config.Config) error {
	errChan := make(chan error, 1)

	go func() {
		log.Info().Msg("starting server...")

		err := app.Listen(cfg.Service.Host + ":" + cfg.Service.Port)
		if err != nil {
			errChan <- err
		}
	}()

	ctx, stop := signal.NotifyContext(
		context.Background(),
		syscall.SIGINT,
		syscall.SIGTERM,
	)
	defer stop()

	var err error

	select {
	case <-ctx.Done():
		log.Info().Msg("interrupting server...")
	case err = <-errChan:
		log.Error().Err(err).Msg("server listen error")
	}

	log.Info().Msg("shutting down server...")

	return err
}

// createInitialAdminOrLog creates the first admin user if none exists yet.
func createInitialAdminOrLog(srv server) error {
	err := createInitialAdminIfNone(srv)
	if err != nil {
		log.Error().Err(err).
			Dict("error", api.ErrorLoggerDict(err)).
			Msg("could not create initial user")
	}

	return err
}

func createInitialAdminIfNone(s api.Server) error {
	ctx, cancel := s.Cfg().MdCtx(context.Background())
	defer cancel()

	adminCount, err := database.New(s.DB()).
		CountUsersByRole(ctx, string(auth.RoleAdmin))
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	if adminCount > 0 {
		return nil
	}

	_, err = auth.CreateUser(s, auth.CreateUserRequest{
		Name:  s.Cfg().DefaultUser.Name,
		Email: s.Cfg().DefaultUser.Email,
		Role:  auth.RoleAdmin,
	}, &log.Logger)
	if err != nil {
		return err
	}

	log.Info().Msg("successfully created first admin user")

	return nil
}

func logDeferredError(fnErr func() error, msg string) {
	err := fnErr()
	if err != nil {
		log.Error().Err(err).Msg(msg)
	}
}
