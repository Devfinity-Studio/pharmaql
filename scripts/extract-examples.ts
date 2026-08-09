import fs from 'fs';
import readline from 'readline';
import path from 'path';

async function main() {
    const rl = readline.createInterface({ input: fs.createReadStream(path.join(process.cwd(), "demo data", "dataexport.sql")) });
    
    for await (const line of rl) {
        if (line.includes("INSERT INTO `h_batch` (")) {
            console.log(line);
            break;
        }
    }
}
main();
