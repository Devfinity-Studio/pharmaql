import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { corsMiddleware } from "./middleware/cors";
import { authMiddleware } from "./middleware/auth";
import { reportsRouter } from "./routes/reports";
import { masterRouter } from "./routes/master";
import { authRouter } from "./routes/auth";
import { kpiRouter } from "./routes/kpi";
import { dbPool } from "./db";

const app = express();
const port = parseInt(process.env.PORT || "9443", 10);

// Strict CORS Ingress Middleware (blocks non-whitelisted origins, terminates OPTIONS preflights early)
app.use(corsMiddleware);

app.use(express.json({ limit: "10mb" }));

// Security Headers Middleware
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// In-Memory Rate Limiter for API Server (180 requests per minute per IP)
const ipRequestCounts = new Map<string, { count: number; resetAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipRequestCounts.entries()) {
    if (entry.resetAt <= now) ipRequestCounts.delete(ip);
  }
}, 60 * 1000).unref();

app.use((req, res, next) => {
  const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "127.0.0.1";
  const now = Date.now();
  const entry = ipRequestCounts.get(clientIp);

  if (!entry || entry.resetAt <= now) {
    ipRequestCounts.set(clientIp, { count: 1, resetAt: now + 60 * 1000 });
  } else {
    entry.count += 1;
    if (entry.count > 180) {
      res.status(429).json({ error: "Too many requests. Please slow down." });
      return;
    }
  }
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Public health check endpoint
app.get("/health", async (_req, res) => {
  try {
    const [rows] = await dbPool.query("SELECT 1 as alive");
    res.json({ status: "healthy", db: "connected", port });
  } catch (err: any) {
    res.status(500).json({ status: "unhealthy", dbError: err.message, port });
  }
});

// Enforce Bearer token auth globally across all API routes
app.use(authMiddleware);

// Mount API modules
app.use("/api/reports", reportsRouter);
app.use("/api/master", masterRouter);
app.use("/api/auth", authRouter);
app.use("/api/kpi", kpiRouter);

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[API Server] Unhandled Error:", err);
  res.status(500).json({ success: false, error: err?.message || "Internal server error" });
});

app.listen(port, () => {
  console.log(`[PharmaQL API Server] Running securely on port ${port}`);
});
