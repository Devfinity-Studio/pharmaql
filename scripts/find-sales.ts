import fs from "fs";

const content = fs.readFileSync("import-all-demo.ts", "utf8");
const lines = content.split("\n");
lines.forEach((line, i) => {
	if (line.toLowerCase().includes("sales")) {
		console.log(i + 1, ":", line);
	}
});
