import fs from "fs";
import readline from "readline";

async function run() {
	const rl = readline.createInterface({
		input: fs.createReadStream("demo data/APBARODA.sql"),
	});
	let count = 0;
	for await (const line of rl) {
		if (line.includes("INSERT INTO `t_item_sales`")) {
			console.log(line.substring(0, 500));
			count++;
			if (count > 5) break;
		}
	}
	process.exit(0);
}
run();
