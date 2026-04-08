# AI Content Editorial System

Internal editorial backoffice for automating, reviewing, editing, and managing LinkedIn content generation around sport, disability, public health, inclusion, and awareness campaigns.

## Architecture

```
┌────────────┐    ┌────────────┐    ┌────────────┐
│   Nginx    │───▶│  Frontend  │    │    n8n     │
│  (proxy)   │───▶│ React+Vite │    │ (workflows)│
│   :80      │───▶│            │    │   :5678    │
└────────────┘    └────────────┘    └────────────┘
       │                                  │
       ▼                                  │
┌────────────┐         ┌─────────────────┘
│  Backend   │◀────────┘
│  Fastify   │──────────────────▶ OpenAI API
│   :3000    │
└─────┬──────┘
      │
      ▼
┌────────────┐
│ PostgreSQL │
│   :5432    │
└────────────┘
```

## Tech Stack

- **Frontend**: React, Vite, TypeScript, Tailwind CSS, shadcn/ui, React Router, TanStack Query, React Hook Form, Zod, Tiptap
- **Backend**: Fastify, TypeScript, Prisma, Zod
- **Database**: PostgreSQL
- **Automation**: n8n (self-hosted)
- **AI**: OpenAI API (GPT-4o)
- **Infrastructure**: Docker, docker-compose, Nginx

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- An OpenAI API key

### Setup

1. **Clone the repository**

```bash
git clone <repo-url>
cd automatisation-apa
```

2. **Create environment file**

```bash
cp .env.example .env
```

Edit `.env` and configure:
- `JWT_SECRET`: a random 64-character string
- `OPENAI_API_KEY`: your OpenAI API key
- `POSTGRES_PASSWORD`: a secure database password
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`: your initial admin credentials

3. **Start the stack**

```bash
docker compose up -d
```

4. **Run database migrations**

```bash
docker compose exec backend npx prisma migrate deploy
```

5. **Seed the admin user**

```bash
docker compose exec backend npx tsx src/seed.ts
```

6. **Access the application**

- Editorial UI: http://localhost
- n8n (automation): http://localhost:5678

Login with the admin credentials you configured.

## Development

### Backend (local)

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

### Frontend (local)

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` requests to `localhost:3000`.

## API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Get current user |

### Content Items

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contents` | List content (supports filters/sort/pagination) |
| GET | `/api/contents/:id` | Get content detail |
| PATCH | `/api/contents/:id` | Update content |
| PATCH | `/api/contents/:id/status` | Update status |
| POST | `/api/contents/:id/regenerate` | Regenerate with AI |
| POST | `/api/contents/:id/duplicate` | Duplicate content |
| GET | `/api/contents/:id/versions` | List versions |
| POST | `/api/contents/:id/versions/:versionId/restore` | Restore version |
| GET | `/api/contents/:id/reviews` | List review logs |

### Sources

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sources` | List sources |
| GET | `/api/sources/:id` | Get source detail |
| POST | `/api/ingest` | Ingest a new source |
| POST | `/api/sources/:id/reprocess` | Reprocess a source |

### Workflows

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/workflows/trigger` | Trigger a workflow |
| GET | `/api/workflows/runs` | List workflow runs |
| GET | `/api/workflows/runs/:id` | Get run detail |
| POST | `/api/workflows/runs/:id/retry` | Retry failed run |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | Get dashboard metrics |

### Ingestion

```bash
curl -X POST http://localhost/api/ingest \
  -H "Content-Type: application/json" \
  -H "Cookie: token=<jwt>" \
  -d '{
    "title": "New study on adapted sport",
    "url": "https://example.com/article",
    "content": "Full article text...",
    "published_at": "2026-04-01",
    "source_type": "study"
  }'
```

## Project Structure

```
├── backend/
│   ├── prisma/           # Schema and migrations
│   ├── src/
│   │   ├── lib/          # Prisma client, env, errors
│   │   ├── modules/
│   │   │   ├── auth/     # Authentication
│   │   │   ├── content/  # Content CRUD
│   │   │   ├── source/   # Source management
│   │   │   ├── workflow/ # Workflow triggers
│   │   │   └── dashboard/# Dashboard stats
│   │   ├── services/
│   │   │   ├── openai/   # OpenAI integration
│   │   │   └── n8n/      # n8n integration
│   │   ├── index.ts      # App entry point
│   │   └── seed.ts       # Database seeder
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── hooks/        # Auth, toast hooks
│   │   ├── lib/          # API client, utils, labels
│   │   ├── pages/        # Route pages
│   │   └── types/        # TypeScript types
│   ├── Dockerfile
│   ├── package.json
│   └── vite.config.ts
├── nginx/
│   └── nginx.conf        # Reverse proxy config
├── docker-compose.yml
├── .env.example
└── README.md
```

## Editorial Workflow

1. **Ingest** sources via API or n8n workflow
2. AI **generates** LinkedIn draft content from source material
3. Content appears as **draft** in the editorial dashboard
4. Editor **reviews** and edits content using the rich text editor
5. Content is **approved** or **rejected**
6. Approved content is **published** (copied to LinkedIn)

## Deployment (VPS)

1. SSH into your VPS
2. Install Docker and Docker Compose
3. Clone the repository
4. Copy `.env.example` to `.env` and configure
5. Run `docker compose up -d`
6. Run migrations: `docker compose exec backend npx prisma migrate deploy`
7. Seed admin: `docker compose exec backend npx tsx src/seed.ts`

For SSL, add a Certbot container or use Cloudflare proxy.
