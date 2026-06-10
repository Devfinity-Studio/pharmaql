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
  emailVerified: boolean("email_verified").$defaultFn(() => false).notNull(),
  image: text("image"),
  role: text("role").$defaultFn(() => "MR").notNull(), // "ADMIN" or "MR"
  createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()).notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
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
    stock: d.integer("stock").notNull().default(0),
    freeScheme: d.text("free_scheme"), // e.g., "10+2"
    manufacturer: d.text("manufacturer").notNull().default("Unknown"),
    createdAt: d.timestamp("created_at").$defaultFn(() => new Date()).notNull(),
    updatedAt: d.timestamp("updated_at").$defaultFn(() => new Date()).notNull(),
}));

export const sales = createTable("sale", (d) => ({
    id: d.text("id").primaryKey(),
    productId: d.text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    quantity: d.integer("quantity").notNull(),
    notes: d.text("notes"),
    createdAt: d.timestamp("created_at").$defaultFn(() => new Date()).notNull(),
    updatedAt: d.timestamp("updated_at").$defaultFn(() => new Date()).notNull(),
}));

export const mrManufacturers = createTable("mr_manufacturer", (d) => ({
    id: d.text("id").primaryKey(),
    mrId: d.text("mr_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    manufacturer: d.text("manufacturer").notNull(),
    createdAt: d.timestamp("created_at").$defaultFn(() => new Date()).notNull(),
}), (t) => [
    index("mr_mfg_mr_id_idx").on(t.mrId)
]);

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
    sales: many(sales)
}));

export const saleRelations = relations(sales, ({ one }) => ({
    product: one(products, { fields: [sales.productId], references: [products.id] })
}));

export const mrManufacturerRelations = relations(mrManufacturers, ({ one }) => ({
    mr: one(user, { fields: [mrManufacturers.mrId], references: [user.id] })
}));
