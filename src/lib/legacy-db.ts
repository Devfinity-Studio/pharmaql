import mysql from 'mysql2/promise';

export const legacyDb = mysql.createPool({
  host: process.env.CLIENT_MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.CLIENT_MYSQL_PORT) || 3306,
  user: process.env.CLIENT_MYSQL_USER || "root",
  password: process.env.CLIENT_MYSQL_PASSWORD || "Devansh@2007",
  database: process.env.CLIENT_MYSQL_DATABASE || "pdyasvtrans",
});