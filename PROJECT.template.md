# Project: <Replace with project name>

<!--
Drop this file into the root of any repo you want Project Tracker to follow.
Keep the H2 section headings exactly as written below — the parser uses them
to bucket tasks into Kanban columns. Within each section, use GitHub-flavored
checkboxes ( - [ ] / - [x] ) for individual items.

You can edit freely between syncs. The tracker will reconcile changes by
content fingerprint, so app-level metadata (tags, priority, notes) stays
attached to each task even if you reword it or move it between sections.
-->

## Goals

What "done" looks like for this project. One bullet per goal. Optional `(target: YYYY-MM-DD)` adds a date to the burndown chart.

- [ ] Example goal — describe the outcome (target: 2026-07-01)
- [ ] Another goal
- [x] A goal you've already met

## In Progress

What you're actively working on right now. Keep this list short — these are the cards that will sit in the "In Progress" column.

- [ ] Task you're working on
- [ ] Another active task

## To Do

Planned work that hasn't been started yet.

- [ ] Upcoming task A
- [ ] Upcoming task B

## Done

Completed work. Move items here when finished — the tracker reads this section as the "Done" column.

- [x] Something you finished
- [x] Another completed item

## Blocked

Work that's stalled and waiting on something external (a decision, a review, another team, an upstream dependency). The tracker shows blocked items on the cross-project dashboard so they don't get forgotten.

- [ ] Task waiting on <what it's waiting on>

## Releases

Planned and shipped releases. The tracker also pulls releases from the GitHub Releases API, so this section is for releases you haven't tagged yet.

Format: `vX.Y.Z — <planned|released> YYYY-MM-DD — short description`

- v0.2.0 — planned 2026-06-15 — Beta launch
- v0.1.0 — released 2026-05-10 — Internal alpha

## Notes

Free-form notes the tracker will surface in the project's Activity tab. Use this for context that doesn't fit as a task — open questions, design decisions, things you want to remember.

- Decision (2026-05-26): chose Postgres over SQLite for the multi-user case
- Open question: do we need webhook-driven sync, or is daily cron enough?
