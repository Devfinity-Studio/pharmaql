import { NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/server/db";
import { session, user } from "@/server/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const users = await db.select().from(user);
    const sessions = await db.select().from(session);

    return NextResponse.json({
      databaseUrl: env.DATABASE_URL.replace(/:[^:@]*@/, ":***@"), // hide password
      usersCount: users.length,
      sessionsCount: sessions.length,
      users: users,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
