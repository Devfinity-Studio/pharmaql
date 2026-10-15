import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Allow health check without auth if needed for monitoring
  if (req.path === "/health") {
    next();
    return;
  }

  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    res.status(401).json({ error: "Unauthorized: Missing Authorization header" });
    return;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    res.status(401).json({ error: "Unauthorized: Malformed Authorization header" });
    return;
  }

  const token = parts[1]?.trim().replace(/^["']|["']$/g, "") || "";
  const expectedSecret = process.env.API_SECRET_KEY?.trim().replace(/^["']|["']$/g, "") || "";

  if (!expectedSecret) {
    res.status(500).json({ error: "Server Configuration Error: API_SECRET_KEY not set" });
    return;
  }

  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expectedSecret);

  if (tokenBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
    res.status(401).json({ error: "Unauthorized: Invalid API secret key" });
    return;
  }

  next();
}
