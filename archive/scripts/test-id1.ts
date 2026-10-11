import fs from "fs";
import readline from "readline";

async function main() {
	const rl = readline.createInterface({
		input: fs.createReadStream("demo data/dataexport.sql", {
			encoding: "utf-8",
		}),
		crlfDelay: Infinity,
	});

	let vsMode = false;
	let found = 0;
	for await (const line of rl) {
		if (line.match(/^INSERT INTO `view_stocks`/i)) {
			vsMode = true;
			continue;
		}
		if (
			line.match(/^INSERT INTO/i) &&
			!line.match(/^INSERT INTO `view_stocks`/i)
		) {
			vsMode = false;
		}

		if (vsMode && line.trim().startsWith("(")) {
			const match = line.trim().match(/^\((.*)\)[,;]$/);
			if (match) {
				const p = match[1].split(/,(?=(?:(?:[^']*'){2})*[^']*$)/).map((s) => {
					let c = s.trim();
					if (c.startsWith("'") && c.endsWith("'"))
						c = c.slice(1, -1).replace(/\\'/g, "'");
					return c;
				});
				if (p.length >= 23 && p[0] === "1") {
					console.log("ID 1:", {
						item_id: p[7],
						entry_type: p[9],
						s_ret: p[12],
					});
					found++;
				}
			}
		}
	}
	console.log("Total ID 1 found:", found);
}
main();
