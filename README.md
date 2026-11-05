# README

## How it started

```bash
pnpm create hono my-app
```

## Curl

### Creating buy listing

```bash
curl -X POST http://localhost:8787/buy \
  -H "Content-Type: application/json" \
  -d '{"phone":"+15551234567","email":"test@example.com","description":"Looking to buy a red Ferrari"}'
```

### Create vectorize

```bash
pnpm wrangler vectorize create deals-buy --dimensions=1024 --metric=cosine
pnpm wrangler vectorize create deals-buy-dev --dimensions=1024 --metric=cosine
```

### Check vectorize

```bash
pnpm wrangler vectorize info deals-buy
pnpm wrangler vectorize info deals-buy-dev
```

### Delete vectorize

```bash
pnpm wrangler vectorize delete deals-buy
pnpm wrangler vectorize delete deals-buy-dev
```