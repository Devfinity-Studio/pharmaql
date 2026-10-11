import mysql from "mysql2/promise";

/**
 * High-performance connection pool for legacy ERP MySQL databases (pdyasvmaster & pdyasvtrans).
 * Configured with optimal connection reuse, keep-alive, and connection recycling.
 */
export const legacyDb = mysql.createPool({
	host: process.env.CLIENT_MYSQL_HOST || "127.0.0.1",
	port: Number(process.env.CLIENT_MYSQL_PORT) || 3306,
	user: process.env.CLIENT_MYSQL_USER || "root",
	password: process.env.CLIENT_MYSQL_PASSWORD || "Devansh@2007",
	database: process.env.CLIENT_MYSQL_DATABASE || "pdyasvtrans",
	waitForConnections: true,
	connectionLimit: 25,
	maxIdle: 10,
	idleTimeout: 60000,
	queueLimit: 0,
	enableKeepAlive: true,
	keepAliveInitialDelay: 10000,
	namedPlaceholders: false,
});
