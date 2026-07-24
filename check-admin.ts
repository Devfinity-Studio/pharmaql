import { db } from './src/server/db/index';
import { user, account } from './src/server/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';

async function main() {
	let adminUser = await db.query.user.findFirst({
		where: eq(user.email, 'admin@admin.com')
	});

	if (!adminUser) {
		console.log('Admin user not found, creating...');
		const hashedPassword = await hashPassword('Admin123');
		await db.insert(user).values({
			id: 'admin',
			name: 'Admin User',
			email: 'admin@admin.com',
			role: 'ADMIN',
		});
		await db.insert(account).values({
			id: 'credential-admin@admin.com',
			accountId: 'admin@admin.com',
			providerId: 'credential',
			userId: 'admin',
			password: hashedPassword,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		console.log('Admin user created successfully.');
	} else {
		console.log('Admin user already exists. Resetting password to Admin123...');
		const hashedPassword = await hashPassword('Admin123');
		await db.update(account)
			.set({ password: hashedPassword })
			.where(eq(account.userId, adminUser.id));
		console.log('Admin password reset successfully.');
	}
	process.exit(0);
}
main();
