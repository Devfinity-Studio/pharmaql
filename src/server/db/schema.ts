import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  pgTableCreator,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => `pg-drizzle_${name}`);

// BETTER AUTH TABLES
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  role: text("role")
    .$defaultFn(() => "MR")
    .notNull(), // "ADMIN" or "MR"
  isBlocked: boolean("is_blocked")
    .$defaultFn(() => false)
    .notNull(),
  canViewFreeScheme: boolean("can_view_free_scheme")
    .$defaultFn(() => true)
    .notNull(),
  canViewStock: boolean("can_view_stock")
    .$defaultFn(() => true)
    .notNull(),
  canViewSales: boolean("can_view_sales")
    .$defaultFn(() => true)
    .notNull(),
  locNo: text("loc_no"),
  rank: text("rank"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
});

// DOMAIN TABLES
export const products = createTable("product", (d) => ({
  id: d.text("id").primaryKey(), // Using text for custom IDs or generated UUIDs
  name: d.text("name").notNull(),
  freeScheme: d.text("free_scheme"), // e.g., "10+2"
  manufacturer: d.text("manufacturer").notNull().default("Unknown"),
  firmNo: d.text("firm_no"),
  code: d.text("code"),
  division: d.text("division"),
  createdAt: d
    .timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: d
    .timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
}));

export const sales = createTable("sale", (d) => ({
  id: d.text("id").primaryKey(),
  productId: d
    .text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  mrId: d
    .text("mr_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  quantity: d.integer("quantity").notNull(),
  notes: d.text("notes"),
  date: d.timestamp("date"),
  dealer: d.text("dealer"),
  area: d.text("area"),
  freeQty: d.integer("free_qty"),
  amount: d.numeric("amount"),
  createdAt: d
    .timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: d
    .timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
}));

export const mrManufacturers = createTable(
  "mr_manufacturer",
  (d) => ({
    id: d.text("id").primaryKey(),
    mrId: d
      .text("mr_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    manufacturer: d.text("manufacturer").notNull(),
    firmNo: d.text("firm_no"),
    division: d.text("division"),
    company: d.text("company"),
    createdAt: d
      .timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [index("mr_mfg_mr_id_idx").on(t.mrId)],
);

export const mrInventory = createTable(
  "mr_inventory",
  (d) => ({
    id: d.text("id").primaryKey(),
    mrId: d
      .text("mr_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    productId: d
      .text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    stock: d.integer("stock").notNull().default(0),
    date: d.timestamp("date"),
    opening: d.integer("opening"),
    inward: d.integer("inward"),
    outward: d.integer("outward"),
    ptr: d.numeric("ptr"),
    mrp: d.numeric("mrp"),
    updatedAt: d
      .timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    index("mr_inv_mr_id_idx").on(t.mrId),
    index("mr_inv_product_id_idx").on(t.productId),
  ],
);

export const invoices = createTable("invoice", (d) => ({
  id: d.text("id").primaryKey(),
  mrId: d
    .text("mr_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  date: d.timestamp("date"),
  inwDt: d.timestamp("inw_dt"),
  invNo: d.text("inv_no"),
  invAmt: d.numeric("inv_amt"),
  invType: d.text("inv_type"),
  manufacturerCode: d.text("manufacturer_code"),
  createdAt: d
    .timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
}));

export const outstanding = createTable("outstanding", (d) => ({
  id: d.text("id").primaryKey(),
  mrId: d
    .text("mr_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  doctor: d.text("doctor"),
  city: d.text("city"),
  invNo: d.text("inv_no"),
  invDt: d.timestamp("inv_dt"),
  invAmt: d.numeric("inv_amt"),
  manufacturerCode: d.text("manufacturer_code"),
  division: d.text("division"),
  createdAt: d
    .timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
}));

// RELATIONS
export const userRelations = relations(user, ({ many }) => ({
  account: many(account),
  session: many(session),
  manufacturers: many(mrManufacturers),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const productRelations = relations(products, ({ many }) => ({
  sales: many(sales),
}));

export const saleRelations = relations(sales, ({ one }) => ({
  product: one(products, {
    fields: [sales.productId],
    references: [products.id],
  }),
  mr: one(user, { fields: [sales.mrId], references: [user.id] }),
}));

export const mrManufacturerRelations = relations(
  mrManufacturers,
  ({ one }) => ({
    mr: one(user, { fields: [mrManufacturers.mrId], references: [user.id] }),
  }),
);

export const mrInventoryRelations = relations(mrInventory, ({ one }) => ({
  mr: one(user, { fields: [mrInventory.mrId], references: [user.id] }),
  product: one(products, {
    fields: [mrInventory.productId],
    references: [products.id],
  }),
}));
