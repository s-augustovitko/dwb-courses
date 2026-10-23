.PHONY: all
all: tools deps lint migrate_up run

# Tools
DOCKER=podman

# Migrations
MIGRATION_DIR=$(CURDIR)/infra/migrations
MIGRATION_QUERIES=$(CURDIR)/infra/queries
DB_DRIVER=sqlite3
DB_STRING="file:${DB_FILE}?_journal=WAL&_synchronous=NORMAL&_busy_timeout=5000&_txlock=immediate&_foreign_keys=true&_vacuum=incremental"

# Compose / Local Dev
COMPOSE=$(CURDIR)/local/compose.yaml
DB_FILE_PATH=$(CURDIR)/local/db_data
DB_FILE=${DB_FILE_PATH}/main.db

include deploy.mk

.PHONY: tools
tools: ## Install development and migration tools
	@go install github.com/pressly/goose/v3/cmd/goose@latest
	@go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
	@go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest
	@uv tool install ansible-core --with passlib --with bcrypt

.PHONY: deps
deps: ## Downloads dependencies and generates db files with sqlc
	@go mod tidy
	@sqlc generate
	@cd web && bun i

.PHONY: run
run: ## Runs the project's services or specific $SERVICE
	@${DOCKER} compose -f ${COMPOSE} up --build -d  $(SERVICE)

.PHONY: lint
lint: ## Runs go vet, golangci-lint and biome (web) across the project
	@sqlc vet
	@go vet ./...
	@golangci-lint run
	@golangci-lint fmt
	@cd web && bun run lint

.PHONY: migrate_up
migrate_up: ## Run all available up migrations
	@mkdir -p ${DB_FILE_PATH}
	@goose -dir ${MIGRATION_DIR} ${DB_DRIVER} ${DB_STRING} up

.PHONY: migrate_down
migrate_down: ##Roll back the most recent migration
	@goose -dir $(MIGRATION_DIR) ${DB_DRIVER} ${DB_STRING} down

.PHONY: clean
clean: ## Stops the current $COMPOSE services
	@echo "Stopping and pruning docker resources (no images)"
	@${DOCKER} compose -f ${COMPOSE} down

.PHONY: clean_all
clean_all: ## Cleans everything $DOCKER related, not only this project
	@echo "Stopping and pruning docker resources (with images)"
	@${DOCKER} compose -f ${COMPOSE} down --rmi all --volumes --remove-orphans
	@${DOCKER} system prune -a -f --volumes
	@${DOCKER} builder prune --all --force

.PHONY: logs
logs: ## Tails the docker $SERVICE logs
ifdef SERVICE
		@${DOCKER} compose -f ${COMPOSE} logs -f --tail=400 $(SERVICE)
else
		@echo "Please define SERVICE environment/make variable. Example:"
		@echo
		@echo "SERVICE=web make logs"
		@echo
		@echo "-- or --"
		@echo
		@echo "make logs SERVICE=web"
		@echo
endif

.PHONY: exec
exec: ## Executes into the docker $SERVICE pod
ifdef SERVICE
		@${DOCKER} compose -f ${COMPOSE} exec $(SERVICE) /bin/sh
else
		@echo "Please define SERVICE environment/make variable. Example:"
		@echo
		@echo "SERVICE=web make exec"
		@echo
		@echo "-- or --"
		@echo
		@echo "make exec SERVICE=web"
		@echo
endif

.PHONY: help
help: ## Runs the help command showing all make commands available
	@echo "Available commands:"
	@grep -h -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'
