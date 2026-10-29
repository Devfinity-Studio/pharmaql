import "server-only";
import { Pool, type PoolConfig } from "pg";
import { decryptSecret } from "../crypto";
import type { TenantRecord } from "../control-plane-db";

interface CachedPoolEntry {
	pool: Pool;
	lastUsed: number;
	connectionString: string;
}

const poolRegistry = new Map<string, CachedPoolEntry>();
const IDLE_EVICTION_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const SERVERLESS_POOL_MAX = 2; // Maximum 2 connections per lambda
const SERVERLESS_IDLE_TIMEOUT_MS = 300000; // 5 minutes

/**
 * Periodically evicts pools that have been idle for > 15 minutes.
 */
function evictIdlePools(): void {
	const now = Date.now();
	for (const [tenantId, entry] of poolRegistry.entries()) {
		if (now - entry.lastUsed > IDLE_EVICTION_THRESHOLD_MS) {
			console.log(`[TenantPool] Evicting idle database pool for tenant: ${tenantId}`);
			entry.pool.end().catch((err) => {
				console.warn(`[TenantPool] Error closing idle pool for tenant ${tenantId}:`, err.message);
			});
			poolRegistry.delete(tenantId);
		}
	}
}

// Start periodic eviction check every 5 minutes in long-running Node processes
if (typeof setInterval !== "undefined") {
	const timer = setInterval(evictIdlePools, 5 * 60 * 1000);
	if (timer.unref) {
		timer.unref();
	}
}

/**
 * Dynamically resolves and acquires a read-only PostgreSQL connection pool for the given tenant.
 * Strictly enforces `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` on every checked-out connection.
 * Purely Node.js runtime (server-only) - NEVER import inside Next.js Edge Middleware!
 */
export async function getTenantDbPool(tenant: TenantRecord): Promise<Pool> {
	if (tenant.db_type !== "postgres") {
		throw new Error(
			`Tenant ${tenant.slug} is configured for '${tenant.db_type}', not direct 'postgres'.`,
		);
	}

	if (!tenant.db_connection_encrypted) {
		throw new Error(
			`Tenant ${tenant.slug} has no encrypted PostgreSQL connection string configured.`,
		);
	}

	const connectionString = decryptSecret(tenant.db_connection_encrypted);
	const cached = poolRegistry.get(tenant.id);

	if (cached) {
		// If connection string hasn't changed, refresh timestamp and return existing pool
		if (cached.connectionString === connectionString) {
			cached.lastUsed = Date.now();
			return cached.pool;
		}
		// If credentials changed, safely close old pool
		cached.pool.end().catch(() => {});
		poolRegistry.delete(tenant.id);
	}

	const poolConfig: PoolConfig = {
		connectionString,
		max: SERVERLESS_POOL_MAX,
		idleTimeoutMillis: SERVERLESS_IDLE_TIMEOUT_MS,
		connectionTimeoutMillis: 10000,
	};

	const pool = new Pool(poolConfig);

	// Enforce strict read-only transaction semantics on every connection checkout
	pool.on("connect", (client) => {
		client
			.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;")
			.catch((err) => {
				console.error(
					`[TenantPool] Failed to enforce read-only session on tenant ${tenant.slug}:`,
					err.message,
				);
			});
	});

	pool.on("error", (err) => {
		console.error(`[TenantPool] Unexpected database error on tenant ${tenant.slug}:`, err.message);
	});

	poolRegistry.set(tenant.id, {
		pool,
		lastUsed: Date.now(),
		connectionString,
	});

	return pool;
}

/**
 * Manually evicts a specific tenant's pool (e.g. after credential updates).
 */
export async function evictTenantPool(tenantId: string): Promise<void> {
	const entry = poolRegistry.get(tenantId);
	if (entry) {
		await entry.pool.end().catch(() => {});
		poolRegistry.delete(tenantId);
	}
}

/**
 * Gracefully shuts down all active tenant connection pools.
 */
export async function closeAllTenantPools(): Promise<void> {
	const closePromises: Promise<void>[] = [];
	for (const [id, entry] of poolRegistry.entries()) {
		closePromises.push(entry.pool.end().catch(() => {}));
		poolRegistry.delete(id);
	}
	await Promise.all(closePromises);
}

/**
 * Inspect active pools count for monitoring/telemetry.
 */
export function getActivePoolsCount(): number {
	return poolRegistry.size;
}
