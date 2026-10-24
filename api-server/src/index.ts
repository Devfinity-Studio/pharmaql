import "./config";
import { APP_ROOT, isPackaged } from "./config";
import express from "express";
import { corsMiddleware } from "./middleware/cors";
import { authMiddleware } from "./middleware/auth";
import { reportsRouter } from "./routes/reports";
import { masterRouter } from "./routes/master";
import { authRouter } from "./routes/auth";
import { kpiRouter } from "./routes/kpi";
import { dbPool, closeDatabasePool } from "./db";

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

const server = app.listen(port, () => {
  console.log(
    `[PharmaQL API Server] Running securely on port ${port} (mode: ${
      isPackaged ? "standalone-executable" : "development"
    }, root: ${APP_ROOT})`
  );
});

// Process Lifecycle & Safe Pool Drainage (NSSM Windows Service integration)
let isShuttingDown = false;
async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[PharmaQL API Server] Received ${signal}. Draining pool and closing HTTP listener...`);

  // Force termination fallback if cleanup hangs after 10s
  const forceKillTimeout = setTimeout(() => {
    console.error("[PharmaQL API Server] Graceful shutdown timeout expired. Forcing exit.");
    process.exit(1);
  }, 10000);
  forceKillTimeout.unref();

  try {
    // 1. Close HTTP server
    await new Promise<void>((resolve) => {
      server.close((err) => {
        if (err) console.error("[PharmaQL API Server] Error closing HTTP server:", err);
        resolve();
      });
    });
    console.log("[PharmaQL API Server] HTTP listener closed.");

    // 2. Drain database pool
    await closeDatabasePool();
    console.log("[PharmaQL API Server] Database pool closed successfully.");

    clearTimeout(forceKillTimeout);
    console.log("[PharmaQL API Server] Shutdown complete. Exiting process.");
    process.exit(0);
  } catch (err: any) {
    console.error("[PharmaQL API Server] Error during shutdown:", err?.message || err);
    process.exit(1);
  }
}

// Windows Services under NSSM dispatch console events via AppStopMethodConsole
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Ensure unhandled rejections and exceptions write to stdout/stderr and trigger exit
process.on("uncaughtException", (err) => {
  console.error("[PharmaQL API Server] FATAL UNCAUGHT EXCEPTION:", err);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[PharmaQL API Server] UNHANDLED PROMISE REJECTION at:", promise, "reason:", reason);
});
