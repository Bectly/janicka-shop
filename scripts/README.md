# Scripts

## `sync-turso.ts` — Keep Turso production in sync with dev.db

Every Prisma schema change must land in **both** `prisma/dev.db` and Turso
production, otherwise the Vercel build ships code that queries columns Turso
does not have. This script automates that sync.

### Flow

```bash
# Edit prisma/schema.prisma
npm run db:push          # prisma db push + npm run db:sync-turso
git commit -am "feat: add X field"
# deploy (push to main — Vercel auto-deploy, or `npm run deploy`)
```

That's it. `npm run db:push` does local push **and** Turso sync. You never
need to think about Turso manually.

### How it works

`sync-turso.ts` reads the schema from `prisma/dev.db` and compares it to the
Turso database pointed to by `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` in
`.env.local`. For anything missing on the Turso side it emits:

- `CREATE TABLE IF NOT EXISTS …` (copied from dev.db's `sqlite_master.sql`)
- `ALTER TABLE "<t>" ADD COLUMN "<c>" …` (SQLite only supports ADD)
- `CREATE INDEX IF NOT EXISTS …`

It never drops anything. If Turso has a column/table that dev.db lacks the
script prints a warning — no destructive action.

### Commands

```bash
npm run db:sync-turso:dry   # print SQL that would run, exit 0
npm run db:sync-turso       # apply it
npm run db:push             # prisma db push + db:sync-turso
```

`predeploy` also runs `db:sync-turso`, so `npm run deploy` will block if
there's any unapplied drift.

### Caveats

- `NOT NULL` columns without `DEFAULT` cannot be added to a non-empty table
  in SQLite. The script prints a warning and skips those — add a default in
  `schema.prisma` (or backfill manually before sync).
- Tables starting with `_` (e.g. `_prisma_migrations`) are ignored by design.
- The legacy `scripts/db-push-turso.sql` is kept as a historical log only —
  do not add new DDL there.

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
