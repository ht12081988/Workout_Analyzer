# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Workout Analyzer** is a fitness tracking and analysis platform with AI-powered form detection. It's a monorepo containing three main applications:
- **API** (`apps/api`): Express.js backend with PostgreSQL
- **Web** (`apps/web`): Next.js admin/trainer portal
- **Mobile** (`apps/mobile`): React Native (Expo) app for athletes

The platform uses **pose estimation** (MediaPipe) and **computer vision** to analyze workout form, tracks metrics like ROM/flexibility, provides voice cues during workouts, and manages athlete-trainer relationships.

## Tech Stack

- **Monorepo**: Turbo (root scripts fan-out to workspaces)
- **API**: Node.js / Express / TypeScript, PostgreSQL via `pg`, Prisma ORM
- **Web**: Next.js 16+, React 19, Tailwind CSS, Recharts for analytics, Three.js for 3D visualization
- **Mobile**: Expo, React Native, React Navigation
- **Shared**: Utilities at `packages/shared` (types, hooks, etc.)
- **Deployment**: Vercel (web + api as Vercel Services)

## Common Commands

### Root level (Turbo-managed)
```bash
npm install              # Install deps across all workspaces
npm run dev              # Start all dev servers (web, api, mobile in parallel)
npm run build            # Build all apps (respects dependency order)
npm run lint             # Lint all apps
npm run format           # Format code with Prettier
```

### Web (`apps/web/`)
```bash
npm run dev              # Next.js dev server (listens on 0.0.0.0:3000 by default)
npm run build            # Build for production
npm start                # Run production build
npm run lint             # ESLint check
```
**Note**: Web proxies API calls to `http://127.0.0.1:5002` in dev mode (see `next.config.ts`).

### API (`apps/api/`)
```bash
npm run dev              # Start dev server (port 5002 by default, watch mode with tsx)
npm run build            # Compile TypeScript → `dist/`
npm start                # Run compiled dist/index.js
npm run lint             # ESLint check
npm run seed:hip-cars    # Run seed script for hip-cars exercise
```
**Database**: Uses `DATABASE_URL` env var (PostgreSQL). Test connection at startup.

### Mobile (`apps/mobile/`)
```bash
npm run dev              # Expo dev server (port 8082)
npm run android          # Build and run on Android
npm run ios              # Build and run on iOS
npm run web              # Expo web view
```

## Architecture

### Database & Models
- **Prisma schema** at `apps/web/prisma/schema.prisma` defines all models (shared with API via env var `DATABASE_URL`)
- Key models: `customers`, `exercises`, `workout_sessions`, `workout_attempts`, `exercise_pose_rules`, `voice_cues`, `tracking_configs`
- **Tracking configuration** (smoothing, model type) lives in `tracking_configs` table with a single "global" record

### Web App Structure
- **Pages**: `apps/web/src/app/` (Next.js app router)
  - `admin/` — Admin dashboard  
  - `trainer/` — Trainer portal
  - `track/` — Athlete workout tracking (live pose detection)
  - `history/` — Workout history/analytics
  - `configure/` — Exercise configuration
- **Components**: Reusable UI at `apps/web/src/components/`
- **Lib**: Utilities at `apps/web/src/lib/` (API calls, helpers)

### API Endpoints
- **Express app** at `apps/api/src/index.ts` (the main server)
- **Seed scripts** populate exercise data and rules (`seed-*.ts` files)
- **Rules engine** at `apps/api/src/data/rules/` — defines pose detection rules for each exercise

### Pose Detection & Rules
- Uses **MediaPipe** for pose estimation (in web/mobile)
- **Exercise pose rules** in DB define validation thresholds (angle ranges, joint positions, etc.)
- **Dynamic rules** adjust based on user profile (e.g., ROM limitations)
- **Trajectory tracking** via DTW (Dynamic Time Warping) for sequence validation

### Voice System
- **Voice cues** configured per exercise (encouraging phrases, corrections)
- **Config** (`voice_configs` table): intervals, cooldowns, speech rate/pitch, reinforcement probability
- Mobile/Web use TTS to play cues during workouts

## Environment & Setup

### Required Environment Variables
**Web** (`apps/web/.env`):
```
DATABASE_URL=postgres://...     # Prisma connection
Workout_Generator_Key=...       # Google Gemini API key
```

**API** (uses DATABASE_URL from root or `.env`):
```
DATABASE_URL=postgres://...
```

### Database
- Prisma migrations: `apps/web/prisma/migrations/`
- To update schema: edit schema.prisma, run `npx prisma migrate dev --name <change>`
- Test data seeded via scripts in `apps/api/src/seed-*.ts`

### Development Tips
1. **Prisma changes**: Always run `prisma generate` before building (`apps/web/package.json` does this in build script)
2. **Shared package**: Changes to `packages/shared/src/` require rebuilding dependents (Turbo handles this)
3. **API rewrites**: Web proxies `/api/*` to `http://127.0.0.1:5002` in dev only (no proxy in prod/Vercel)
4. **Tracking smoothing**: Adjust `tracking_configs.ui_smoothing` / `engine_smoothing` to control pose jitter

## Testing & Debugging

- **No dedicated test suites** in place currently
- Check TypeScript errors: `npm run build` will fail if TS errors exist
- Lint check: `npm run lint` (ESLint across all apps)
- **Manual testing**: Start `npm run dev`, open browser to `http://localhost:3000`

## Deployment

- **Vercel**: Both `web` and `api` deploy via `vercel.json`
  - Web routes to `/`
  - API routes to `/api`
- **Environment**: Set `DATABASE_URL` in Vercel project settings
- Builds use Turbo (caching enabled for `build` task in `turbo.json`)

## Key Files & Patterns

| File | Purpose |
|------|---------|
| `turbo.json` | Task definitions, env vars for build, caching rules |
| `packages/shared/src/index.ts` | Exported types/utilities for web + mobile |
| `apps/web/prisma/schema.prisma` | Data model (canonical reference) |
| `apps/api/src/index.ts` | Express server setup + route handlers |
| `apps/web/src/app/track/` | Live workout tracking page (pose detection) |
| `apps/api/src/seed-*.ts` | Exercise data loaders (run via `npm run seed:*`) |

## Common Workflows

### Add a new exercise
1. Create seed script: `apps/api/src/seed-new-exercise.ts`
2. Run: `npm run seed:new-exercise`
3. Verify in web UI or DB

### Modify pose validation rules
1. Edit `apps/api/src/data/rules/` or `exercise_pose_rules` table
2. Adjust thresholds for angle/position detection
3. Test on mobile/web workout tracking page

### Update database schema
1. Edit `apps/web/prisma/schema.prisma`
2. Run `npx prisma migrate dev --name <description>` (from `apps/web/`)
3. Commit migration files to git
4. Prisma client auto-regenerates on build

### Debug API in development
1. Ensure `npm run dev` is running (starts API on port 5002)
2. Web automatically proxies `/api/*` requests to the API
3. Check `apps/api/src/index.ts` for route definitions
