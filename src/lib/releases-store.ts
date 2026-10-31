import crypto from "crypto";
import { getControlPlaneSql, initControlPlaneRelationalSchema } from "./control-plane-db";
import { readServerJson, writeServerJson } from "./server-storage";

export interface ApiServerRelease {
	id: string;
	version: string;
	platform: string;
	sha256: string;
	downloadUrl: string;
	mandatory: boolean;
	releaseNotes: string;
	isActive: boolean;
	createdAt: string;
}

export interface ApiServerInstance {
	id: string;
	instanceId: string;
	tenantSlug?: string | null;
	tenantName?: string | null;
	version: string;
	platform: string;
	machineFingerprint?: string | null;
	isVaultProtected: boolean;
	status: "ONLINE" | "UPDATING" | "OFFLINE";
	lastHeartbeat: string;
	metadata?: Record<string, any>;
	createdAt: string;
}

const DEFAULT_RELEASES: ApiServerRelease[] = [
	{
		id: "release-v1.2.2",
		version: "1.2.2",
		platform: "win-x64",
		sha256: "4af831030c764334083aef0bb316c0b7de742e45b14abbcaf11b3b4055cd10ef",
		downloadUrl: "/api/releases/download?version=1.2.2",
		mandatory: true,
		releaseNotes: "PharmaQL On-Premise API Engine v1.2.0: Self-installing Windows Service (pharmaql-api) with embedded NSSM, automatic Program Files setup, and machine-bound zero-knowledge encrypted vault.",
		isActive: true,
		createdAt: new Date().toISOString(),
	},
];

/**
 * Get the latest active release for a specific platform.
 */
export async function getLatestRelease(platform = "win-x64"): Promise<ApiServerRelease | null> {
	const sql = getControlPlaneSql();

	if (sql) {
		try {
			await initControlPlaneRelationalSchema();
			const rows = await sql`
				SELECT id, version, platform, sha256, download_url as "downloadUrl", mandatory, release_notes as "releaseNotes", is_active as "isActive", created_at as "createdAt"
				FROM api_server_releases
				WHERE is_active = true AND platform = ${platform}
				ORDER BY created_at DESC
				LIMIT 1;
			`;
			const row = rows[0];
			if (row) {
				return {
					id: String(row.id),
					version: String(row.version),
					platform: String(row.platform),
					sha256: String(row.sha256),
					downloadUrl: String(row.downloadUrl),
					mandatory: Boolean(row.mandatory),
					releaseNotes: String(row.releaseNotes || ""),
					isActive: Boolean(row.isActive),
					createdAt: new Date(String(row.createdAt)).toISOString(),
				};
			}
		} catch (err: any) {
			console.warn("[ReleasesStore] Failed to query releases from database:", err?.message || err);
		}
	}

	// Fallback to local server storage
	const releases = await readServerJson<ApiServerRelease[]>("releases.json", DEFAULT_RELEASES);
	const matched = releases
		.filter((r) => r.isActive && (!platform || r.platform === platform))
		.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

	return matched || DEFAULT_RELEASES[0] || null;
}

/**
 * Get all published releases.
 */
export async function getAllReleases(): Promise<ApiServerRelease[]> {
	const sql = getControlPlaneSql();

	if (sql) {
		try {
			await initControlPlaneRelationalSchema();
			const rows = await sql`
				SELECT id, version, platform, sha256, download_url as "downloadUrl", mandatory, release_notes as "releaseNotes", is_active as "isActive", created_at as "createdAt"
				FROM api_server_releases
				ORDER BY created_at DESC;
			`;
			if (rows.length > 0) {
				return rows.map((r) => ({
					id: String(r.id),
					version: String(r.version),
					platform: String(r.platform),
					sha256: String(r.sha256),
					downloadUrl: String(r.downloadUrl),
					mandatory: Boolean(r.mandatory),
					releaseNotes: String(r.releaseNotes || ""),
					isActive: Boolean(r.isActive),
					createdAt: new Date(String(r.createdAt)).toISOString(),
				}));
			}
		} catch (err: any) {
			console.warn("[ReleasesStore] Failed to query all releases from database:", err?.message || err);
		}
	}

	return await readServerJson<ApiServerRelease[]>("releases.json", DEFAULT_RELEASES);
}

/**
 * Publish a new release into the catalog.
 */
export async function publishRelease(
	release: Omit<ApiServerRelease, "id" | "createdAt">
): Promise<ApiServerRelease> {
	const id = crypto.randomUUID();
	const createdAt = new Date().toISOString();
	const newRelease: ApiServerRelease = {
		...release,
		id,
		createdAt,
	};

	const sql = getControlPlaneSql();

	if (sql) {
		try {
			await initControlPlaneRelationalSchema();
			await sql`
				INSERT INTO api_server_releases (id, version, platform, sha256, download_url, mandatory, release_notes, is_active, created_at)
				VALUES (${id}, ${release.version}, ${release.platform}, ${release.sha256}, ${release.downloadUrl}, ${release.mandatory}, ${release.releaseNotes}, ${release.isActive}, NOW())
				ON CONFLICT (version) DO UPDATE SET
					platform = EXCLUDED.platform,
					sha256 = EXCLUDED.sha256,
					download_url = EXCLUDED.download_url,
					mandatory = EXCLUDED.mandatory,
					release_notes = EXCLUDED.release_notes,
					is_active = EXCLUDED.is_active;
			`;
			return newRelease;
		} catch (err: any) {
			console.warn("[ReleasesStore] Failed to insert release into database:", err?.message || err);
		}
	}

	const releases = await readServerJson<ApiServerRelease[]>("releases.json", DEFAULT_RELEASES);
	const existingIndex = releases.findIndex((r) => r.version === release.version);
	if (existingIndex >= 0) {
		releases[existingIndex] = newRelease;
	} else {
		releases.unshift(newRelease);
	}
	await writeServerJson("releases.json", releases);

	return newRelease;
}

/**
 * Record a heartbeat from an on-premise API server instance.
 */
export async function recordInstanceHeartbeat(data: {
	instanceId: string;
	version: string;
	platform?: string;
	machineFingerprint?: string;
	isVaultProtected: boolean;
	status?: "ONLINE" | "UPDATING" | "OFFLINE";
	metadata?: Record<string, any>;
	tenantSlug?: string;
	tenantName?: string;
}): Promise<void> {
	const sql = getControlPlaneSql();
	const platform = data.platform || "win-x64";
	const status = data.status || "ONLINE";
	const now = new Date().toISOString();

	if (sql) {
		try {
			await initControlPlaneRelationalSchema();
			await sql`
				INSERT INTO api_server_instances (
					instance_id, version, platform, machine_fingerprint,
					is_vault_protected, status, last_heartbeat, metadata, created_at
				)
				VALUES (
					${data.instanceId}, ${data.version}, ${platform}, ${data.machineFingerprint || null},
					${data.isVaultProtected}, ${status}, NOW(), ${JSON.stringify(data.metadata || {})}::jsonb, NOW()
				)
				ON CONFLICT (instance_id) DO UPDATE SET
					version = EXCLUDED.version,
					platform = EXCLUDED.platform,
					machine_fingerprint = EXCLUDED.machine_fingerprint,
					is_vault_protected = EXCLUDED.is_vault_protected,
					status = EXCLUDED.status,
					last_heartbeat = NOW(),
					metadata = EXCLUDED.metadata;
			`;
			return;
		} catch (err: any) {
			console.warn("[ReleasesStore] Failed to record heartbeat to database:", err?.message || err);
		}
	}

	// Local fallback
	const instances = await readServerJson<ApiServerInstance[]>("instances.json", []);
	const idx = instances.findIndex((i) => i.instanceId === data.instanceId);
	const existing = idx >= 0 ? instances[idx] : undefined;
	const instance: ApiServerInstance = {
		id: existing ? existing.id : crypto.randomUUID(),
		instanceId: data.instanceId,
		tenantSlug: data.tenantSlug || (existing ? existing.tenantSlug : undefined),
		tenantName: data.tenantName || (existing ? existing.tenantName : undefined),
		version: data.version,
		platform,
		machineFingerprint: data.machineFingerprint,
		isVaultProtected: data.isVaultProtected,
		status,
		lastHeartbeat: now,
		metadata: data.metadata || {},
		createdAt: existing ? existing.createdAt : now,
	};

	if (idx >= 0) {
		instances[idx] = instance;
	} else {
		instances.push(instance);
	}

	await writeServerJson("instances.json", instances);
}

/**
 * List all registered on-premise API server instances and evaluate online/offline state.
 */
export async function getAllInstances(): Promise<ApiServerInstance[]> {
	const now = Date.now();
	// Consider offline if no heartbeat received for > 30 minutes
	const OFFLINE_THRESHOLD_MS = 30 * 60 * 1000;

	const sql = getControlPlaneSql();

	if (sql) {
		try {
			await initControlPlaneRelationalSchema();
			const rows = await sql`
				SELECT id, instance_id as "instanceId", version, platform,
				       machine_fingerprint as "machineFingerprint", is_vault_protected as "isVaultProtected",
				       status, last_heartbeat as "lastHeartbeat", metadata, created_at as "createdAt"
				FROM api_server_instances
				ORDER BY last_heartbeat DESC;
			`;
			if (rows.length > 0) {
				return rows.map((r) => {
					const lastSeen = new Date(String(r.lastHeartbeat)).getTime();
					const isRecent = now - lastSeen < OFFLINE_THRESHOLD_MS;
					return {
						id: String(r.id),
						instanceId: String(r.instanceId),
						version: String(r.version),
						platform: String(r.platform),
						machineFingerprint: r.machineFingerprint ? String(r.machineFingerprint) : null,
						isVaultProtected: Boolean(r.isVaultProtected),
						status: isRecent ? (r.status as "ONLINE" | "UPDATING" | "OFFLINE") : "OFFLINE",
						lastHeartbeat: new Date(String(r.lastHeartbeat)).toISOString(),
						metadata: (r.metadata as Record<string, any>) || {},
						createdAt: new Date(String(r.createdAt)).toISOString(),
					};
				});
			}
		} catch (err: any) {
			console.warn("[ReleasesStore] Failed to fetch instances from database:", err?.message || err);
		}
	}

	const list = await readServerJson<ApiServerInstance[]>("instances.json", []);
	return list.map((item) => {
		const lastSeen = new Date(item.lastHeartbeat).getTime();
		const isRecent = now - lastSeen < OFFLINE_THRESHOLD_MS;
		return {
			...item,
			status: isRecent ? item.status : "OFFLINE",
		};
	});
}
