import fs from "fs";
import readline from "readline";

async function checkApMrs() {
	const files = fs
		.readdirSync("demo data")
		.filter((f) => f.startsWith("APBARODA") && f.endsWith(".sql"));
	const allMrs = new Map<string, { file: string; mrName: string }>();

	for (const f of files) {
		const rl = readline.createInterface({
			input: fs.createReadStream("demo data/" + f),
			crlfDelay: Infinity,
		});
		let currentTable = "";

		for await (const line of rl) {
			if (line.includes("INSERT INTO")) {
				const m = line.match(/INSERT INTO `([^`]+)`/i);
				if (m) currentTable = m[1].toLowerCase();
			}
			if (currentTable === "m_mr" && line.trim().startsWith("(")) {
				const parts = line
					.trim()
					.split(/,(?=(?:(?:[^']*'){2})*[^']*$)/)
					.map((s) => s.trim().replace(/^'|'$/g, ""));
				const loginId = parts[6];
				const mrName = parts[5];
				if (loginId && mrName) {
					allMrs.set(loginId, { file: f, mrName });
				}
			}
		}
	}

	console.log(
		"=== TOTAL UNIQUE MR LOGINS FOUND IN ALL APBARODA FILES:",
		allMrs.size,
		"===",
	);
	for (const [login, info] of allMrs.entries()) {
		console.log(
			`LoginId: ${login} | Name: ${info.mrName} | File: ${info.file}`,
		);
	}
}

checkApMrs().catch((e) => {
	console.error(e);
	process.exit(1);
});
