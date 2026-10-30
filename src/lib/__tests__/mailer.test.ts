import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSendMail, mockVerify, mockSql } = vi.hoisted(() => ({
	mockSendMail: vi.fn().mockResolvedValue({ messageId: "mock-msg-123" }),
	mockVerify: vi.fn().mockResolvedValue(true),
	mockSql: vi.fn(),
}));

vi.mock("nodemailer", () => ({
	default: {
		createTransport: vi.fn(() => ({
			sendMail: mockSendMail,
			verify: mockVerify,
		})),
	},
}));

vi.mock("../control-plane-db", () => ({
	getControlPlaneSql: vi.fn(() => mockSql),
}));

vi.mock("../local-tenants-store", () => ({
	getLocalTenantById: vi.fn(),
	getLocalTenantBySlug: vi.fn(),
}));

import { getTenantMailer, evictTenantMailer, sendOtpEmail } from "../mailer";
import { encryptSecret } from "../crypto";

describe("Multi-Tenant Mailer (src/lib/mailer.ts)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		evictTenantMailer("test-tenant-1");
		evictTenantMailer("test-tenant-unconfigured");
	});

	it("returns null when tenant has not configured custom SMTP", async () => {
		mockSql.mockResolvedValueOnce([
			{
				id: "test-tenant-unconfigured",
				display_name: "Apex Healthcare",
				smtp_host: null,
				smtp_user: null,
				smtp_password_encrypted: null,
			},
		]);

		const mailer = await getTenantMailer("test-tenant-unconfigured");
		expect(mailer).toBeNull();
	});

	it("dynamically decrypts credentials and instantiates pooled transporter when SMTP is configured", async () => {
		const encryptedPass = encryptSecret("superSecretAppPassword123!");
		mockSql.mockResolvedValueOnce([
			{
				id: "test-tenant-1",
				display_name: "Apex Healthcare Pvt Ltd",
				logo_url: "https://apex.com/logo.png",
				primary_color: "#1e3a8a",
				accent_color: "#3b82f6",
				support_email: "support@apex.com",
				contact_email: "contact@apex.com",
				smtp_host: "smtp.zoho.in",
				smtp_port: 465,
				smtp_secure: true,
				smtp_user: "notifications@apex.com",
				smtp_password_encrypted: encryptedPass,
				smtp_from_name: "Apex Dispatch",
				smtp_from_email: "notifications@apex.com",
			},
		]);

		const mailer = await getTenantMailer("test-tenant-1");
		expect(mailer).not.toBeNull();
		expect(mailer?.sender.name).toBe("Apex Dispatch");
		expect(mailer?.sender.email).toBe("notifications@apex.com");
		expect(mailer?.brand.name).toBe("Apex Healthcare Pvt Ltd");
		expect(mailer?.brand.primaryColor).toBe("#1e3a8a");

		// Second call should return cached instance without re-querying SQL
		const cachedMailer = await getTenantMailer("test-tenant-1");
		expect(cachedMailer).toBe(mailer);
		expect(mockSql).toHaveBeenCalledTimes(1);

		// Evict and verify cache is cleared
		evictTenantMailer("test-tenant-1");
		mockSql.mockResolvedValueOnce([
			{
				id: "test-tenant-1",
				display_name: "Apex Healthcare Pvt Ltd",
				smtp_host: "smtp.zoho.in",
				smtp_port: 465,
				smtp_secure: true,
				smtp_user: "notifications@apex.com",
				smtp_password_encrypted: encryptedPass,
			},
		]);
		await getTenantMailer("test-tenant-1");
		expect(mockSql).toHaveBeenCalledTimes(2);
	});

	it("throws explicit user error when sending OTP on tenant with unconfigured SMTP", async () => {
		mockSql.mockResolvedValueOnce([]);

		await expect(
			sendOtpEmail("rep@domain.com", "123456", "Rajesh Sharma", "test-tenant-unconfigured"),
		).rejects.toThrow(
			"Email service is not configured for this organization. Please contact your administrator.",
		);
	});

	it("sends white-labeled email with tenant branding when tenant SMTP is configured", async () => {
		const encryptedPass = encryptSecret("samplePassword123");
		mockSql.mockResolvedValueOnce([
			{
				id: "test-tenant-1",
				display_name: "Apex Healthcare",
				logo_url: "https://apex.com/logo.png",
				primary_color: "#0f766e",
				accent_color: "#0d9488",
				support_email: "help@apex.com",
				smtp_host: "smtp.gmail.com",
				smtp_port: 465,
				smtp_secure: true,
				smtp_user: "apex@gmail.com",
				smtp_password_encrypted: encryptedPass,
				smtp_from_name: "Apex Verification",
				smtp_from_email: "apex@gmail.com",
			},
		]);

		await sendOtpEmail("mr@apex.com", "882211", "Vikram Patel", "test-tenant-1");

		expect(mockSendMail).toHaveBeenCalledTimes(1);
		const callArg = mockSendMail.mock.calls[0]?.[0] as any;
		expect(callArg?.to).toBe("mr@apex.com");
		expect(callArg?.from).toBe('"Apex Verification" <apex@gmail.com>');
		expect(callArg?.subject).toContain("Apex Healthcare");
		expect(callArg?.html).toContain("882211");
		expect(callArg?.html).toContain("Vikram Patel");
		expect(callArg?.html).toContain("help@apex.com");
	});
});
