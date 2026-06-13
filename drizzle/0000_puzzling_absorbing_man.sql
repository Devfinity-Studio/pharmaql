CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pg-drizzle_invoice" (
	"id" text PRIMARY KEY NOT NULL,
	"mr_id" text NOT NULL,
	"date" timestamp,
	"inw_dt" timestamp,
	"inv_no" text,
	"inv_amt" numeric,
	"inv_type" text,
	"manufacturer_code" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pg-drizzle_mr_inventory" (
	"id" text PRIMARY KEY NOT NULL,
	"mr_id" text NOT NULL,
	"product_id" text NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"date" timestamp,
	"opening" integer,
	"inward" integer,
	"outward" integer,
	"ptr" numeric,
	"mrp" numeric,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pg-drizzle_mr_manufacturer" (
	"id" text PRIMARY KEY NOT NULL,
	"mr_id" text NOT NULL,
	"manufacturer" text NOT NULL,
	"firm_no" text,
	"division" text,
	"company" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pg-drizzle_outstanding" (
	"id" text PRIMARY KEY NOT NULL,
	"mr_id" text NOT NULL,
	"doctor" text,
	"city" text,
	"inv_no" text,
	"inv_dt" timestamp,
	"inv_amt" numeric,
	"manufacturer_code" text,
	"division" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pg-drizzle_product" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"free_scheme" text,
	"manufacturer" text DEFAULT 'Unknown' NOT NULL,
	"firm_no" text,
	"code" text,
	"division" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pg-drizzle_sale" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"mr_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"notes" text,
	"date" timestamp,
	"dealer" text,
	"area" text,
	"free_qty" integer,
	"amount" numeric,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"role" text NOT NULL,
	"is_blocked" boolean NOT NULL,
	"can_view_free_scheme" boolean NOT NULL,
	"can_view_stock" boolean NOT NULL,
	"can_view_sales" boolean NOT NULL,
	"loc_no" text,
	"rank" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pg-drizzle_invoice" ADD CONSTRAINT "pg-drizzle_invoice_mr_id_user_id_fk" FOREIGN KEY ("mr_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pg-drizzle_mr_inventory" ADD CONSTRAINT "pg-drizzle_mr_inventory_mr_id_user_id_fk" FOREIGN KEY ("mr_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pg-drizzle_mr_inventory" ADD CONSTRAINT "pg-drizzle_mr_inventory_product_id_pg-drizzle_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."pg-drizzle_product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pg-drizzle_mr_manufacturer" ADD CONSTRAINT "pg-drizzle_mr_manufacturer_mr_id_user_id_fk" FOREIGN KEY ("mr_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pg-drizzle_outstanding" ADD CONSTRAINT "pg-drizzle_outstanding_mr_id_user_id_fk" FOREIGN KEY ("mr_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pg-drizzle_sale" ADD CONSTRAINT "pg-drizzle_sale_product_id_pg-drizzle_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."pg-drizzle_product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pg-drizzle_sale" ADD CONSTRAINT "pg-drizzle_sale_mr_id_user_id_fk" FOREIGN KEY ("mr_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mr_inv_mr_id_idx" ON "pg-drizzle_mr_inventory" USING btree ("mr_id");--> statement-breakpoint
CREATE INDEX "mr_inv_product_id_idx" ON "pg-drizzle_mr_inventory" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "mr_mfg_mr_id_idx" ON "pg-drizzle_mr_manufacturer" USING btree ("mr_id");