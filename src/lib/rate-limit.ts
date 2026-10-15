/**
 * In-Memory Sliding Window Rate Limiting Engine
 * Provides protection against brute-force attacks, credential stuffing, and export flooding.
 */

interface RateLimitRecord {
	count: number;
	resetAt: number;
	lockedUntil?: number;
}

class MemoryRateLimiter {
	private store = new Map<string, RateLimitRecord>();
	private cleanupInterval: NodeJS.Timeout | null = null;

	constructor() {
		// Clean up expired keys every 60 seconds
		if (typeof setInterval !== "undefined") {
			this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
			if (this.cleanupInterval && typeof this.cleanupInterval.unref === "function") {
				this.cleanupInterval.unref();
			}
		}
	}

	private cleanup() {
		const now = Date.now();
		for (const [key, record] of this.store.entries()) {
			const isExpired = record.resetAt <= now && (!record.lockedUntil || record.lockedUntil <= now);
			if (isExpired) {
				this.store.delete(key);
			}
		}
	}

	/**
	 * Standard sliding window check.
	 * Increments the counter and returns whether within limit.
	 */
	public check(
		key: string,
		limit: number,
		windowSeconds: number,
	): { success: boolean; remaining: number; resetInSeconds: number } {
		const now = Date.now();
		const record = this.store.get(key);

		// If entry doesn't exist or window has expired
		if (!record || record.resetAt <= now) {
			this.store.set(key, {
				count: 1,
				resetAt: now + windowSeconds * 1000,
			});
			return {
				success: true,
				remaining: limit - 1,
				resetInSeconds: windowSeconds,
			};
		}

		// Check if locked
		if (record.lockedUntil && record.lockedUntil > now) {
			const retryAfter = Math.ceil((record.lockedUntil - now) / 1000);
			return {
				success: false,
				remaining: 0,
				resetInSeconds: retryAfter,
			};
		}

		// Check if limit exceeded
		if (record.count >= limit) {
			const resetIn = Math.ceil((record.resetAt - now) / 1000);
			return {
				success: false,
				remaining: 0,
				resetInSeconds: resetIn,
			};
		}

		// Increment count
		record.count += 1;
		const remaining = Math.max(0, limit - record.count);
		const resetIn = Math.ceil((record.resetAt - now) / 1000);

		return {
			success: true,
			remaining,
			resetInSeconds: resetIn,
		};
	}

	/**
	 * Records a failed attempt for sensitive actions (e.g. invalid password, bad OTP).
	 * If failures exceed maxFailures, locks the key for lockoutSeconds.
	 */
	public recordFailure(
		key: string,
		maxFailures: number,
		windowSeconds: number,
		lockoutSeconds: number,
	): { locked: boolean; remainingAttempts: number; retryAfterSeconds: number } {
		const now = Date.now();
		const record = this.store.get(key);

		if (!record || record.resetAt <= now) {
			this.store.set(key, {
				count: 1,
				resetAt: now + windowSeconds * 1000,
			});
			return {
				locked: false,
				remainingAttempts: maxFailures - 1,
				retryAfterSeconds: 0,
			};
		}

		record.count += 1;

		if (record.count >= maxFailures) {
			record.lockedUntil = now + lockoutSeconds * 1000;
			return {
				locked: true,
				remainingAttempts: 0,
				retryAfterSeconds: lockoutSeconds,
			};
		}

		return {
			locked: false,
			remainingAttempts: Math.max(0, maxFailures - record.count),
			retryAfterSeconds: 0,
		};
	}

	/**
	 * Checks if a key is currently locked.
	 */
	public isLocked(key: string): { locked: boolean; retryAfterSeconds: number } {
		const now = Date.now();
		const record = this.store.get(key);
		if (!record || !record.lockedUntil || record.lockedUntil <= now) {
			return { locked: false, retryAfterSeconds: 0 };
		}
		const retryAfter = Math.ceil((record.lockedUntil - now) / 1000);
		return { locked: true, retryAfterSeconds: retryAfter };
	}

	/**
	 * Resets rate limit / failure counter for a key upon successful action.
	 */
	public reset(key: string) {
		this.store.delete(key);
	}
}

// Global singleton instance
export const rateLimiter = new MemoryRateLimiter();

/**
 * 1. Rate Limit for OTP Requests (Prevents SMS / Email Spamming)
 * 5 requests per 10 minutes per IP & per Email
 */
export function rateLimitOtpRequest(ip: string, emailOrPhone: string) {
	const ipKey = `otp_req:ip:${ip}`;
	const idKey = `otp_req:id:${emailOrPhone.toLowerCase()}`;

	const ipRes = rateLimiter.check(ipKey, 5, 600);
	if (!ipRes.success) {
		return {
			allowed: false,
			message: `Too many OTP requests from your network. Please try again in ${ipRes.resetInSeconds} seconds.`,
			resetInSeconds: ipRes.resetInSeconds,
		};
	}

	const idRes = rateLimiter.check(idKey, 5, 600);
	if (!idRes.success) {
		return {
			allowed: false,
			message: `Too many OTP requests for this account. Please wait ${idRes.resetInSeconds} seconds.`,
			resetInSeconds: idRes.resetInSeconds,
		};
	}

	return { allowed: true, remaining: Math.min(ipRes.remaining, idRes.remaining) };
}

/**
 * 2. Rate Limit & Lockout for OTP Verifications (Prevents Brute-Forcing 6-digit PIN)
 * 5 failed attempts per 15 minutes results in 15 minute lockout
 */
export function checkOtpVerifyAllowed(ip: string, email: string) {
	const ipKey = `otp_verify:ip:${ip}`;
	const emailKey = `otp_verify:email:${email.toLowerCase()}`;

	const ipLock = rateLimiter.isLocked(ipKey);
	if (ipLock.locked) {
		return {
			allowed: false,
			message: `Too many incorrect attempts from your network. Locked for ${ipLock.retryAfterSeconds} seconds.`,
			retryAfterSeconds: ipLock.retryAfterSeconds,
		};
	}

	const emailLock = rateLimiter.isLocked(emailKey);
	if (emailLock.locked) {
		return {
			allowed: false,
			message: `Account temporarily locked due to repeated incorrect OTP attempts. Try again in ${emailLock.retryAfterSeconds} seconds.`,
			retryAfterSeconds: emailLock.retryAfterSeconds,
		};
	}

	return { allowed: true };
}

export function recordOtpVerifyFailure(ip: string, email: string) {
	const ipKey = `otp_verify:ip:${ip}`;
	const emailKey = `otp_verify:email:${email.toLowerCase()}`;

	rateLimiter.recordFailure(ipKey, 5, 900, 900);
	const res = rateLimiter.recordFailure(emailKey, 5, 900, 900);

	if (res.locked) {
		return `Too many failed attempts. Account locked for ${res.retryAfterSeconds} seconds.`;
	}
	return `Invalid OTP code. ${res.remainingAttempts} attempts remaining.`;
}

export function recordOtpVerifySuccess(ip: string, email: string) {
	rateLimiter.reset(`otp_verify:ip:${ip}`);
	rateLimiter.reset(`otp_verify:email:${email.toLowerCase()}`);
}

/**
 * 3. Rate Limit for Admin / Dev Login Attempts
 * 5 failed attempts per 15 minutes results in 15 minute lockout
 */
export function checkLoginAllowed(ip: string) {
	const ipKey = `login:ip:${ip}`;
	const lock = rateLimiter.isLocked(ipKey);
	if (lock.locked) {
		return {
			allowed: false,
			message: `Too many failed login attempts. IP temporarily locked for ${lock.retryAfterSeconds} seconds.`,
			retryAfterSeconds: lock.retryAfterSeconds,
		};
	}
	return { allowed: true };
}

export function recordLoginFailure(ip: string) {
	const ipKey = `login:ip:${ip}`;
	const res = rateLimiter.recordFailure(ipKey, 5, 900, 900);
	if (res.locked) {
		return `Too many failed login attempts. Access blocked for ${res.retryAfterSeconds} seconds.`;
	}
	return `Invalid credentials. ${res.remainingAttempts} attempts remaining.`;
}

export function recordLoginSuccess(ip: string) {
	rateLimiter.reset(`login:ip:${ip}`);
}

/**
 * 4. Rate Limit for Password-Protected Admin Unblock Override
 * 5 attempts per 15 minutes per IP
 */
export function checkAdminUnblockAllowed(ip: string) {
	const ipKey = `unblock:ip:${ip}`;
	const lock = rateLimiter.isLocked(ipKey);
	if (lock.locked) {
		return {
			allowed: false,
			message: `Too many unblock attempts. Temporarily locked for ${lock.retryAfterSeconds} seconds.`,
			retryAfterSeconds: lock.retryAfterSeconds,
		};
	}
	return { allowed: true };
}

export function recordAdminUnblockFailure(ip: string) {
	const ipKey = `unblock:ip:${ip}`;
	return rateLimiter.recordFailure(ipKey, 5, 900, 900);
}

export function recordAdminUnblockSuccess(ip: string) {
	rateLimiter.reset(`unblock:ip:${ip}`);
}

/**
 * 5. Rate Limit for Report Export Downloads (PDF & Excel)
 * Max 30 report exports per 5 minutes per user/IP
 */
export function rateLimitReportDownload(ip: string, userId: string) {
	const key = `report_download:${userId || ip}`;
	const res = rateLimiter.check(key, 30, 300);
	return {
		allowed: res.success,
		remaining: res.remaining,
		resetInSeconds: res.resetInSeconds,
		message: res.success
			? null
			: `Report download rate limit reached (max 30 per 5 minutes). Please wait ${res.resetInSeconds} seconds.`,
	};
}
