# --------
# Builder
# --------
FROM docker.io/library/golang:1.26-alpine AS builder

RUN apk add build-base

RUN CGO_ENABLED=0 go install github.com/pressly/goose/v3/cmd/goose@latest

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

# internal/database comes from `make deps`
COPY cmd/ ./cmd/
COPY internal/ ./internal/

RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w" -o main ./cmd/...

# --------
# Runtime
# --------
FROM docker.io/library/alpine:3

WORKDIR /server

ENV TZ=UTC

COPY --from=builder /app/main ./main
COPY --from=builder /go/bin/goose ./goose
COPY infra/migrations/ ./migrations/

# Use non-root user (UID 1001)
USER 1001

ENTRYPOINT ["/server/main"]
