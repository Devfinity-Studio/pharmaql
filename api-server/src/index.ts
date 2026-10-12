import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { authMiddleware } from "./middleware/auth";
import { reportsRouter } from "./routes/reports";
import { masterRouter } from "./routes/master";
import { authRouter } from "./routes/auth";
import { kpiRouter } from "./routes/kpi";
import { dbPool } from "./db";

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || "9443", 10);

app.use(cors());
app.use(express.json({ limit: "10mb" }));

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
