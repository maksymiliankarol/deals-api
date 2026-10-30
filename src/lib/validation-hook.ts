import type { Context } from 'hono'
import { errorBody } from './error-codes'

export const invalidInput = (result: { success: boolean }, c: Context) => {
  if (!result.success) return c.json(errorBody('invalid_input'), 400)
}