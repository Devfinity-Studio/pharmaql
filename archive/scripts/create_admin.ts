import { hashPassword } from "better-auth/crypto";
import { db } from "./src/server/db";
import { account, user } from "./src/server/db/schema";

async function main() {
	const email = "admin@admin.com";
	const password = "Admin123";

	console.log(`Creating user: ${email}...`);

	// Insert User
	await db
		.insert(user)
		.values({
			id: email,
			name: "Admin",
			email: email,
			role: "ADMIN",
			emailVerified: true,
		})
		.onConflictDoUpdate({
			target: user.id,
			set: { role: "ADMIN" },
		});

	const hashedPassword = await hashPassword(password);

	// Insert Account
	await db
		.insert(account)
		.values({
			id: `credential-${email}`,
			accountId: email,
			providerId: "credential",
			userId: email,
			password: hashedPassword,
			createdAt: new Date(),
			updatedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: account.id,
			set: { password: hashedPassword },
		});

	console.log("Admin user created successfully.");
	process.exit(0);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
