import fs from "fs";
import readline from "readline";

async function main() {
  const rs = fs.createReadStream("demo data/dataexport.sql");
  const rl = readline.createInterface({ input: rs, crlfDelay: Infinity });
  
  let inViewStocks = false;
  let count = 0;
  
  for await (const line of rl) {
    if (line.match(/^INSERT (?:IGNORE )?INTO [`"']?h_batch[`"']?\s*\(/i)) {
      inViewStocks = true;
      console.log(line);
      continue;
    }
    
    if (inViewStocks) {
      console.log(line);
      count++;
      if (count > 5) break;
      if (line.trim().endsWith(";")) {
        break;
      }
    }
  }
}

main();
