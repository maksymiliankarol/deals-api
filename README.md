# README

## Curl

### Creating buy listing

```bash
curl -X POST http://localhost:8787/buy \
  -H "Content-Type: application/json" \
  -d '{"phone":"+15551234567","email":"test@example.com","description":"Looking to buy a red Ferrari"}'
```

### Check vectorize

```bash
pnpm wrangler vectorize info deals-buy
```