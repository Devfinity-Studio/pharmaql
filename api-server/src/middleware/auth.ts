import { Request, Response, NextFunction } from "express";

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

  const token = parts[1];
  const expectedSecret = process.env.API_SECRET_KEY;

  if (!expectedSecret || token !== expectedSecret) {
    res.status(401).json({ error: "Unauthorized: Invalid API secret key" });
    return;
  }

  next();
}
