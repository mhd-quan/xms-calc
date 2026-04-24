# Migration 1.7.0 — Execution Notes (Conflict Resolution)

Date: 2026-04-24  
Scope: clarify execution rules in `MIGRATION-PLAN-1.7.0.md` for this environment.

## 1) Repo root path (current environment)

**Decision:** canonical repo root for execution is:

`/workspace/xms-calc`

The path `/Users/mhdquan/Desktop/xms-calc/` in the migration plan is treated as the original author machine path and **not** used for execution in this environment.

## 2) Conflict: hard-rule `npm run dev` every phase vs Phase 1 acceptance

Observed conflict:

- Hard rule says every phase ends with green `npm test` and a running app (`npm run dev`).
- Phase 1 acceptance explicitly says `npm run dev` is expected to fail cleanly because `.ts` sources are not migrated yet.

**Decision (precedence):** use the more specific phase acceptance as an explicit exception.

Operational rule:

- **Phase 1 only:** `npm run dev` must be executed and is expected to **fail cleanly**.
- **All other phases:** `npm run dev` must execute successfully (app launches) plus green `npm test`.

## 3) Conflict: “do not merge phases” vs end-of-file total commit plan

Observed conflict:

- Top-level rule says: “Do not merge phases. One phase = one commit (or one PR).”
- End-of-file note says: “Total planned commits: 5 (Phase 0, 1, 2, 3, 4 merged with 5, 6, 7).”

**Decision (precedence):** enforce **no phase merging**.

Rationale: the top hard rule + per-phase acceptance structure is the governing execution contract; the footer summary is treated as stale planning text.

Operational rule:

- Execute **Phase 0 → Phase 7** independently.
- Keep **1 phase = 1 commit (or 1 PR)**.
- Effective total is therefore **8 phase commits/PR units** if the full plan is executed.

## 4) Execution policy status

These decisions are now the authoritative execution notes for this environment and must be referenced during migration runs.
