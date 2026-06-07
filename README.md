# Career Alignment AI

Production-oriented local-first web application for truthful resume and job alignment analysis.

## Stack

- React, TypeScript, Vite
- Node.js, TypeScript, Express
- SQLite with Prisma ORM
- Local llama.cpp OpenAI-compatible endpoint
- PDF and DOCX parsing
- Tailwind CSS, shadcn-style components, Lucide React, Recharts, Zustand, Zod

## Run Locally

```bash
npm install
cp .env.example .env
npm run prisma:push
npm run dev
```

Open `http://localhost:5173`.

## Local AI

The app calls an OpenAI-compatible local endpoint:

```env
LLM_BASE_URL="http://localhost:8080/v1"
LLM_MODEL="local-model"
LLM_API_KEY="not-needed"
```

If llama.cpp is not running, the app uses deterministic local heuristics so the product flow still works offline.

## Architecture

- `client/src/ui/screens`: user flow screens
- `client/src/store`: Zustand state
- `client/src/lib`: API helpers
- `server/src/services`: parsing, extraction, scoring, optimization, LLM integration
- `server/src/routes.ts`: API routes
- `shared/schemas.ts`: Zod contracts used by client and server
- `prisma/schema.prisma`: SQLite schema designed to later swap vector storage and relational database providers

## Future Modules

The service boundaries support adding recruiter simulation, interview preparation, career path analysis, salary benchmarking, internal mobility, hiring manager views, and talent marketplace features without merging business logic into UI components.
