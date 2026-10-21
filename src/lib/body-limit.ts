import { bodyLimit } from 'hono/body-limit'

// Legit requests are under 1 KB. Even a description escaped as \uXXXX on every
// character stays under ~5 KB, so 8 KB leaves room without being generous.
export const jsonBodyLimit = bodyLimit({
  maxSize: 8 * 1024,
  onError: (c) => c.json({ error: 'Request body too large' }, 413)
})