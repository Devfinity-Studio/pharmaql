import fs from "fs";
import path from "path";

const file = "APBARODA-APRIL2026.sql";
const data = fs.readFileSync(path.join("demo data", file), "utf-8");
const idx = data.indexOf("INSERT INTO `m_mr`");
console.log(`${file}:`, data.substring(idx, idx + 500));
