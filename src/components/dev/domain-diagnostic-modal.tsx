"use client";

import React, { useState, useEffect } from "react";
import {
	Globe,
	ShieldCheck,
	AlertTriangle,
	CheckCircle2,
	XCircle,
	RefreshCw,
	Copy,
	Check,
	X,
	ExternalLink,
} from "lucide-react";
import {
	checkDomainStatusAction,
	type DomainStatusResult,
} from "@/modules/control-plane/tenantActions";

interface DomainDiagnosticModalProps {
	isOpen: boolean;
	onClose: () => void;
	tenantId: string;
	customDomain: string;
	tenantName: string;
}

export function DomainDiagnosticModal({
	isOpen,
	onClose,
	tenantId,
	customDomain,
	tenantName,
}: DomainDiagnosticModalProps) {
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState<DomainStatusResult | null>(null);
	const [copiedField, setCopiedField] = useState<string | null>(null);

	const runDiagnostic = async () => {
		if (!customDomain && !tenantId) return;
		setLoading(true);
		try {
			const res = await checkDomainStatusAction({
				tenantId,
				customDomain,
			});
			setResult(res);
		} catch (err: any) {
			setResult({
				success: false,
				domain: customDomain,
				dnsOk: false,
				cnameTargets: [],
				ipv4Addresses: [],
				sslOk: false,
				vercelConfigured: false,
				vercelVerified: false,
				recommendations: ["Failed to run network diagnostics: " + err.message],
				error: err.message,
			});
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (isOpen) {
			runDiagnostic();
		} else {
			setResult(null);
		}
	}, [isOpen, customDomain]);

	if (!isOpen) return null;

	const copyToClipboard = (text: string, field: string) => {
		navigator.clipboard.writeText(text);
		setCopiedField(field);
		setTimeout(() => setCopiedField(null), 2000);
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
			<div className="relative w-full max-w-2xl rounded-2xl border border-gray-700 bg-[#0d1527] p-6 shadow-2xl text-white animate-in fade-in zoom-in-95 duration-150">
				{/* Header */}
				<div className="flex items-start justify-between border-b border-gray-800 pb-4">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
							<Globe className="h-5 w-5" />
						</div>
						<div>
							<h3 className="font-bold text-lg text-white">DNS & SSL Diagnostics</h3>
							<p className="text-gray-400 text-xs">
								{tenantName} • <span className="font-mono text-cyan-400">{customDomain || "No domain"}</span>
							</p>
						</div>
					</div>
					<button
						onClick={onClose}
						className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white transition"
					>
						<X className="h-5 w-5" />
					</button>
				</div>

				{/* Body */}
				<div className="mt-5 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
					{loading ? (
						<div className="flex flex-col items-center justify-center py-12 text-center">
							<RefreshCw className="h-8 w-8 animate-spin text-cyan-400 mb-3" />
							<p className="text-sm font-medium text-gray-300">Probing DNS and TLS handshake...</p>
							<p className="text-xs text-gray-500 mt-1">Resolving CNAME, A records, and SSL status</p>
						</div>
					) : result ? (
						<>
							{/* Status Badges Grid */}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
								{/* DNS Badge */}
								<div
									className={`rounded-xl border p-4 ${
										result.dnsOk
											? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
											: "border-red-500/30 bg-red-500/10 text-red-300"
									}`}
								>
									<div className="flex items-center justify-between">
										<span className="font-semibold text-xs uppercase tracking-wider">DNS Routing</span>
										{result.dnsOk ? (
											<CheckCircle2 className="h-4 w-4 text-emerald-400" />
										) : (
											<XCircle className="h-4 w-4 text-red-400" />
										)}
									</div>
									<div className="mt-2 font-bold text-base text-white">
										{result.dnsOk ? "Pointing to Vercel" : "DNS Misconfigured"}
									</div>
									<p className="mt-1 text-xs text-gray-300 font-mono">
										{result.cnameTargets.length > 0
											? `CNAME: ${result.cnameTargets.join(", ")}`
											: result.ipv4Addresses.length > 0
												? `A: ${result.ipv4Addresses.join(", ")}`
												: "No DNS records found"}
									</p>
								</div>

								{/* SSL Badge */}
								<div
									className={`rounded-xl border p-4 ${
										result.sslOk
											? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
											: "border-amber-500/30 bg-amber-500/10 text-amber-300"
									}`}
								>
									<div className="flex items-center justify-between">
										<span className="font-semibold text-xs uppercase tracking-wider">SSL / TLS</span>
										{result.sslOk ? (
											<ShieldCheck className="h-4 w-4 text-emerald-400" />
										) : (
											<AlertTriangle className="h-4 w-4 text-amber-400" />
										)}
									</div>
									<div className="mt-2 font-bold text-base text-white">
										{result.sslOk ? "Active (HTTPS Ready)" : "SSL Certificate Pending"}
									</div>
									<p className="mt-1 text-xs text-gray-300">
										{result.sslOk
											? "TLS handshake completed successfully"
											: "Certificate not ready or awaiting DNS propagation"}
									</p>
								</div>
							</div>

							{/* Copyable DNS Records Helper */}
							<div className="rounded-xl border border-gray-800 bg-[#090e1c] p-4">
								<div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
									Recommended DNS Settings for Client IT
								</div>
								<div className="space-y-2 text-xs font-mono">
									<div className="flex items-center justify-between bg-black/40 rounded-lg p-2.5 border border-gray-800">
										<div className="truncate pr-2">
											<span className="text-gray-500">CNAME: </span>
											<span className="text-cyan-300">cname.vercel-dns.com</span>
										</div>
										<button
											onClick={() => copyToClipboard("cname.vercel-dns.com", "cname")}
											className="flex items-center gap-1 shrink-0 rounded px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 transition text-[11px]"
										>
											{copiedField === "cname" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
											<span>{copiedField === "cname" ? "Copied" : "Copy"}</span>
										</button>
									</div>

									<div className="flex items-center justify-between bg-black/40 rounded-lg p-2.5 border border-gray-800">
										<div className="truncate pr-2">
											<span className="text-gray-500">A Record (Apex): </span>
											<span className="text-cyan-300">76.76.21.21</span>
										</div>
										<button
											onClick={() => copyToClipboard("76.76.21.21", "a")}
											className="flex items-center gap-1 shrink-0 rounded px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 transition text-[11px]"
										>
											{copiedField === "a" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
											<span>{copiedField === "a" ? "Copied" : "Copy"}</span>
										</button>
									</div>
								</div>
							</div>

							{/* Actionable Recommendations */}
							{result.recommendations && result.recommendations.length > 0 && (
								<div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
									<div className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
										<AlertTriangle className="h-3.5 w-3.5 text-cyan-400" />
										<span>Actionable Guidance</span>
									</div>
									<ul className="space-y-1.5 text-xs text-gray-300">
										{result.recommendations.map((rec, i) => (
											<li key={i} className="flex items-start gap-2">
												<span className="text-cyan-400 font-bold">•</span>
												<span>{rec}</span>
											</li>
										))}
									</ul>
								</div>
							)}

							{/* Live Test Link */}
							{result.dnsOk && (
								<div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs">
									<span className="text-blue-300">Open client portal in browser:</span>
									<a
										href={`https://${result.domain}`}
										target="_blank"
										rel="noopener noreferrer"
										className="flex items-center gap-1 font-semibold text-cyan-400 hover:underline"
									>
										<span>https://{result.domain}</span>
										<ExternalLink className="h-3.5 w-3.5" />
									</a>
								</div>
							)}
						</>
					) : (
						<div className="text-center py-6 text-gray-400 text-sm">
							Click "Run Diagnostics" to inspect DNS records.
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="mt-6 flex items-center justify-between border-t border-gray-800 pt-4">
					<button
						onClick={runDiagnostic}
						disabled={loading}
						className="flex items-center gap-1.5 rounded-xl border border-gray-700 bg-gray-800 px-4 py-2 font-medium text-xs text-gray-200 hover:bg-gray-700 hover:text-white transition disabled:opacity-50"
					>
						<RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
						<span>{loading ? "Testing..." : "Re-test Now"}</span>
					</button>

					<button
						onClick={onClose}
						className="rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2 font-medium text-xs text-white shadow transition"
					>
						Done
					</button>
				</div>
			</div>
		</div>
	);
}
