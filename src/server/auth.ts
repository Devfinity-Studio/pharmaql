import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { env } from "@/env";
import * as schema from "./db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  secret: env.BETTER_AUTH_SECRET,
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "MR",
      },
      isBlocked: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      canViewFreeScheme: {
        type: "boolean",
        required: false,
        defaultValue: true,
      },
      canViewStock: {
        type: "boolean",
        required: false,
        defaultValue: true,
      },
      canViewSales: {
        type: "boolean",
        required: false,
        defaultValue: true,
      },
    },
  },
});
