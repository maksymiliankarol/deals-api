import { Hono } from "hono";
import buy from "./routes/buy";
import search from "./routes/search";
import { rateLimit } from "./middleware/rate-limit";
import { cors } from "hono/cors";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use(
  "/*",
  cors({
    origin: ["https://deals.metalogrom.com", "http://localhost:5173"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    maxAge: 86400,
  }),
  rateLimit,
);

app.get("/message", (c) => c.text("Hello Hono!"));
app.route("/buy", buy);
app.route("/search", search);

export default app;