# Project Tracker — Plan

A multi-user web app that gives you a single dashboard over every Git-based project you own. Each project is a tab. Inside each tab: a Kanban board parsed from a `PROJECT.md` (with AI fallback for repos that don't have one), a Releases board, charts, notes, and app-level metadata layered on top. A daily sync ingests new commits, issues, PRs, and updated markdown.

## Decisions locked in

- **Tech**: Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui + Postgres (Neon) + Prisma. This combination is what Linear, Vercel, and Cal.com use — modern, polished, reliable, and fast to ship.
- **Auth**: GitHub OAuth via NextAuth.js. Sign-in doubles as the permission grant to read your repos.
- **Source of truth**: Git repos on GitHub. Repo content stays read-only; the app stores its own metadata on top (tags, priority, due dates, notes).
- **MD parsing**: strict `PROJECT.md` template when present, Claude API fallback otherwise.
- **Sync**: daily background cron + manual "Sync now" button.
- **Hosting**: Vercel (web + cron) + Neon (Postgres) + Resend (email).

## Architecture

```
GitHub  ──Octokit──>  Next.js API routes  ──Prisma──>  Postgres (Neon)
                            │
                            ├── Daily sync (Vercel Cron)
                            ├── Anthropic API (MD parsing fallback)
                            └── Resend (digest emails)

Frontend: Next.js App Router · shadcn/ui · Tailwind · dnd-kit (Kanban) · Recharts
```

## Data model (Prisma)

- **User** — id, githubId, email, accessToken (encrypted), timezone, digestHour
- **Project** — id, userId, repoOwner, repoName, defaultBranch, projectMdPath, staleThresholdDays, lastSyncedAt
- **Task** — id, projectId, source (`md` | `issue` | `pr`), externalId, title, status (`goal` | `todo` | `in_progress` | `blocked` | `done`), rawMarkdown, contentHash, lineRef
- **TaskMetadata** — taskId, priority (P0–P3), dueDate, tags[], notes (app-only, survives re-syncs)
- **Release** — id, projectId, source (`github_release` | `md` | `manual`), name, status (`planned` | `in_progress` | `released`), plannedDate, releasedAt, notes, githubUrl
- **Goal** — id, projectId, title, description, status, targetDate, completedAt
- **CommitDaily** — id, projectId, day, count (for sparkline/burndown)
- **QuickCaptureItem** — id, userId, text, capturedAt, assignedToProjectId (nullable)
- **SyncLog** — id, projectId, startedAt, finishedAt, status, summaryJson (what changed)
- **PrivateNote** — id, projectId, markdown, updatedAt (per-project scratchpad)

## PROJECT.md template (drop in each repo)

```markdown
# Project: <name>

## Goals
- [ ] Ship beta to 10 users (target: 2026-06-15)
- [x] Validate idea with 3 customer calls

## In Progress
- [ ] Refactor auth handler
- [ ] Write integration tests

## To Do
- [ ] Hook up Stripe
- [ ] Build pricing page

## Done
- [x] Set up CI
- [x] Write README

## Blocked
- [ ] Waiting on design review for landing page

## Releases
- v0.2.0 — planned 2026-06-15 — Beta launch
- v0.1.0 — released 2026-05-10 — Internal alpha
```

Sections are H2 headings. Tasks are GitHub-flavored checkboxes. Deterministic parser walks the markdown AST (`remark` / `unified`).

## Markdown parsing pipeline

1. Fetch `PROJECT.md` from the default branch (or configured path).
2. If present → strict parser produces structured tasks/goals/releases.
3. If absent → fall back to scanning `README.md`, `TODO.md`, `PLAN.md`, etc., and call Claude API with a JSON-schema prompt to extract the same structure.
4. Reconcile against existing `Task` rows by **content hash + line reference**. Tasks move between columns based on which section they now appear in.
5. **App metadata survives re-syncs** by matching on content fingerprint — tags/priority/notes stick to the task even if it moves columns or gets minor wording edits.

## UI structure

**Sidebar** — project list, quick-capture button (⌘K), global cross-project view, settings.

**Per-project tabs** (Linear-style top nav inside each project page):

- **Kanban** (default) — five columns: Goals / To Do / In Progress / Blocked / Done. Drag-and-drop with `dnd-kit`. Cards show title, source badge (md / issue / PR), tags, priority chip, due date. Click a card → side drawer with full content + metadata editor + private notes.
- **Releases** — second Kanban: Planned / In Progress / Released. Cards pull from GitHub releases API + the `## Releases` section in PROJECT.md, plus manually-added "future release" cards.
- **Activity** — 90-day commit sparkline, burndown chart toward nearest goal target date, recent commits feed, recent issues & PRs.
- **Notes** — private markdown scratchpad (TipTap or simple textarea), never committed back to the repo.
- **Settings** — stale threshold, PROJECT.md path override, AI fallback toggle, sync schedule.

**Cross-project dashboard** (global view) — "What's blocked everywhere", "Stale projects", "Shipped this week", "Upcoming releases this month".

**Quick capture** (⌘K) — fast input to drop an idea without leaving your current context. Inbox view to triage and assign to a project later.

## Extras spec

- **Stale detection** — default 14 days without commits, configurable per project. Stale projects get a red banner and appear on the cross-project view.
- **Cross-project dashboard** — aggregates blocked / stale / due-this-week / shipped-this-week across all projects.
- **Commit charts** — 90-day sparkline (Recharts) + burndown chart comparing open task count against nearest goal target date.
- **Daily digest email** — morning email via Resend: what synced overnight, what moved between columns, what's newly stale, what's due in the next 7 days.
- **Issues & PRs** — pulled via Octokit, shown on the Kanban alongside .md tasks with distinct source badges.
- **Releases tab** — combines GitHub releases (auto), `## Releases` in PROJECT.md (auto), and manually-added planned releases.
- **Quick capture** — ⌘K hotkey, inbox to triage later.
- **App metadata** — tags, priority (P0–P3), due dates, private notes per task, all surviving re-syncs via content fingerprinting.

## Build phases

**Phase 1 — Foundation** (~week 1)
Bootstrap Next.js + Tailwind + shadcn/ui + Prisma + Neon. GitHub OAuth via NextAuth. "Add project" flow that lists your GitHub repos and lets you pick one.

**Phase 2 — Read & render** (~week 2)
Octokit wrapper, fetch `PROJECT.md`, deterministic markdown parser, Kanban UI (dnd-kit) read-only display, basic sync-log UI.

**Phase 3 — Metadata layer** (~week 3)
App-only metadata (tags, priority, due dates, private notes). Content fingerprinting so metadata persists across re-syncs. Quick-capture inbox.

**Phase 4 — Releases + activity** (~week 4)
Releases tab, GitHub releases ingestion, manual release cards. Recharts sparkline + burndown. Issues & PRs ingestion.

**Phase 5 — Automation** (~week 5)
Daily sync via Vercel Cron. Stale detection. Cross-project dashboard. Daily digest email via Resend. AI fallback parser for repos without PROJECT.md.

**Phase 6 — Polish**
Animations, empty states, toasts, onboarding flow, one-click "drop a PROJECT.md template into this repo" helper.

## Hosting & ops

- **Vercel** — Hobby tier to start, Pro if cron limits bite (one cron job per user per day max on Hobby).
- **Neon Postgres** — free tier covers many users.
- **Resend** — free tier (3,000 emails/month) covers daily digests easily.
- **Sentry** (errors) + **PostHog** (product analytics) optional but recommended.

**Environment vars**: `NEXTAUTH_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `DATABASE_URL`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`, `ENCRYPTION_KEY` (for storing GitHub tokens at rest).

## Open questions / fine-tuning

These don't block building — they're knobs to turn as you use the thing:

- Stale threshold default: 14 days OK, or shorter/longer?
- AI fallback: every sync, or only when the markdown changed?
- Default Kanban columns — fixed, or per-project configurable?
- Auto-archive completed tasks after N days?
- Mobile view priority — read-only on phone, full editing on desktop?
- Webhook-driven sync in addition to daily cron (so changes appear within seconds)?
- Should the app generate weekly review summaries via Claude API?

---

## Ready-to-paste build prompt

Paste the block below into Claude Code (or Cursor / Copilot agent / similar) inside an empty directory to bootstrap the project. Run it in phases — start with Phase 1, get it working, then ask the agent to continue with Phase 2, etc.

```
Build a Next.js 15 web app called "Project Tracker" — a Kanban-style
dashboard for tracking all my Git-based projects from one place.

CORE BEHAVIOR
- Multi-user, sign in with GitHub OAuth (NextAuth.js).
- Each user adds GitHub repos as "projects". Each project gets its own
  page with tabs: Kanban, Releases, Activity, Notes, Settings.
- Daily background sync reads PROJECT.md from each repo, plus open
  issues, PRs, releases, and commit activity.
- Repo content is read-only. The app stores its own metadata (tags,
  priority, due dates, private notes, app-only release plans) in
  Postgres, layered on top of the repo state.
- A cross-project global view shows blocked items, stale projects,
  upcoming releases, and what shipped this week across everything.

STACK
- Next.js 15 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui for a modern, polished UI
- Prisma + Postgres (Neon for hosting)
- NextAuth.js (GitHub provider)
- Octokit for GitHub API
- dnd-kit for Kanban drag-and-drop
- Recharts for sparklines and burndown
- remark/unified for deterministic markdown parsing
- Anthropic SDK (claude-sonnet-4-6) as AI fallback when PROJECT.md is absent
- Resend for daily digest emails
- Vercel Cron for the daily sync trigger
- Deploy to Vercel

DATA MODEL (Prisma)
- User: id, githubId, email, encryptedAccessToken, timezone, digestHour
- Project: id, userId, repoOwner, repoName, defaultBranch, projectMdPath,
  staleThresholdDays (default 14), lastSyncedAt
- Task: id, projectId, source enum(md|issue|pr), externalId, title,
  status enum(goal|todo|in_progress|blocked|done), rawMarkdown,
  contentHash, lineRef
- TaskMetadata: taskId, priority enum(P0|P1|P2|P3), dueDate, tags String[], notes
- Release: id, projectId, source enum(github_release|md|manual), name,
  status enum(planned|in_progress|released), plannedDate, releasedAt,
  notes, githubUrl
- Goal: id, projectId, title, description, status, targetDate, completedAt
- CommitDaily: id, projectId, day, count
- QuickCaptureItem: id, userId, text, capturedAt, assignedToProjectId
- SyncLog: id, projectId, startedAt, finishedAt, status, summaryJson
- PrivateNote: id, projectId, markdown, updatedAt

PROJECT.md TEMPLATE (the parser expects this structure)
# Project: <name>
## Goals
- [ ] goal text (target: YYYY-MM-DD)
## In Progress
- [ ] task
## To Do
- [ ] task
## Done
- [x] task
## Blocked
- [ ] task
## Releases
- vX.Y.Z — planned YYYY-MM-DD — description
- vX.Y.Z — released YYYY-MM-DD — description

SYNC PIPELINE
1. Fetch PROJECT.md from default branch (or configured path)
2. If present, parse deterministically with remark
3. If absent, fall back: scan README.md / TODO.md / PLAN.md, call
   Claude API with JSON-schema prompt to extract goals/tasks/releases
4. Reconcile by content hash + line reference — tasks move columns
   when their markdown moves between H2 sections
5. App metadata (tags, priority, notes) sticks to tasks by content
   fingerprint so it survives re-syncs and minor wording edits
6. Fetch open issues, open PRs, releases, last 90 days of commits
7. Detect stale: no commits in N days → flag
8. Write SyncLog summary of what changed

UI
- Sidebar: project list, quick-capture button, global dashboard link, settings
- Per-project tabs (top nav, Linear-style):
  - Kanban: columns Goals / To Do / In Progress / Blocked / Done.
    Cards show title, source badge, tags, priority chip, due date.
    Click card → side drawer with full content + metadata editor.
  - Releases: columns Planned / In Progress / Released. Pulls from
    GitHub releases + PROJECT.md Releases section + manual additions.
  - Activity: 90-day commit sparkline, burndown chart toward nearest
    goal, recent commits feed, recent issues/PRs.
  - Notes: private markdown scratchpad (not committed back to repo).
  - Settings: stale threshold, PROJECT.md path override, AI fallback toggle.
- Global view: cross-project blocked/stale/due-soon/shipped-this-week.
- ⌘K opens quick-capture; inbox view to triage later.

EXTRAS
- Stale project detection (configurable threshold, default 14 days)
- Daily digest email via Resend at user's preferred local hour
- Commit sparkline + goal burndown via Recharts
- One-click "drop a PROJECT.md template into this repo" helper

BUILD IN PHASES, ask me to verify each phase before moving on:
Phase 1: Bootstrap, auth, add-project flow
Phase 2: Sync engine + Kanban read-only display
Phase 3: App metadata layer + quick capture
Phase 4: Releases tab + Activity charts + Issues/PRs
Phase 5: Daily cron + stale detection + cross-project view + digest email
Phase 6: AI fallback parser + polish

Start with Phase 1. Set up the repo, install dependencies, scaffold the
schema, and get GitHub OAuth working end-to-end. Show me the auth flow
working before moving on.
```
