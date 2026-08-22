# ADR-0003: Migrate repository to Abhi122005/Exam-Seating and unify branches

- **Status:** Accepted
- **Date:** 2026-08-22
- **Owner:** Abhi122005 (migrated from sebin-gg)

## Context

The portal was developed under `sebin-gg/iedc-web-management-cell-task1` (branch `main`, 93 commits). A parallel `Abhi122005/Exam-Seating` repository existed with `master` (9 commits, `b11e307`), containing an earlier static-HTML variant plus QR-code feature (`/api/qr`, `qrcode-generator`) that was later dropped. The two histories were unrelated (no common ancestor).

CEC needed a single canonical repository under `Abhi122005/Exam-Seating` with one authoritative branch, while retaining rollback to the old `master` content.

## Decision

1. **Remote migrated:** `origin` set to `https://github.com/Abhi122005/Exam-Seating.git`.
2. **Backup preserved:** the pre-migration `master` tip (`b11e307`) pushed to `origin/master-backup`.
3. **Single codebase:** local `main` (`d844fe0`) force-pushed to both `origin/main` and `origin/master`, so the two branch names currently point to the same commit.
4. **Docs updated:** `README.md` (clone URL + handover), `ARCHITECTURE.md`, `AGENTS.md`, `sonar-project.properties` (`Abhi122005_Exam-Seating` / `Abhi122005`), `ci.yml` example, and `ADR-0001` amended.
5. **History ancestry not stitched:** the old `master` lineage is not a parent of the new tips — it is isolated on `master-backup`. A `merge -s ours` could attach it as a parent without changing the tree, but was deferred (hard overwrite + backup was preferred for simplicity).

## Alternatives considered

- **Merge `-s ours` (recorded ancestry):** `git merge -s ours origin/master` would keep Abhi's commits as a parent of a merge commit while keeping the tree 100% ours — zero conflicts, merge bubble. Rejected for now because the hard backup already satisfies rollback and a linear force-push is simpler.
- **True content merge (`--allow-unrelated-histories`):** would interleave `exam-seating-app/` and `apps/` trees, leaving dead duplicated code. Rejected.
- **Rebase `--onto` (linear replay):** would replay 93 commits onto `b11e307` — clean linear history but massive conflict load at the monorepo restructure. Rejected.

## Consequences

- **Positive:** one README/clone URL, one deployment target; instant rollback via `master-backup`; no orphaned stale docs; QR feature removal is explicit.
- **Negative:** `origin/master` history was rewritten (force-push) — collaborators who had pulled `master` must `git fetch --all && git reset --hard origin/master` if they pinned it.
- **Follow-up (admin, Abhi122005):** set default branch to `main` (Settings → General → Default branch), then delete the redundant branch (keep one of `main`/`master`). Keep `master-backup` until rollback is confirmed unnecessary. Update SonarCloud project binding to `Abhi122005_Exam-Seating` if analysis is enabled.

## Rollback

```bash
git fetch origin
git checkout master        # or main
git reset --hard origin/master-backup
git push --force
# or restore via GitHub: Branches → master-backup → Restore/Create PR
```
