import fs from "fs";
import readline from "readline";

async function testScan() {
	const file = "demo data/APBARODA_2.sql";
	const rl = readline.createInterface({
		input: fs.createReadStream(file),
		crlfDelay: Infinity,
	});

	let currentTable = "";
	const mrSpecs = new Map<string, any>();

	for await (const line of rl) {
		const trimmed = line.trim();
		const insertMatch = trimmed.match(/^INSERT INTO `(.*?)`/i);
		if (insertMatch && insertMatch[1]) {
			currentTable = insertMatch[1].toLowerCase();
			continue;
		}

		if (currentTable === "m_mr" && trimmed.startsWith("(")) {
			const match = trimmed.match(/^\((.*)\)[,;]$/);
			if (!match) continue;
			const valuesStr = match[1];

			const parts = valuesStr
				.split(/,(?=(?:(?:[^']*'){2})*[^']*$)/)
				.map((s) => {
					let clean = s.trim();
					if (clean.startsWith("'") && clean.endsWith("'")) {
						clean = clean.slice(1, -1).replace(/\\'/g, "'");
					}
					return clean;
				});

			const [
				firmNo,
				locno,
				code,
				division,
				company,
				mrName,
				loginId,
				loginPassword,
				rank,
			] = parts;
			console.log(
				`Parsed m_mr: code=${code}, locno=${locno}, loginId=${loginId}, name=${mrName}`,
			);
			if (loginId && mrName && locno && code) {
				const key = `${locno.trim()}-${code.trim()}`;
				if (!mrSpecs.has(key)) {
					mrSpecs.set(key, { name: mrName, loginId });
				}
			}
		}
	}

	console.log("Total MR specs parsed from APBARODA_2.sql:", mrSpecs.size);
	console.log(
		"Is prajapatidevansh87@gmail.com in mrSpecs?",
		Array.from(mrSpecs.values()).find((x) => x.loginId.includes("devansh")),
	);
	process.exit(0);
}

testScan().catch(console.error);
