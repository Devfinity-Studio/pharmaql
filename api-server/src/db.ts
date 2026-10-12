import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const host = process.env.CLIENT_MYSQL_HOST || "127.0.0.1";
const port = parseInt(process.env.CLIENT_MYSQL_PORT || "2903", 10);
const user = process.env.CLIENT_MYSQL_USER || "pharmaql";
const password = process.env.CLIENT_MYSQL_PASSWORD || "Devansh@2007";
const database = process.env.CLIENT_MYSQL_DATABASE || "pdyasvtrans";

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
