# Phase Gate Policy

This project enforces delivery gates with **stop-on-fail** behavior.

## Gate order

1. **Commit convention**
   - Required format: `build|refactor|docs|test|chore(scope): message`
2. **Change boundary lock**
   - No UI structure/style change allowed in `src/renderer/index.html`, `src/renderer/styles/**`, and `src/templates/quote/template.css`
   - No business logic change allowed in `src/shared/calculator.ts`
3. **Type safety lock**
   - `tsconfig.json` must keep `strict: true`
   - `tsconfig.json` must keep `noImplicitAny: true`
   - Explicit `any` is forbidden in `*.ts` and `*.tsx`

## Run gate

```bash
npm run phase:gate
```

Optional range override:

```bash
node --import tsx scripts/policy/phase-gate.ts <git-range>
```

Example:

```bash
node --import tsx scripts/policy/phase-gate.ts HEAD~3..HEAD
```
