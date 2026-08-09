import fs from "fs";
import readline from "readline";

async function run() {
    const rl = readline.createInterface({ input: fs.createReadStream('demo data/APBARODA.sql') });
    for await (const line of rl) {
        if (line.includes("3618") && line.toLowerCase().includes("aadhya")) {
            console.log(line.substring(0, 500));
            break;
        }
    }
    process.exit(0);
}
run();
