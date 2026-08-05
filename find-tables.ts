import fs from "fs";
import readline from "readline";

async function main() {
  const rs = fs.createReadStream("demo data/dataexport.sql");
  const rl = readline.createInterface({ input: rs, crlfDelay: Infinity });
  
  const tables = new Set<string>();
  
  for await (const line of rl) {
    const match = line.match(/^INSERT (?:IGNORE )?INTO [`"']?(.*?)[`"']?\s*\(/i);
    if (match) {
      tables.add(match[1].toLowerCase());
    }
  }
  
  console.log("Tables found:", Array.from(tables).join(", "));
}

main();
