import mysql from "mysql2/promise";
import "./config";

const host = process.env.CLIENT_MYSQL_HOST || "127.0.0.1";
const port = parseInt(process.env.CLIENT_MYSQL_PORT || "2903", 10);
const user = process.env.CLIENT_MYSQL_USER || "pharmaql";
const password = process.env.CLIENT_MYSQL_PASSWORD;
const database = process.env.CLIENT_MYSQL_DATABASE || "pdyasvtrans";

if (!password && process.env.NODE_ENV === "production") {
  throw new Error(
    "SECURITY CONFIGURATION ERROR: CLIENT_MYSQL_PASSWORD must be defined in environment."
  );
}

export const dbPool = mysql.createPool({
  host,
  port,
  user,
  password,
  database,
  waitForConnections: true,
  connectionLimit: 25,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

/**
 * Gracefully drains all active database connections in the pool.
 */
export async function closeDatabasePool(): Promise<void> {
  try {
    await dbPool.end();
  } catch (err: any) {
    console.error("[Database] Error while draining database pool:", err?.message || err);
  }
}
