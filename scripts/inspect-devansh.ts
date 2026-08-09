import fs from "fs";
import readline from "readline";

async function inspectDevanshLine() {
	const rl = readline.createInterface({
		input: fs.createReadStream("demo data/APBARODA_2.sql"),
		crlfDelay: Infinity,
	});
	let currentTable = "";

	for await (const line of rl) {
		if (line.includes("INSERT INTO")) {
			const m = line.match(/INSERT INTO `([^`]+)`/i);
			if (m) currentTable = m[1].toLowerCase();
		}
		if (
			currentTable === "m_mr" &&
			line.includes("prajapatidevansh87@gmail.com")
		) {
			console.log("RAW LINE IN APBARODA_2.sql:", line);
		}
	}
	process.exit(0);
}

inspectDevanshLine().catch((e) => {
	console.error(e);
	process.exit(1);
});
