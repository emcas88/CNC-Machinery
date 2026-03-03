# CNC-Machinery

**Full-stack CNC cabinet manufacturing management system** — from room design and 3D visualization through G-code generation, nesting optimization, and shop-floor operations.

[![Rust](https://img.shields.io/badge/Rust-1.75%2B-000000?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Features

| Category | Highlights |
|---|---|
| **Design** | Room designer, interactive 3D viewer (Three.js), floor plan editor, product & part editors |
| **Manufacturing** | G-code generation & simulation, nesting/optimization engine, flipside machining, post-processor editor |
| **Shop Floor** | CNC operator view, cut lists, label designer, assembly tracking, remake bin |
| **Business** | Quote generator, BOM/BOQ views, export center, cost estimation |
| **Configuration** | Machine setup, hardware library, texture manager, construction methods, dovetail setup |
| **Infrastructure** | JWT auth with role-based access, audit logging, Redis caching, MinIO file storage, WebSocket real-time updates |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          Frontend                               │
│       React 18 · TypeScript · Vite · Tailwind CSS               │
│       Three.js · Zustand · TanStack Query                       │
│                    :3000                                        │
└──────────────────────┬──────────────────────────────────────────┘
                       │  REST + WebSocket
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Backend                                │
│         Rust · Actix-web 4 · SQLx · JWT Auth                    │
│         23 API modules · 12 service engines                     │
│                    :8080                                        │
└──────┬──────────────────┬───────────────────┬───────────────────┘
       │                  │                   │
       ▼                  ▼                   ▼
┌─────────────┐   ┌─────────────┐     ┌─────────────┐
│ PostgreSQL  │   │    Redis    │     │    MinIO     │
│   16        │   │    7        │     │  (S3-compat) │
│  :5432      │   │  :6379      │     │  :9000/:9001 │
│             │   │             │     │              │
│ 22 DB models│   │ Session &   │     │ File storage │
│ SQL migrate │   │ cache layer │     │ & textures   │
└─────────────┘   └─────────────┘     └─────────────┘
```

| Layer | Role |
|---|---|
| **Frontend** | 35+ pages handling design, visualization, shop-floor UIs, and business tools. Zustand stores manage client state; TanStack Query handles server-state synchronization. |
| **Backend** | Actix-web REST API with 23 handler modules, 12 computation engines (nesting, G-code, quoting, etc.), and WebSocket support for real-time updates. |
| **PostgreSQL** | Primary data store with 22 models covering jobs, rooms, products, parts, materials, machines, and more. Managed via SQLx migrations. |
| **Redis** | Session management, response caching, and pub/sub for WebSocket fan-out. |
| **MinIO** | S3-compatible object storage for textures, G-code files, exported documents, and rendered images. |

---

## Quick Start

```bash
git clone https://github.com/emcas88/CNC-Machinery.git
cd CNC-Machinery
cp .env.example .env
docker compose up -d
```

Once all containers are running:

| Service | URL |
|---|---|
| Frontend | [http://localhost:3000](http://localhost:3000) |
| Backend API | [http://localhost:8080](http://localhost:8080) |
| MinIO Console | [http://localhost:9001](http://localhost:9001) |

---

## Development Setup

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/)
- [Rust 1.75+](https://rustup.rs/) (for local backend development)
- [Node.js 20+](https://nodejs.org/) (for local frontend development)

### Running Locally Without Docker

Start the infrastructure services first:

```bash
docker compose up -d postgres redis minio
```

**Backend:**

```bash
cd backend
cargo run
```

The API server starts on `http://localhost:8080`.

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

The dev server starts on `http://localhost:3000` with hot reload.

### Database Migrations

```bash
cd backend
sqlx migrate run
```

### Seed Data

```bash
./scripts/seed.sh
```

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://cnc:cnc@localhost:5432/cnc_machinery` |
| `RUST_LOG` | Log level for the backend | `info` |
| `SERVER_HOST` | Backend bind address | `0.0.0.0` |
| `SERVER_PORT` | Backend bind port | `8080` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `MINIO_ENDPOINT` | MinIO API endpoint | `http://localhost:9000` |
| `MINIO_ACCESS_KEY` | MinIO access key | `minioadmin` |
| `MINIO_SECRET_KEY` | MinIO secret key | `minioadmin` |
| `MINIO_BUCKET` | Default storage bucket | `cnc-machinery` |
| `JWT_SECRET` | Secret key for JWT signing | *(required)* |
| `JWT_EXPIRY_HOURS` | Token expiration in hours | `24` |
| `ALLOWED_ORIGINS` | CORS allowed origins (comma-separated) | `http://localhost:3000` |
| `VITE_API_URL` | API base URL used by the frontend | `http://localhost:8080` |
| `VITE_WS_URL` | WebSocket URL used by the frontend | `ws://localhost:8080/api/ws` |

---

## API Documentation

All endpoints are prefixed with `/api`. Responses use JSON. Protected routes require a `Bearer` token in the `Authorization` header.

| Endpoint Group | Methods | Description |
|---|---|---|
| `/api/auth` | `POST` | Authentication — login, register, logout, token refresh |
| `/api/users` | `GET` `POST` `PATCH` `DELETE` | User management and role assignment |
| `/api/jobs` | `GET` `POST` `PUT` `DELETE` | CRUD for cabinet jobs (top-level project entity) |
| `/api/rooms` | `GET` `POST` `PUT` `DELETE` | Room management within jobs |
| `/api/products` | `GET` `POST` `PUT` `DELETE` | Product / cabinet definitions |
| `/api/parts` | `GET` `POST` `PUT` `DELETE` | Part-level operations within products |
| `/api/materials` | `GET` `POST` `PUT` `DELETE` | Material library (sheet goods, edge banding, etc.) |
| `/api/textures` | `GET` `POST` `PUT` `DELETE` | Texture management and file upload |
| `/api/hardware` | `GET` `POST` `PUT` `DELETE` | Hardware catalog (hinges, slides, fasteners) |
| `/api/construction-methods` | `GET` `POST` `PUT` `DELETE` | Construction method presets and joinery rules |
| `/api/machines` | `GET` `POST` `PUT` `DELETE` | CNC machine configuration and capabilities |
| `/api/tools` | `GET` `POST` `PUT` `DELETE` | Tool library (bits, blades, profiles) |
| `/api/post-processors` | `GET` `POST` `PUT` `DELETE` | Post-processor templates for different CNC controllers |
| `/api/optimizer` | `POST` `GET` | Nesting / optimization runs and results |
| `/api/gcode` | `POST` `GET` | G-code generation, preview, and simulation |
| `/api/labels` | `GET` `POST` `PUT` `DELETE` | Label templates and batch generation |
| `/api/cutlists` | `GET` `POST` | Cut list generation, BOM/BOQ views |
| `/api/quotes` | `GET` `POST` `PUT` `DELETE` | Quote generation, PDF export, cost breakdowns |
| `/api/exports` | `POST` `GET` | Multi-format file export (PDF, CSV, DXF) |
| `/api/rendering` | `POST` `GET` | Cloud rendering pipeline for 3D scenes |
| `/api/shop-apps` | `GET` `POST` `PUT` | Shop floor operations — operator view, assembly tracking, remake bin |
| `/api/ws` | `WebSocket` | Real-time updates (job status, optimization progress, notifications) |

---

## Testing

### Backend

```bash
cd backend
cargo test
```

### Frontend

```bash
cd frontend
npm test
```

### Coverage Report

```bash
./scripts/check-coverage.sh
```

CI runs automatically on every pull request via GitHub Actions (`ci.yml`, `pr-check.yml`). Deployments are handled by `deploy.yml`.

---

## Project Structure

```
CNC-Machinery/
├── backend/src/
│   ├── api/              # 23 API handler modules
│   ├── models/           # 22 DB models (SQLx)
│   ├── services/         # 12 computation engines
│   │   ├── gcode/        #   G-code generation
│   │   ├── nesting/      #   Sheet nesting & optimization
│   │   ├── quoting/      #   Cost estimation & quoting
│   │   └── ...
│   └── config/           # App configuration & startup
├── frontend/src/
│   ├── pages/            # 35+ page components
│   ├── components/       # Shared UI components
│   ├── services/         # API client functions
│   ├── store/            # Zustand state stores
│   ├── hooks/            # Custom React hooks
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Utility functions
├── migrations/           # SQL migrations (SQLx)
├── scripts/              # Dev, CI, and seed scripts
├── .github/workflows/    # GitHub Actions (CI/CD)
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Contributing

1. **Branch** from `main` — use the format `feature/short-description` or `fix/short-description`.
2. **Commit messages** — follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
3. **Code style:**
   - **Rust:** Run `cargo clippy` and `cargo fmt` before committing.
   - **Frontend:** Run `npx eslint .` and `npx prettier --write .` (enforced in CI).
4. **Open a PR** against `main` with a clear description of the change, linked issues, and screenshots for UI changes.
5. All CI checks must pass before merge.

---

## License

This project is licensed under the [MIT License](LICENSE).
