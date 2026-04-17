# Scripts

## `normalize-sizes.ts`

Normalizes legacy free-text product sizes to the canonical enum defined in
`src/lib/sizes.ts`. Every product's `sizes` JSON array is mapped through
`normalizeSizesForCategory(...)` (category-aware) and written back. Empty /
unknown values fall back to `["Univerzální"]`.

### Run against dev SQLite (prisma/dev.db)

```bash
npx tsx scripts/normalize-sizes.ts              # dry-run (default)
npx tsx scripts/normalize-sizes.ts --apply      # write changes
```

Dry run prints the first 50 diffs plus any unknown values encountered.

### Run against Turso production

Turso credentials come from the standard env vars — the script auto-detects
them and switches to the `@prisma/adapter-libsql` driver. Keep secrets out of
the shell history (use `.env.production.local` or a one-off export):

```bash
export TURSO_DATABASE_URL="libsql://janicka-shop-<org>.turso.io"
export TURSO_AUTH_TOKEN="<token>"

# Always dry-run first on prod
npx tsx scripts/normalize-sizes.ts

# Apply once the diff looks correct
npx tsx scripts/normalize-sizes.ts --apply

unset TURSO_DATABASE_URL TURSO_AUTH_TOKEN
```

The token must have write access. Tokens are managed via
`~/.turso/turso db tokens create <db-name>`.

### What the script changes

- Lowercase / whitespace is trimmed
- Letter sizes uppercased (`xs` → `XS`)
- "Jiná" / "other" / empty → `Univerzální`
- Unknown values (not in `ALL_SIZES`) → dropped and replaced with
  `Univerzální` if the product ends up with no recognised sizes

The dry-run log lists every dropped value grouped by category so you can
audit the mapping before committing.
