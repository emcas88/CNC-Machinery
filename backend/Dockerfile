# ============================================================
# Stage 1: Builder
# ============================================================
FROM rust:latest AS builder

# Install system dependencies required for sqlx / TLS
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY backend/Cargo.toml backend/Cargo.lock* ./

# Create a dummy main to pre-cache dependencies
RUN mkdir -p src && echo "fn main() {}" > src/main.rs
RUN cargo build --release || true
RUN rm -rf src

# Copy the actual source
COPY backend/src ./src

# Copy .sqlx offline query data (required for SQLX_OFFLINE=true builds)
COPY backend/.sqlx ./.sqlx

# Copy migrations so sqlx::migrate!("../migrations") resolves at compile time
COPY migrations /migrations

# Build the release binary
# SQLX_OFFLINE=true is required when building without a live DB
ENV SQLX_OFFLINE=true
RUN cargo build --release

# ============================================================
# Stage 2: Runtime
# ============================================================
FROM debian:bookworm-slim AS runtime

# Install runtime dependencies (TLS, timezone data)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the compiled binary from the builder stage
# Binary name is cnc_backend (underscore) as defined in Cargo.toml [[bin]]
COPY --from=builder /app/target/release/cnc_backend /app/cnc_backend

# Copy migrations to run on startup
COPY --from=builder /migrations /app/migrations

EXPOSE 8080

ENV RUST_LOG=info
ENV SERVER_HOST=0.0.0.0
ENV SERVER_PORT=8080

CMD ["/app/cnc_backend"]
