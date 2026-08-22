# src/lib/ — Deep Module Convention

Each file in `src/lib/` is a **deep module**: a lot of behaviour behind a small interface.

## Layout

```
src/lib/
  blob.ts              ← module entry point (public)
  exam-release.ts      ← module entry point (public)
  exam-publish.ts      ← module entry point (public)
  seating-format.ts    ← module entry point (public)
  admin-session.ts     ← module entry point (public)
  exam-cleanup.ts      ← module entry point (public)
```

## Rules

1. **Route handlers import only through module entry points** — `src/app/api/**/route.ts` imports from `src/lib/<module>.ts` directly. Never reach into a subfolder of `src/lib/` (if one is added later).

2. **Lib modules may import each other freely** — `exam-publish.ts` can import from `blob.ts`, `seating-format.ts`, etc. No restrictions within `src/lib/`.

3. **No cycles** — dependency-cruiser enforces no circular imports between lib modules.

4. **If a module grows**, extract a subfolder (`lib/`) inside it — but the module's root `.ts` file remains the entry point. Outsiders never import from the subfolder.

## Running the check

```bash
pnpm lint:boundaries
```

This runs dependency-cruiser against `src/` with the config in `.dependency-cruiser.cjs`.
