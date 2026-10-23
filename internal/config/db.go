package config

import (
	"context"
	"database/sql"
	"time"

	// registers the sqlite3 database/sql driver.
	_ "github.com/mattn/go-sqlite3"
)

const (
	connMaxLifetime = 30 * time.Minute
	connMaxIdleTime = 10 * time.Minute
)

// InitDB opens and configures the SQLite connection pool.
func InitDB(cfg *Config) (*sql.DB, error) {
	// WAL with a busy timeout so concurrent readers/writers don't fail outright
	dsn := cfg.Database.Host + "?" +
		"_journal=WAL" +
		"&_synchronous=NORMAL" +
		"&_busy_timeout=5000" +
		"&_txlock=immediate" +
		"&_foreign_keys=true" +
		"&_vacuum=incremental"

	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(cfg.Database.MaxConnections)
	db.SetMaxIdleConns(cfg.Database.MaxConnections)
	db.SetConnMaxLifetime(connMaxLifetime)
	db.SetConnMaxIdleTime(connMaxIdleTime)

	// Verify the connection is actually usable before returning it
	ctx, cancel := cfg.SmCtx(context.Background())
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		return nil, err
	}

	return db, nil
}
