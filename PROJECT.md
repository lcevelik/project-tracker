# Project: Project Tracker

## Goals

- [x] Multi-user Kanban dashboard for tracking all Git-based projects from one place (target: 2026-05-26)
- [x] GitHub OAuth sign-in with repo access (target: 2026-05-26)
- [x] Automatic PROJECT.md parsing with deterministic markdown parser (target: 2026-05-26)
- [x] Auto-discover new GitHub repos and sync daily (target: 2026-05-26)
- [ ] Webhook-driven sync for instant updates (target: 2026-07-01)
- [ ] Mobile-responsive full editing support (target: 2026-07-15)

## In Progress

- [ ] Polish UI — animations, empty states, onboarding flow
- [ ] Add per-project notification preferences

## To Do

- [ ] Add webhook-driven sync (GitHub webhooks for instant PROJECT.md updates)
- [ ] Add task commenting system
- [ ] Add project archiving (hide inactive projects)
- [ ] Add CSV/JSON export of project data
- [ ] Add dark/light theme toggle
- [ ] Add per-project custom Kanban columns
- [ ] Add time tracking per task
- [ ] Add project templates for quick setup
- [ ] Add Slack/Discord notifications for task changes
- [x] Add AI task execution feature (v1.2.0) <!-- ai-execute -->

## Done

- [x] Next.js 16 + TypeScript + Tailwind + shadcn/ui scaffold
- [x] Prisma schema with full data model (User, Project, Task, TaskMetadata, Release, Goal, CommitDaily, QuickCaptureItem, SyncLog, PrivateNote)
- [x] GitHub OAuth via NextAuth with custom PrismaAdapter
- [x] Dashboard layout with sidebar, mobile sidebar, quick capture
- [x] Cross-project global view (blocked, stale, due-soon, shipped)
- [x] Kanban board with 5 columns (Goals, To Do, In Progress, Blocked, Done)
- [x] Releases board with drag-and-drop (Planned, In Progress, Released)
- [x] Activity tab with commit sparkline, burndown chart, activity feed
- [x] Private notes per project
- [x] Settings tab (stale threshold, MD path, AI fallback toggle)
- [x] Task metadata (priority P0-P3, due dates, tags, notes) with side drawer
- [x] Quick capture inbox with assign-to-project (⌘K)
- [x] Content fingerprinting — metadata survives re-syncs
- [x] Sync engine with Octokit + remark markdown parser
- [x] AI fallback parser (Claude API) for repos without PROJECT.md
- [x] Daily cron sync via /api/cron/sync-all
- [x] Stale detection with configurable threshold
- [x] Daily digest email via Resend
- [x] Bulk-add repos from GitHub (filters out org repos)
- [x] Auto-sync every 6 hours via Hermes cron job
- [x] Sidebar with search, sort (A-Z/Last Synced/Most Tasks), group filtering
- [x] Auto-detected repo languages
- [x] User-defined project groups
- [x] PROJECT.md template auto-push to all repos
- [x] Daily discover-and-sync cron — auto-adds new GitHub repos at 6AM
- [x] HTTP Basic Auth protection (Apache level)
- [x] 42 repos tracked (all lcevelik/* repos)

## Blocked

- [ ] Email digests — Resend API key not configured yet

## Releases

- v1.0.0 — released 2026-05-26 — Full-featured Project Tracker with Kanban, sync, metadata, quick capture
- v1.1.0 — released 2026-05-26 — Auto-discover repos, HTTP Basic Auth, sidebar cleanup

## Notes

- Tech stack: Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui + Prisma 7 + PostgreSQL (local) + NextAuth + dnd-kit + Recharts + remark/unified + Anthropic SDK + Resend
- App runs on port 3006 (standalone next-server, not PM2)
- Location: /media/server/Storage/www/pt.steadiczech.com/
- Apache reverse proxy + SSL + HTTP Basic Auth (libor/Videoart.1982)
- GitHub OAuth app: Client ID Ov23liwCkBcDwJ0fUlGz
- 42 repos tracked (all lcevelik/* personal repos)
- Daily discover-and-sync cron (job f1f090cd9095) at 6AM
- All repos have PROJECT.md pushed with real tasks from deep code analysis
- Kanban is read-only — edit PROJECT.md in repos, then sync
- Parser uses remark-gfm for checkbox support
- Content fingerprinting via SHA-256 hash preserves metadata across re-syncs
- Old /Codebase/projecttracker deleted — single source of truth at /www/pt.steadiczech.com
