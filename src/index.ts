import { Hono } from "hono";
import { rateLimit } from "./middleware/rate-limit";
import buy from "./routes/buy";
import search from "./routes/search";
import stripe from "./routes/stripe";
import unlock from "./routes/unlock";
import { cleanup } from "./jobs/cleanup";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.onError((e, c) => {
  console.error(e);
  return c.json({ error: "Internal error" }, 500);
});

app.route("/stripe", stripe);

// No CORS because no web app is poiting endpoints
app.use("/*", rateLimit);

// This is for installing cli client
app.get("/install-cli", (c) =>
  c.redirect(
    "https://raw.githubusercontent.com/maksymiliankarol/deals-cli/main/install.sh",
    302,
  )
);

app.route("/buy", buy);
app.route("/search", search);
app.route("/unlock", unlock);

export default {
  fetch: app.fetch,
  scheduled: (_controller, env) => cleanup(env),
} satisfies ExportedHandler<CloudflareBindings>;