/**
 * Unified Distributed Key-Value Store Adapter
 * Provides a resilient dual-mode state store:
 * 1. Default In-Memory Store: High-speed local store with automatic TTL expiration.
 * 2. Distributed Cloud Store (Upstash / Redis REST): Automatically active when
 *    UPSTASH_REDIS_REST_URL or KV_REST_API_URL is configured, enabling shared state across
 *    serverless Vercel Lambda instances.
 */

export interface KVStore {
	get<T>(key: string): Promise<T | null>;
	set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
	del(key: string): Promise<void>;
	has(key: string): Promise<boolean>;
}

interface MemoryKVEntry {
	value: any;
	expiresAt: number | null;
}

class MemoryKVStore implements KVStore {
	private store = new Map<string, MemoryKVEntry>();
	private cleanupInterval: NodeJS.Timeout | null = null;

	constructor() {
		if (typeof setInterval !== "undefined") {
			this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
			if (this.cleanupInterval && typeof this.cleanupInterval.unref === "function") {
				this.cleanupInterval.unref();
			}
		}
	}

	private cleanup() {
		const now = Date.now();
		for (const [key, entry] of this.store.entries()) {
			if (entry.expiresAt !== null && entry.expiresAt <= now) {
				this.store.delete(key);
			}
		}
	}

	async get<T>(key: string): Promise<T | null> {
		const entry = this.store.get(key);
		if (!entry) return null;
		if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
			this.store.delete(key);
			return null;
		}
		return entry.value as T;
	}

	async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
		const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
		this.store.set(key, { value, expiresAt });
	}

	async del(key: string): Promise<void> {
		this.store.delete(key);
	}

	async has(key: string): Promise<boolean> {
		const val = await this.get(key);
		return val !== null;
	}
}

class UpstashRestKVStore implements KVStore {
	private url: string;
	private token: string;

	constructor(url: string, token: string) {
		this.url = url.replace(/\/$/, "");
		this.token = token;
	}

	private async executeCommand(...args: (string | number)[]): Promise<any> {
		const res = await fetch(`${this.url}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(args),
		});

		if (!res.ok) {
			throw new Error(`Upstash REST API error: ${res.statusText}`);
		}

		const data = await res.json();
		return data.result;
	}

	async get<T>(key: string): Promise<T | null> {
		try {
			const res = await this.executeCommand("GET", key);
			if (res === null || res === undefined) return null;
			try {
				return JSON.parse(res) as T;
			} catch {
				return res as T;
			}
		} catch (err) {
			console.warn("[KVStore] Fallback read error:", err);
			return null;
		}
	}

	async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
		try {
			const serialized = typeof value === "string" ? value : JSON.stringify(value);
			if (ttlSeconds && ttlSeconds > 0) {
				await this.executeCommand("SET", key, serialized, "EX", ttlSeconds);
			} else {
				await this.executeCommand("SET", key, serialized);
			}
		} catch (err) {
			console.warn("[KVStore] Fallback write error:", err);
		}
	}

	async del(key: string): Promise<void> {
		try {
			await this.executeCommand("DEL", key);
		} catch (err) {
			console.warn("[KVStore] Fallback delete error:", err);
		}
	}

	async has(key: string): Promise<boolean> {
		const val = await this.get(key);
		return val !== null;
	}
}

function createKVStore(): KVStore {
	const restUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
	const restToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

	if (restUrl && restToken) {
		return new UpstashRestKVStore(restUrl, restToken);
	}

	return new MemoryKVStore();
}

export const kvStore: KVStore = createKVStore();
