import fs from "fs";
import readline from "readline";

async function run() {
	const rl = readline.createInterface({
		input: fs.createReadStream("demo data/dataexport.sql"),
	});
	const seen = new Set();
	for await (const line of rl) {
		if (line.startsWith("INSERT INTO `")) {
			const tableMatch = line.match(/^INSERT INTO `([^`]+)`/);
			if (tableMatch) {
				const table = tableMatch[1];
				if (!seen.has(table)) {
					seen.add(table);
					if (
						line.toLowerCase().includes("cust") &&
						(line.toLowerCase().includes("name") ||
							line.toLowerCase().includes("party") ||
							line.toLowerCase().includes("customer"))
					) {
						console.log(`[TABLE] ${table}`);
						console.log(line.substring(0, 500));
					}
				}
			}
		}
	}
}
run();
