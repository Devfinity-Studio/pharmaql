const fs = require("fs");

function run() {
  const content = fs.readFileSync("demo data/APBARODA_1.sql", "utf8");
  console.log(
    "m_item matches:",
    (content.match(/INSERT INTO `m_item`/gi) || []).length,
  );
  console.log(
    "t_item_sales matches:",
    (content.match(/INSERT INTO `t_item_sales`/gi) || []).length,
  );
  console.log(
    "t_dailyss matches:",
    (content.match(/INSERT INTO `t_dailyss`/gi) || []).length,
  );

  // also let's parse how many lines t_item_sales has
  let inSales = false;
  let salesRows = 0;
  const lines = content.split("\n");
  for (const line of lines) {
    if (line.includes("INSERT INTO `t_item_sales`")) {
      inSales = true;
    } else if (inSales && line.match(/^INSERT INTO/i)) {
      inSales = false;
    } else if (inSales && line.trim().startsWith("(")) {
      salesRows++;
    }
  }
  console.log("Actual rows under t_item_sales inserts:", salesRows);
}

run();
