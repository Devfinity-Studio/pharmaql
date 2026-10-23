import { beforeEach, describe, expect, it } from "vitest";
import {
	checkLoginAllowed,
	checkOtpVerifyAllowed,
	rateLimitOtpRequest,
	rateLimitReportDownload,
	rateLimiter,
	recordLoginFailure,
	recordLoginSuccess,
	recordOtpVerifyFailure,
	recordOtpVerifySuccess,
} from "../rate-limit";

describe("rate-limit engine", () => {
	const testIp = "192.168.1.100";
	const testEmail = "rep@pharmaql.test";

	beforeEach(() => {
		// Reset state before each test
		rateLimiter.reset(`otp_req:ip:${testIp}`);
		rateLimiter.reset(`otp_req:id:${testEmail}`);
		rateLimiter.reset(`otp_verify:ip:${testIp}`);
		rateLimiter.reset(`otp_verify:email:${testEmail}`);
		rateLimiter.reset(`login:ip:${testIp}`);
		rateLimiter.reset(`report_download:${testIp}`);
	});

	describe("MemoryRateLimiter core sliding window", () => {
		it("allows requests under the limit and tracks remaining", () => {
			const key = "test:sliding:1";
			rateLimiter.reset(key);

			const r1 = rateLimiter.check(key, 3, 60);
			expect(r1.success).toBe(true);
			expect(r1.remaining).toBe(2);

			const r2 = rateLimiter.check(key, 3, 60);
			expect(r2.success).toBe(true);
			expect(r2.remaining).toBe(1);

			const r3 = rateLimiter.check(key, 3, 60);
			expect(r3.success).toBe(true);
			expect(r3.remaining).toBe(0);

			// Exceeds limit
			const r4 = rateLimiter.check(key, 3, 60);
			expect(r4.success).toBe(false);
			expect(r4.remaining).toBe(0);
		});

		it("resets counters when explicitly reset", () => {
			const key = "test:reset:1";
			rateLimiter.check(key, 1, 60);
			expect(rateLimiter.check(key, 1, 60).success).toBe(false);

			rateLimiter.reset(key);
			expect(rateLimiter.check(key, 1, 60).success).toBe(true);
		});
	});

	describe("OTP Request Limiting", () => {
		it("allows up to 5 OTP requests in the window", () => {
			for (let i = 0; i < 5; i++) {
				const res = rateLimitOtpRequest(testIp, testEmail);
				expect(res.allowed).toBe(true);
			}
			const blocked = rateLimitOtpRequest(testIp, testEmail);
			expect(blocked.allowed).toBe(false);
			expect(blocked.message).toContain("Too many OTP requests");
		});
	});

	describe("Brute Force Lockout on Repeated Failures", () => {
		it("locks out account after 5 consecutive failed OTP attempts", () => {
			expect(checkOtpVerifyAllowed(testIp, testEmail).allowed).toBe(true);

			for (let i = 0; i < 4; i++) {
				const msg = recordOtpVerifyFailure(testIp, testEmail);
				expect(msg).toContain("Invalid OTP code");
			}

			// 5th failure triggers lockout
			const lockMsg = recordOtpVerifyFailure(testIp, testEmail);
			expect(lockMsg).toContain("Too many failed attempts. Account locked");

			const check = checkOtpVerifyAllowed(testIp, testEmail);
			expect(check.allowed).toBe(false);
			expect(check.retryAfterSeconds).toBeGreaterThan(0);

			// Success resets lockout
			recordOtpVerifySuccess(testIp, testEmail);
			expect(checkOtpVerifyAllowed(testIp, testEmail).allowed).toBe(true);
		});

		it("locks out IP after 5 consecutive failed login attempts", () => {
			expect(checkLoginAllowed(testIp).allowed).toBe(true);

			for (let i = 0; i < 4; i++) {
				recordLoginFailure(testIp);
			}
			expect(checkLoginAllowed(testIp).allowed).toBe(true);

			recordLoginFailure(testIp);
			expect(checkLoginAllowed(testIp).allowed).toBe(false);

			recordLoginSuccess(testIp);
			expect(checkLoginAllowed(testIp).allowed).toBe(true);
		});
	});

	describe("Report Export Rate Limiting", () => {
		it("allows downloads up to 30 requests per window", () => {
			const res = rateLimitReportDownload(testIp, "user-123");
			expect(res.allowed).toBe(true);
			expect(res.remaining).toBe(29);
		});
	});
});
