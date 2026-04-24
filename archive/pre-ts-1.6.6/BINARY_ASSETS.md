# Binary assets excluded from snapshot

This pre-TypeScript snapshot intentionally excludes binary files so PR systems that do not support binary diffs can open the change.

If you need the exact binaries, use the baseline tag `v1.6.6-pre-ts-migration` and copy them from the original paths:

- `src/templates/quote/assets/nct-logo.png`
- `src/templates/quote/assets/signature.png`
- `src/templates/quote/fonts/Lexend-Regular.ttf`
- `src/templates/quote/fonts/Lexend-Black.ttf`
- `src/templates/quote/fonts/Lexend-SemiBold.ttf`
