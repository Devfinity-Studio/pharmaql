"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import {
	Activity,
	AlertCircle,
	Check,
	CheckCircle2,
	ChevronRight,
	Clock,
	Copy,
	Cpu,
	Download,
	ExternalLink,
	HardDrive,
	Lock,
	Plus,
	RefreshCw,
	Server,
	Shield,
	ShieldAlert,
	ShieldCheck,
	Terminal,
	UploadCloud,
	Zap,
} from "lucide-react";
import {
	getFleetAndReleasesAction,
	publishReleaseAction,
} from "@/server/actions/devReleases";
import type { ApiServerRelease, ApiServerInstance } from "@/lib/releases-store";

export function DevFleetPanel() {
	const [releases, setReleases] = useState<ApiServerRelease[]>([]);
	const [instances, setInstances] = useState<ApiServerInstance[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [copiedKey, setCopiedKey] = useState<string | null>(null);

	// Publish Modal State
	const [showPublishModal, setShowPublishModal] = useState(false);
	const [version, setVersion] = useState("");
	const [sha256, setSha256] = useState("");
	const [downloadUrl, setDownloadUrl] = useState("");
	const [releaseNotes, setReleaseNotes] = useState("");
	const [mandatory, setMandatory] = useState(false);
	const [isPending, startTransition] = useTransition();
	const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
	const [publishError, setPublishError] = useState<string | null>(null);

	const loadData = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const res = await getFleetAndReleasesAction();
			if (res.success && res.data) {
				setReleases(res.data.releases);
				setInstances(res.data.instances);
			} else {
				setError(res.error || "Failed to load fleet and release data.");
			}
		} catch (err: any) {
			setError(err.message || "Network error loading fleet data.");
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		loadData();
		// Poll every 15 seconds while on this tab
		const interval = setInterval(loadData, 15000);
		return () => clearInterval(interval);
	}, [loadData]);

	const copyToClipboard = (text: string, key: string) => {
		navigator.clipboard.writeText(text);
		setCopiedKey(key);
		setTimeout(() => setCopiedKey(null), 2000);
	};

	const handlePublish = (e: React.FormEvent) => {
		e.preventDefault();
		setPublishError(null);
		setPublishSuccess(null);

		startTransition(async () => {
			const res = await publishReleaseAction({
				version,
				sha256,
				downloadUrl: downloadUrl.trim() || undefined,
				releaseNotes,
				mandatory,
			});

			if (res.success && res.release) {
				setPublishSuccess(`Release v${res.release.version} published successfully! Fleet will auto-update.`);
				setVersion("");
				setSha256("");
				setDownloadUrl("");
				setReleaseNotes("");
				setMandatory(false);
				loadData();
				setTimeout(() => {
					setShowPublishModal(false);
					setPublishSuccess(null);
				}, 2500);
			} else {
				setPublishError(res.error || "Failed to publish release.");
			}
		});
	};

	const latestRelease = releases[0];
	const onlineCount = instances.filter((i) => i.status === "ONLINE").length;
	const vaultCount = instances.filter((i) => i.isVaultProtected).length;

	return (
		<div className="space-y-6">
			{/* Top Summary Banner */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
							Fleet Online
						</span>
						<Server className="w-5 h-5 text-emerald-400" />
					</div>
					<div className="mt-2 flex items-baseline gap-2">
						<span className="text-2xl font-bold text-white">{onlineCount}</span>
						<span className="text-xs text-slate-400">/ {instances.length} servers</span>
					</div>
					<div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-400">
						<span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
						Active heartbeat streaming
					</div>
				</div>

				<div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
							Zero-Knowledge Vault
						</span>
						<ShieldCheck className="w-5 h-5 text-cyan-400" />
					</div>
					<div className="mt-2 flex items-baseline gap-2">
						<span className="text-2xl font-bold text-white">{vaultCount}</span>
						<span className="text-xs text-slate-400">instances secured</span>
					</div>
					<div className="mt-1 text-xs text-cyan-400">
						AES-256-GCM hardware-bound
					</div>
				</div>

				<div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
							Latest Release
						</span>
						<Cpu className="w-5 h-5 text-indigo-400" />
					</div>
					<div className="mt-2 flex items-baseline gap-2">
						<span className="text-2xl font-bold text-white">
							v{latestRelease ? latestRelease.version : "1.1.0"}
						</span>
						<span className="text-xs text-indigo-300 font-mono">win-x64</span>
					</div>
					<div className="mt-1 text-xs text-slate-400 truncate">
						{latestRelease?.sha256 ? `${latestRelease.sha256.slice(0, 16)}...` : "Active"}
					</div>
				</div>

				<div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm flex flex-col justify-between">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
							OTA Pipeline
						</span>
						<Zap className="w-5 h-5 text-amber-400" />
					</div>
					<div className="flex gap-2 mt-2">
						<button
							onClick={() => setShowPublishModal(true)}
							className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all shadow-sm shadow-indigo-500/20"
						>
							<Plus className="w-3.5 h-3.5" />
							Publish Release
						</button>
						<button
							onClick={loadData}
							disabled={isLoading}
							className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors"
							title="Refresh Fleet Data"
						>
							<RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
						</button>
					</div>
				</div>
			</div>

			{error && (
				<div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm flex items-center gap-3">
					<AlertCircle className="w-5 h-5 shrink-0" />
					<span>{error}</span>
				</div>
			)}

			{/* Connected Fleet Table */}
			<div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
				<div className="p-4 border-b border-slate-800 flex items-center justify-between">
					<div>
						<h3 className="text-sm font-semibold text-white flex items-center gap-2">
							<Server className="w-4 h-4 text-emerald-400" />
							On-Premise Client API Servers
						</h3>
						<p className="text-xs text-slate-400 mt-0.5">
							Client servers polling heartbeat, reporting hardware fingerprints & vault status.
						</p>
					</div>
					<a
						href="/api/releases/download"
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
					>
						<Download className="w-3.5 h-3.5 text-indigo-400" />
						Download api-server.exe
					</a>
				</div>

				<div className="overflow-x-auto">
					<table className="w-full text-left text-xs">
						<thead>
							<tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-mono">
								<th className="py-3 px-4">STATUS</th>
								<th className="py-3 px-4">INSTANCE / HOST</th>
								<th className="py-3 px-4">VERSION</th>
								<th className="py-3 px-4">SECURITY VAULT</th>
								<th className="py-3 px-4">PLATFORM</th>
								<th className="py-3 px-4">LAST HEARTBEAT</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-800/60 font-mono">
							{instances.length === 0 ? (
								<tr>
									<td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
										No client API servers have reported heartbeats yet.
										<div className="mt-2 text-xs text-slate-600">
											Servers automatically register when running with CONTROL_PLANE_URL configured.
										</div>
									</td>
								</tr>
							) : (
								instances.map((instance) => {
									const isOnline = instance.status === "ONLINE";
									const isUpdating = instance.status === "UPDATING";
									const hasLatest = latestRelease ? instance.version === latestRelease.version : true;

									return (
										<tr key={instance.id} className="hover:bg-slate-800/30 transition-colors">
											<td className="py-3 px-4">
												{isOnline ? (
													<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-sans font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
														<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
														Online
													</span>
												) : isUpdating ? (
													<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-sans font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
														<RefreshCw className="w-3 h-3 animate-spin" />
														Updating
													</span>
												) : (
													<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-sans font-medium bg-slate-800 text-slate-400 border border-slate-700">
														<span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
														Offline
													</span>
												)}
											</td>
											<td className="py-3 px-4">
												<div className="font-semibold text-slate-200">
													{instance.metadata?.hostname || instance.instanceId}
												</div>
												<div className="text-[11px] text-slate-500 truncate max-w-[200px]">
													{instance.instanceId}
												</div>
											</td>
											<td className="py-3 px-4">
												<div className="flex items-center gap-2">
													<span className="text-slate-200">v{instance.version}</span>
													{!hasLatest && (
														<span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 text-[10px] border border-amber-500/20">
															Update pending
														</span>
													)}
												</div>
											</td>
											<td className="py-3 px-4">
												{instance.isVaultProtected ? (
													<span className="inline-flex items-center gap-1 text-cyan-400 font-sans text-xs">
														<ShieldCheck className="w-3.5 h-3.5" />
														<span>Encrypted Vault (Machine-Bound)</span>
													</span>
												) : (
													<span className="inline-flex items-center gap-1 text-amber-400 font-sans text-xs">
														<ShieldAlert className="w-3.5 h-3.5" />
														<span>Plaintext .env (Unsealed)</span>
													</span>
												)}
											</td>
											<td className="py-3 px-4 text-slate-400">
												{instance.platform}
											</td>
											<td className="py-3 px-4 text-slate-400 font-sans text-[11px]">
												{new Date(instance.lastHeartbeat).toLocaleTimeString()} (
												{new Date(instance.lastHeartbeat).toLocaleDateString()})
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* Releases Catalog */}
			<div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
				<div className="p-4 border-b border-slate-800 flex items-center justify-between">
					<div>
						<h3 className="text-sm font-semibold text-white flex items-center gap-2">
							<Cpu className="w-4 h-4 text-indigo-400" />
							OTA Release Distribution Channel
						</h3>
						<p className="text-xs text-slate-400 mt-0.5">
							Client servers stream binaries from these releases, verify SHA-256 integrity, and perform zero-downtime hot swap.
						</p>
					</div>
					<button
						onClick={() => setShowPublishModal(true)}
						className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
					>
						<Plus className="w-3.5 h-3.5" />
						New Release
					</button>
				</div>

				<div className="divide-y divide-slate-800/60">
					{releases.length === 0 ? (
						<div className="p-6 text-center text-slate-500 text-xs">
							No releases in catalog. Click "New Release" to publish.
						</div>
					) : (
						releases.map((rel, index) => (
							<div key={rel.id} className="p-4 hover:bg-slate-800/30 transition-colors">
								<div className="flex items-start justify-between">
									<div className="space-y-1">
										<div className="flex items-center gap-2">
											<span className="text-sm font-bold text-white">v{rel.version}</span>
											<span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px] font-mono">
												{rel.platform}
											</span>
											{index === 0 && (
												<span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium">
													Active Channel
												</span>
											)}
											{rel.mandatory && (
												<span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-medium">
													Mandatory
												</span>
											)}
										</div>
										<p className="text-xs text-slate-300">{rel.releaseNotes}</p>
										<div className="flex items-center gap-4 text-[11px] text-slate-500 font-mono pt-1">
											<span>SHA-256: {rel.sha256}</span>
											<button
												onClick={() => copyToClipboard(rel.sha256, `sha-${rel.id}`)}
												className="text-slate-400 hover:text-white"
												title="Copy SHA-256"
											>
												{copiedKey === `sha-${rel.id}` ? (
													<Check className="w-3 h-3 text-emerald-400" />
												) : (
													<Copy className="w-3 h-3" />
												)}
											</button>
										</div>
									</div>

									<div className="text-right text-xs text-slate-500">
										<div>{new Date(rel.createdAt).toLocaleDateString()}</div>
										<a
											href={rel.downloadUrl}
											target="_blank"
											rel="noreferrer"
											className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 mt-1 font-mono text-[11px]"
										>
											<Download className="w-3 h-3" />
											Download
										</a>
									</div>
								</div>
							</div>
						))
					)}
				</div>
			</div>

			{/* Client Operator Security Guide */}
			<div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-3">
				<h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
					<Terminal className="w-4 h-4 text-cyan-400" />
					Zero-Knowledge Deployment CLI Instructions
				</h4>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
					<div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-slate-300 space-y-2">
						<div className="text-slate-500 font-sans text-[11px]">
							1. Encrypt and seal plaintext .env into hardware-bound config.vault:
						</div>
						<div className="flex items-center justify-between text-cyan-400 bg-slate-900 px-2 py-1.5 rounded">
							<code>api-server.exe --seal</code>
							<button
								onClick={() => copyToClipboard("api-server.exe --seal", "cmd-seal")}
								className="text-slate-400 hover:text-white ml-2"
							>
								{copiedKey === "cmd-seal" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
							</button>
						</div>
					</div>

					<div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-slate-300 space-y-2">
						<div className="text-slate-500 font-sans text-[11px]">
							2. Test decryption against current machine hardware ID:
						</div>
						<div className="flex items-center justify-between text-cyan-400 bg-slate-900 px-2 py-1.5 rounded">
							<code>api-server.exe --verify-vault</code>
							<button
								onClick={() => copyToClipboard("api-server.exe --verify-vault", "cmd-verify")}
								className="text-slate-400 hover:text-white ml-2"
							>
								{copiedKey === "cmd-verify" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* Publish Release Modal */}
			{showPublishModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
					<div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6 space-y-4">
						<div className="flex items-center justify-between border-b border-slate-800 pb-3">
							<h3 className="text-base font-semibold text-white flex items-center gap-2">
								<UploadCloud className="w-5 h-5 text-indigo-400" />
								Publish OTA Release
							</h3>
							<button
								onClick={() => setShowPublishModal(false)}
								className="text-slate-400 hover:text-white text-sm"
							>
								✕
							</button>
						</div>

						{publishSuccess && (
							<div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
								<CheckCircle2 className="w-4 h-4 shrink-0" />
								<span>{publishSuccess}</span>
							</div>
						)}

						{publishError && (
							<div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
								<AlertCircle className="w-4 h-4 shrink-0" />
								<span>{publishError}</span>
							</div>
						)}

						<form onSubmit={handlePublish} className="space-y-4 text-xs">
							<div>
								<label className="block text-slate-300 font-medium mb-1">
									Release Version *
								</label>
								<input
									type="text"
									required
									placeholder="e.g. 1.1.1"
									value={version}
									onChange={(e) => setVersion(e.target.value)}
									className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
								/>
							</div>

							<div>
								<label className="block text-slate-300 font-medium mb-1">
									SHA-256 Checksum *
								</label>
								<input
									type="text"
									required
									placeholder="64-character hex checksum of api-server.exe"
									value={sha256}
									onChange={(e) => setSha256(e.target.value.trim())}
									className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-indigo-500"
								/>
							</div>

							<div>
								<label className="block text-slate-300 font-medium mb-1">
									Download URL (Optional)
								</label>
								<input
									type="text"
									placeholder="Defaults to /api/releases/download?version={version}"
									value={downloadUrl}
									onChange={(e) => setDownloadUrl(e.target.value)}
									className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
								/>
							</div>

							<div>
								<label className="block text-slate-300 font-medium mb-1">
									Release Notes
								</label>
								<textarea
									rows={3}
									placeholder="Describe changes in this release..."
									value={releaseNotes}
									onChange={(e) => setReleaseNotes(e.target.value)}
									className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
								/>
							</div>

							<div className="flex items-center gap-2 pt-1">
								<input
									type="checkbox"
									id="mandatory"
									checked={mandatory}
									onChange={(e) => setMandatory(e.target.checked)}
									className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
								/>
								<label htmlFor="mandatory" className="text-slate-300 cursor-pointer">
									Mark as Mandatory (Fleet will upgrade immediately on next heartbeat)
								</label>
							</div>

							<div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
								<button
									type="button"
									onClick={() => setShowPublishModal(false)}
									className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={isPending}
									className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
								>
									{isPending && <RefreshCw className="w-4 h-4 animate-spin" />}
									{isPending ? "Publishing..." : "Publish & Distribute"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}

