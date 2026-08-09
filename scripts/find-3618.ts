import fs from "fs";
import readline from "readline";

async function run() {
    const files = ["demo data/APBARODA.sql", "demo data/APBARODA_1.sql", "demo data/APBARODA_2.sql", "demo data/APBARODA-APRIL2026.sql", "demo data/APBARODA-MAY2026.sql", "demo data/APBARODA-JUNE2026.sql", "demo data/dataexport.sql"];
    for (const file of files) {
        if (!fs.existsSync(file)) continue;
        const rl = readline.createInterface({ input: fs.createReadStream(file) });
        for await (const line of rl) {
            if (line.includes("3618") && line.toLowerCase().includes("aadhya")) {
                console.log(`FOUND in ${file}:`);
                console.log(line.substring(0, 500));
            }
        }
    }
}
run();
