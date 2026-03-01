# CNC Cabinet Manufacturing Software

A web-based design-to-manufacture platform for custom cabinet shops. Covers room design, parametric cabinet modeling, construction method management, material systems, 3D visualization, shop drawings, cut lists, sheet optimization/nesting, G-code generation, CNC machining control, labeling, and enterprise job administration.

## Tech Stack

| Layer | Technology |
|-------|----------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Three.js (@react-three/fiber) |
| **Backend** | Rust, Actix-web 4, SQLx |
| **Database** | PostgreSQL 16 |
| **Cache/Queue** | Redis 7 |
| **Object Storage** | MinIO (S3-compatible) — textures, renders, exports |
| **State Management** | Zustand |
| **Data Fetching** | TanStack React Query |
| **Containerization** | Docker, Docker Compose |

## Quick Start

```bash
# Clone and navigate
cd /Users/ecasas/Personal/CNC-Machinery

# Start all services
chmod +x scripts/*.sh
./scripts/dev.sh

# (Optional) Seed sample data
./scripts/seed.sh
```

## License

Private / Proprietary
