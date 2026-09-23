# ── Stage 1: Build the Go binary ──────────────────────────────────────────
FROM golang:1.26-alpine AS builder

WORKDIR /src

# Download dependencies first for layer caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build static, CGO-free binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /bin/termimus-server ./cmd/server

# ── Stage 2: Minimal runtime image ──────────────────────────────────────────
FROM alpine:3.21

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app
VOLUME /data

COPY --from=builder /bin/termimus-server /app/termimus-server

ENV PORT=8080 \
    DATA_DIR=/data \
    DB_PATH=/data/sync.db \
    TERMIMUS_AUTH_TOKEN=""

EXPOSE 8080

ENTRYPOINT ["/app/termimus-server"]
