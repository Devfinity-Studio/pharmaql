import { describe, it, expect } from "vitest";
process.loadEnvFile?.();
import { saveTenantAction, getTenantAction } from "../tenantActions";
import { loginAdminOrDev } from "@/server/actions/authActions";

describe("Admin email and password saving and login", () => {
	it("saves admin credentials and allows admin to login", async () => {
		const res = await getTenantAction("asmee");
		console.log("Current Asmee tenant from getTenantAction:", {
			admin_email: res.tenant?.admin_email,
			admin_password: res.tenant?.admin_password,
			has_admin_password: res.tenant?.has_admin_password,
		});

		const saveRes = await saveTenantAction({
			id: res.tenant.id,
			slug: res.tenant.slug,
			display_name: res.tenant.display_name,
			custom_domain: res.tenant.custom_domain,
			admin_email: "asmeepharma2022@gmail.com",
			admin_password: "AdminPassword123!",
		});

		console.log("Save result:", saveRes);
		expect(saveRes.success).toBe(true);

		const updated = await getTenantAction("asmee");
		console.log("Updated Asmee tenant:", {
			admin_email: updated.tenant?.admin_email,
			admin_password: updated.tenant?.admin_password,
			has_admin_password: updated.tenant?.has_admin_password,
		});

		expect(updated.tenant.admin_email).toBe("asmeepharma2022@gmail.com");
		expect(updated.tenant.admin_password).toBe("AdminPassword123!");

		// Test Login:
		const loginRes = await loginAdminOrDev("asmeepharma2022@gmail.com", "AdminPassword123!");
		console.log("Login result:", loginRes);
		expect(loginRes.success).toBe(true);

		// Test updating WITHOUT supplying password (password should be preserved):
		const partialSave = await saveTenantAction({
			id: res.tenant.id,
			slug: res.tenant.slug,
			display_name: "Asmee Pharma Updated",
			admin_email: "asmeepharma2022@gmail.com",
			// admin_password omitted or empty
		});
		expect(partialSave.success).toBe(true);

		const afterPartial = await getTenantAction("asmee");
		expect(afterPartial.tenant.admin_password).toBe("AdminPassword123!");

		const loginAfterPartial = await loginAdminOrDev("asmeepharma2022@gmail.com", "AdminPassword123!");
		expect(loginAfterPartial.success).toBe(true);
	}, 25000);
});
