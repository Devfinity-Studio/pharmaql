import { hashPassword } from "better-auth/crypto";
import { db } from "./src/server/db/index.ts";
import { account, user } from "./src/server/db/schema.ts";

async function main() {
	const email = "admin@admin.com";
	const hashedPassword = await hashPassword("Admin123");

	await db
		.insert(user)
		.values({
			id: email,
			name: "Admin",
			email: email,
			role: "ADMIN",
			isBlocked: false,
			canViewFreeScheme: true,
			canViewStock: true,
			canViewSales: true,
			canViewPartyWise: true,
			canViewProductWise: true,
			locNo: "11",
		})
		.onConflictDoUpdate({
			target: user.id,
			set: { role: "ADMIN", isBlocked: false },
		});

	await db
		.insert(account)
		.values({
			id: `account-${email}`,
			accountId: email,
			providerId: "credential",
			userId: email,
			password: hashedPassword,
			createdAt: new Date(),
			updatedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: account.id,
			set: { password: hashedPassword, updatedAt: new Date() },
		});

	console.log("SUCCESS: Admin created admin@admin.com / Admin123");
	process.exit(0);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
