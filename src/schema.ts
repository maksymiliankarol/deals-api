import * as v from "valibot";

export const BuySchema = v.object({
  description: v.pipe(v.string(), v.trim(), v.minLength(10), v.maxLength(500)),
  email: v.pipe(v.string(), v.trim(), v.email("Invalid email")),
  phone: v.pipe(v.string(), v.trim(), v.regex(/^\+?[0-9]{7,15}$/, "Invalid phone number")),
});

export const SearchSchema = v.object({
  q: v.pipe(v.string(), v.trim(), v.minLength(3), v.maxLength(500)),
});