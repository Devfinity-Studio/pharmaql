import { describe, expect, it } from "vitest";
import { getClientIp, isIpAllowedForAdmin } from "../security";

describe("security utilities", () => {
	describe("getClientIp", () => {
		it("prioritizes cf-connecting-ip if present", () => {
			const headers = new Headers({
				"cf-connecting-ip": "203.0.113.195",
				"x-forwarded-for": "198.51.100.1, 10.0.0.1",
			});
			expect(getClientIp(headers)).toBe("203.0.113.195");
		});

		it("uses x-real-ip if cf-connecting-ip is not present", () => {
			const headers = new Headers({
				"x-real-ip": "198.51.100.22",
				"x-forwarded-for": "10.0.0.5",
			});
			expect(getClientIp(headers)).toBe("198.51.100.22");
		});

		it("falls back to leftmost hop of x-forwarded-for if direct proxy headers missing", () => {
			const headers = new Headers({
				"x-forwarded-for": "203.0.113.50, 192.168.1.1",
			});
			expect(getClientIp(headers)).toBe("203.0.113.50");
		});

		it("returns 127.0.0.1 when no headers provided", () => {
			const headers = new Headers();
			expect(getClientIp(headers)).toBe("127.0.0.1");
		});
	});

	describe("isIpAllowedForAdmin", () => {
		it("allows all IPs when ADMIN_ALLOWED_IPS is not set", () => {
			const oldEnv = process.env.ADMIN_ALLOWED_IPS;
			delete process.env.ADMIN_ALLOWED_IPS;

			expect(isIpAllowedForAdmin("192.168.1.50")).toBe(true);

			process.env.ADMIN_ALLOWED_IPS = oldEnv;
		});

		it("restricts access to allowlisted IPs when configured", () => {
			process.env.ADMIN_ALLOWED_IPS = "203.0.113.50, 10.0.0.*";

			expect(isIpAllowedForAdmin("203.0.113.50")).toBe(true);
			expect(isIpAllowedForAdmin("10.0.0.99")).toBe(true);
			expect(isIpAllowedForAdmin("198.51.100.1")).toBe(false);

			delete process.env.ADMIN_ALLOWED_IPS;
		});
	});
});
