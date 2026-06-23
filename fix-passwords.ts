import { hashPassword } from "better-auth/crypto";
import { sql } from "drizzle-orm";
import * as fs from "fs";
import { db } from "./src/server/db";
import { account, user } from "./src/server/db/schema";

async function fixPasswords() {
  const content = fs.readFileSync("./demo data/APBARODA_1.sql", "utf8");
  const lines = content.split("\n");

  let currentTable = "";
  let foundMr = false;

  for (const line of lines) {
    const trimmed = line.trim();

    const insertMatch = trimmed.match(/^INSERT INTO `(.*?)`/i);
    if (insertMatch && insertMatch[1]) {
      currentTable = insertMatch[1].toLowerCase();
      if (currentTable === "m_mr") foundMr = true;
      continue;
    }

    if (currentTable === "m_mr" && trimmed.startsWith("(")) {
      const match = trimmed.match(/^\((.*)\)[,;]$/);
      if (!match) continue;

      const valuesStr = match[1];
      if (!valuesStr) continue;
      const parts = valuesStr
        .split(/,(?=(?:(?:[^']*'){2})*[^']*$)/)
        .map((s) => {
          let clean = s.trim();
          if (clean.startsWith("'") && clean.endsWith("'")) {
            clean = clean.slice(1, -1);
          }
          return clean;
        });

      const [
        firmNo,
        locno,
        code,
        division,
        company,
        mrName,
        loginId,
        loginPassword,
        rank,
      ] = parts;

      if (loginId && loginPassword) {
        const email = loginId.includes("@")
          ? loginId.toLowerCase()
          : `${loginId.toLowerCase()}@demo.com`;

        try {
          const hashed = await hashPassword(loginPassword);

          await db
            .insert(account)
            .values({
              id: `credential-${email}`,
              accountId: email,
              providerId: "credential",
              userId: loginId,
              password: hashed,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: account.id,
              set: { password: sql`EXCLUDED.password`, updatedAt: new Date() },
            });
          console.log(`Saved password for ${email}`);
        } catch (e) {
          console.error(`Failed to save password for ${email}`, e);
        }
      }
    }

    if (foundMr && currentTable !== "m_mr") {
      break;
    }
  }

  console.log("Finished saving passwords.");
  process.exit(0);
}

fixPasswords();
