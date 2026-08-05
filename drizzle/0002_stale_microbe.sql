CREATE TABLE "pg-drizzle_legacy_h_batch" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text,
	"batch_no" text,
	"prate" numeric,
	"ptr" numeric,
	"mrp" numeric,
	"cost_rate" numeric
);
--> statement-breakpoint
CREATE TABLE "pg-drizzle_legacy_view_stocks" (
	"id" text PRIMARY KEY NOT NULL,
	"cmp_no" text,
	"loc_no" text,
	"t_date" timestamp,
	"item_id" text,
	"batch_id" text,
	"opening" integer DEFAULT 0,
	"inward" integer DEFAULT 0,
	"s_ret_inward" integer DEFAULT 0,
	"add_stock_adj" integer DEFAULT 0,
	"outward" integer DEFAULT 0,
	"sale_qty" integer DEFAULT 0,
	"sale_f_qty" integer DEFAULT 0,
	"less_stock_adj" integer DEFAULT 0,
	"qty" integer DEFAULT 0
);
--> statement-breakpoint
ALTER TABLE "pg-drizzle_mr_inventory" ADD COLUMN "prate" numeric;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "can_view_party_wise" boolean NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "can_view_product_wise" boolean NOT NULL;--> statement-breakpoint
CREATE INDEX "legacy_hb_id_idx" ON "pg-drizzle_legacy_h_batch" USING btree ("id");--> statement-breakpoint
CREATE INDEX "legacy_hb_item_idx" ON "pg-drizzle_legacy_h_batch" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "legacy_vs_item_idx" ON "pg-drizzle_legacy_view_stocks" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "legacy_vs_loc_idx" ON "pg-drizzle_legacy_view_stocks" USING btree ("loc_no");--> statement-breakpoint
CREATE INDEX "legacy_vs_date_idx" ON "pg-drizzle_legacy_view_stocks" USING btree ("t_date");