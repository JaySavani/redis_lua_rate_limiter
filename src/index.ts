import express from "express";
import dotenv from "dotenv";
import { rateLimiter } from "./middleware/rate-limiter";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "10000");
const max = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "5");
const refillRate = parseInt(process.env.RATE_LIMIT_REFILL_RATE || "1"); // per second
const capacity = parseInt(process.env.RATE_LIMIT_CAPACITY || "5");

// ── Sliding Window endpoint ──────────────────────────────────
app.get(
  "/api/data",
  rateLimiter({ windowMs, max, algorithm: "sliding-window" }),
  (req, res) => {
    res.json({
      algorithm: "sliding-window",
      message: "OK",
      timestamp: new Date().toISOString(),
    });
  },
);

// ── Token Bucket endpoint ────────────────────────────────────
app.get(
  "/api/data-tb",
  rateLimiter({ capacity, refillRate, algorithm: "token-bucket" }),
  (req, res) => {
    res.json({
      algorithm: "token-bucket",
      message: "OK",
      timestamp: new Date().toISOString(),
    });
  },
);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(
    `  GET /api/data     -> sliding-window  (limit: ${max} / ${windowMs}ms)`,
  );
  console.log(
    `  GET /api/data-tb  -> token-bucket    (capacity: ${capacity}, refill: ${refillRate}/sec)`,
  );
});
