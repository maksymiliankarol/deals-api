# Readme

## Daily Git

```bash
git status                      # see what changed
git add .                       # stage everything
git commit -m "Describe change" # commit
git push                        # push to remote
```

## Migrations

```bash
wrangler d1 migrations create deals-db add_something   # makes 0002_add_something.sql
pnpm db:migrate                                        # local
pnpm db:migrate:prod                                   # prod, asks for confirmation
```

## Vectorize

### Create

```bash
pnpm wrangler vectorize create buy-index-1536 --dimensions=1536 --metric=cosine
```

### Inspect

```bash
# All indexes
pnpm wrangler vectorize list

# Index config (dimensions, metric)
pnpm wrangler vectorize get buy-index-1536

# Vector count and last processed mutation
pnpm wrangler vectorize info buy-index-1536

# List vector ids (first 100)
pnpm wrangler vectorize list-vectors buy-index-1536 --count=100

# Next page (cursor comes from the previous output)
pnpm wrangler vectorize list-vectors buy-index-1536 --count=100 --cursor=<cursor>

# Get specific vectors (values and metadata)
pnpm wrangler vectorize get-vectors buy-index-1536 --ids 1
```

### Delete

```bash
# Delete entire vectorize
pnpm wrangler vectorize delete buy-index-1536
```

```bash
# Delete specific vectors
pnpm wrangler vectorize delete-vectors buy-index-1536 --ids 1
```

Deleting a vector does not delete the D1 row. Remove both:

```bash
pnpm wrangler d1 execute <DB_NAME> --local --command "DELETE FROM deals WHERE id = 1"
pnpm wrangler d1 execute <DB_NAME> --remote --command "DELETE FROM deals WHERE id = 1"
```

### Stripe

Only once:

```bash
stripe login
```

```bash
stripe listen --forward-to localhost:8787/api/stripe/webhook
```


### Notes

- `wrangler vectorize ...` always talks to the real (remote) index, since Vectorize has no local simulation.
- Changes are eventually consistent. `info` shows when the latest mutation was processed, so re-check after a few seconds if a new vector doesn't appear.
- Run `pnpm wrangler vectorize <command> --help` to confirm flags for your Wrangler version.