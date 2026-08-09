import fs from "fs";
import path from "path";

function walkDir(dir: string, callback: (path: string) => void) {
	fs.readdirSync(dir).forEach((f) => {
		const dirPath = path.join(dir, f);
		const isDirectory = fs.statSync(dirPath).isDirectory();
		if (isDirectory) {
			walkDir(dirPath, callback);
		} else if (dirPath.endsWith(".ts") || dirPath.endsWith(".tsx")) {
			callback(dirPath);
		}
	});
}

walkDir("src", (filePath: string) => {
	let content = fs.readFileSync(filePath, "utf8");
	const original = content;

	content = content.replace(
		/let salesCondition = and\(inArray\(sales\.productId, productIds\), eq\(sales\.mrId, mrId\)\);/g,
		"let salesCondition = inArray(sales.productId, productIds);",
	);

	content = content.replace(
		/let inventoryCondition = and\(inArray\(mrInventory\.productId, productIds\), eq\(mrInventory\.mrId, mrId\)\);/g,
		"let inventoryCondition = inArray(mrInventory.productId, productIds);",
	);

	content = content.replace(
		/let salesCondition = and\([\s\S]*?inArray\(sales\.productId, productIds\),[\s\S]*?eq\(sales\.mrId, mrId\),?[\s\S]*?\);/g,
		"let salesCondition = inArray(sales.productId, productIds);",
	);

	content = content.replace(
		/let inventoryCondition = and\([\s\S]*?inArray\(mrInventory\.productId, productIds\),[\s\S]*?eq\(mrInventory\.mrId, mrId\),?[\s\S]*?\);/g,
		"let inventoryCondition = inArray(mrInventory.productId, productIds);",
	);

	if (content !== original) {
		fs.writeFileSync(filePath, content, "utf8");
		console.log("Fixed", filePath);
	}
});
