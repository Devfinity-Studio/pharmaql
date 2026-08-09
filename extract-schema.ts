import fs from 'fs';
import readline from 'readline';

async function main() {
    const rl = readline.createInterface({
        input: fs.createReadStream('demo data/dataexport.sql', { encoding: 'utf-8' }),
        crlfDelay: Infinity
    });

    let sret_count = 0;
    let vsMode = false;
    for await (const line of rl) {
        if (line.match(/^INSERT INTO `view_stocks`/i)) {
            vsMode = true;
            continue;
        }
        if (line.match(/^INSERT INTO/i) && !line.match(/^INSERT INTO `view_stocks`/i)) {
            vsMode = false;
        }

        if (vsMode && line.trim().startsWith("(")) {
            const match = line.trim().match(/^\((.*)\)[,;]$/);
            if (match) {
                const p = match[1].split(/,(?=(?:(?:[^']*'){2})*[^']*$)/).map(s => s.trim());
                if (p.length > 12) {
                    const sret = parseFloat(p[12]);
                    if (sret > 0) {
                        sret_count++;
                    }
                }
            }
        }
    }
    console.log("Total sret_inward > 0:", sret_count);
}
main();
