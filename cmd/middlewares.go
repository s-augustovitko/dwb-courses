package main

import (
	"errors"
	"fmt"
	"runtime/debug"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/healthcheck"
	"github.com/gofiber/fiber/v3/middleware/helmet"
	"github.com/gofiber/fiber/v3/middleware/hostauthorization"
	rcvr "github.com/gofiber/fiber/v3/middleware/recover"
	"github.com/gofiber/fiber/v3/middleware/requestid"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"dwb-courses/internal/api"
	"dwb-courses/internal/config"
)

const loggerKey = "logger"

var logSkipURLs = map[string]bool{
	"/api/v1" + healthcheck.ReadinessEndpoint: true,
	"/api/v1" + healthcheck.LivenessEndpoint:  true,
}

const (
	hstsMaxAgeSeconds     = 365 * 24 * 60 * 60
	contentSecurityPolicy = "default-src 'self'; frame-ancestors 'none'; " +
		"object-src 'none'; base-uri 'self'"
)

func setupMiddlewares(
	app *fiber.App,
	cfg *config.Config,
	storage fiber.Storage,
) {
	app.Use(
		// Stability and Security
		requestid.New(),
		loggerMiddleware(),
		rcvr.New(rcvr.Config{
			EnableStackTrace:  true,
			Next:              nil,
			PanicHandler:      rcvr.DefaultPanicHandler,
			StackTraceHandler: logPanicStack,
		}),
		helmet.New(
			//exhaustruct:ignore
			helmet.Config{
				XFrameOptions:         "DENY",
				ContentSecurityPolicy: contentSecurityPolicy,
				HSTSMaxAge:            hstsMaxAgeSeconds,
			}),
		cors.New(cors.Config{
			AllowMethods: cfg.Cors.Methods,
			AllowOrigins: cfg.Cors.Origins,
			AllowHeaders: cfg.Cors.Headers,

			// Default
			AllowCredentials:      true,
			Next:                  nil,
			AllowOriginsFunc:      nil,
			ExposeHeaders:         []string{},
			MaxAge:                0,
			DisableValueRedaction: false,
			AllowPrivateNetwork:   false,
		}),
		// Logging
		// Global rate limit - per IP, max set by rate_limit.global_ip
		api.KeyedRateLimiter(
			storage,
			cfg.RateLimit.GlobalIP,
			func(c fiber.Ctx) string {
				return "global_limit:" + c.IP()
			},
		),
		hostauthorization.New(hostauthorization.Config{
			AllowedHosts:     cfg.Service.Hosts,
			Next:             nil,
			AllowedHostsFunc: nil,
			ErrorHandler: func(_ fiber.Ctx, err error) error {
				return api.Error(api.ErrorTypeBadRequest, err)
			},
		}),
	)
}

func requestLogger(c fiber.Ctx) *zerolog.Logger {
	if logger, ok := c.Locals(loggerKey).(*zerolog.Logger); ok {
		return logger
	}

	return &log.Logger
}

func logPanicStack(c fiber.Ctx, r any) {
	requestLogger(c).Error().
		Str("panic", fmt.Sprint(r)).
		Str("stack", string(debug.Stack())).
		Msg("recovered panic")
}

// loggerMiddleware logs each request/response, skipping healthcheck endpoints.
func loggerMiddleware() fiber.Handler {
	return func(c fiber.Ctx) error {
		if logSkipURLs[c.Path()] {
			return c.Next()
		}

		start := time.Now() //nolint:forbidigo // latency only; keeps monotonic clock

		reqDict := zerolog.Dict().
			Str("id", requestid.FromContext(c)).
			Str("method", c.Method()).
			Str("host", c.Host()).
			Str("ip", c.IP()).
			Str("userAgent", c.UserAgent())

		ctxLogger := log.With().Dict("request", reqDict).Logger()
		c.Locals(loggerKey, &ctxLogger)

		err := c.Next()
		route := c.Route().Path
		status := c.Response().StatusCode()

		// The error handler runs after this middleware returns, so derive the
		// status it will send.
		if err != nil {
			status = errorStatus(err)
		}

		resDict := zerolog.Dict().
			Dur("latency", time.Since(start)).
			Int("status", status)

		if err != nil {
			level := zerolog.WarnLevel
			if status >= fiber.StatusInternalServerError {
				level = zerolog.ErrorLevel
			}

			ctxLogger.WithLevel(level).
				Str("route", route).
				Dict("error", api.ErrorLoggerDict(err)).
				Dict("response", resDict).
				Msg("error processing HTTP request")
		} else {
			// Error bodies are written after this middleware returns, so only
			// success lines know the size.
			resDict.Int("responseSize", c.Response().Header.ContentLength())
			ctxLogger.Info().
				Str("route", route).
				Dict("response", resDict).
				Msg("HTTP request processed")
		}

		return err
	}
}

func errorStatus(err error) int {
	if appErr, ok := errors.AsType[api.AppError](err); ok {
		return appErr.Code
	}

	if fiberErr, ok := errors.AsType[*fiber.Error](err); ok {
		return fiberErr.Code
	}

	return fiber.StatusInternalServerError
}
