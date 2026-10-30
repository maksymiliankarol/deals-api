import { bodyLimit } from 'hono/body-limit'
import { errorBody } from './error-codes'

// Legit requests are under 1 KB. Even a description escaped as \uXXXX on every
// character stays under ~5 KB, so 8 KB leaves room without being generous.
export const jsonBodyLimit = bodyLimit({
  maxSize: 8 * 1024,
  onError: (c) => c.json(errorBody('body_too_large'), 413)
})