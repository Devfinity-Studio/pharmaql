const postgres = require("postgres");


const connectionString =
	process.env.DATABASE_URL ||
	"postgresql://neondb_owner:npg_0moVxqFMbDZ4@ep-divine-mud-apv9cwln-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require";
const sql = postgres(connectionString);

async function check() {
	const tables = [
		"pg-drizzle_user",
		"pg-drizzle_product",
		"pg-drizzle_sale",
		"pg-drizzle_mr_inventory",
		"pg-drizzle_invoice",
		"pg-drizzle_outstanding",
		"pg-drizzle_mr_manufacturer",
		"pg-drizzle_legacy_h_sale",
		"pg-drizzle_legacy_l_sale",
		"pg-drizzle_legacy_customers",
		"pg-drizzle_legacy_view_stocks",
		"pg-drizzle_legacy_h_batch",
		"pg-drizzle_scheme",
		"pg-drizzle_gst_mrp_calculation",
		"pg-drizzle_customer",
		"pg-drizzle_batch",
	];
	for (const t of tables) {
		try {
			const res = await sql.unsafe(`SELECT count(*) FROM "${t}"`);
			console.log(t.padEnd(35), res[0].count);
		} catch (e) {
			console.log(t.padEnd(35), "table not created yet");
		}
	}
	await sql.end();
	process.exit(0);
}
check();
