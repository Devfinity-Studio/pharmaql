"use client";

import React, { Component, type ReactNode } from "react";
import { FeedbackModal } from "./feedback-modal";
import { addClientError } from "@/lib/client-error-tracker";

interface ErrorBoundaryProps {
	children: ReactNode;
	fallbackTitle?: string;
	fallbackSubtitle?: string;
}

interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
	errorInfo: React.ErrorInfo | null;
	isFeedbackOpen: boolean;
	showStack: boolean;
}

export class ErrorBoundary extends Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
			isFeedbackOpen: false,
			showStack: false,
		};
	}

	static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		this.setState({ errorInfo });
		addClientError(`[Crash] ${error.name}: ${error.message}`);
		console.error("PharmaQL ErrorBoundary caught an unhandled crash:", error, errorInfo);
	}

	handleReset = () => {
		this.setState({
			hasError: false,
			error: null,
			errorInfo: null,
			isFeedbackOpen: false,
			showStack: false,
		});
	};

	render() {
		if (this.state.hasError) {
			const errorTitle = this.state.error?.name || "Render Exception";
			const errorMessage =
				this.state.error?.message || "An unexpected error disrupted this page.";
			const componentStack = this.state.errorInfo?.componentStack || "";

			const crashDescription = `Crash occurred at: ${typeof window !== "undefined" ? window.location.href : "Unknown"}\n\nError: ${errorTitle}: ${errorMessage}\n\nStack:\n${this.state.error?.stack || "No stack trace"}\n\nComponent Hierarchy:\n${componentStack}`;

			return (
				<div className="flex min-h-[500px] w-full flex-col items-center justify-center p-6 text-[#0B2545]">
					<div className="w-full max-w-xl rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-xl">
						{/* Danger Icon */}
						<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 shadow-inner">
							<svg
								className="h-8 w-8"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
								/>
							</svg>
						</div>

						{/* Headings */}
						<h2 className="text-xl font-bold tracking-tight text-slate-900 mb-2">
							{this.props.fallbackTitle || "Something went wrong"}
						</h2>
						<p className="text-sm text-slate-600 mb-6">
							{this.props.fallbackSubtitle ||
								"An unexpected system error caused this view to crash. You can reload the page or report this issue directly to developers."}
						</p>

						{/* Error summary */}
						<div className="mb-6 rounded-xl border border-rose-100 bg-rose-50/60 p-3.5 text-left text-xs font-mono text-rose-900 overflow-x-auto">
							<strong>{errorTitle}:</strong> {errorMessage}
						</div>

						{/* Action Buttons */}
						<div className="flex flex-wrap items-center justify-center gap-3">
							<button
								type="button"
								onClick={() => this.setState({ isFeedbackOpen: true })}
								className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 font-bold text-xs text-white shadow-sm transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
							>
								<svg
									className="h-4 w-4"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth="2"
										d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
									/>
								</svg>
								Report Crash to Developers
							</button>

							<button
								type="button"
								onClick={() => {
									if (typeof window !== "undefined") {
										window.location.reload();
									}
								}}
								className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-bold text-xs text-slate-700 shadow-sm transition hover:bg-slate-50"
							>
								<svg
									className="h-4 w-4 text-slate-500"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth="2"
										d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
									/>
								</svg>
								Reload Page
							</button>

							<button
								type="button"
								onClick={() => {
									if (typeof window !== "undefined") {
										window.location.href = "/";
									}
								}}
								className="rounded-xl border border-transparent px-4 py-2.5 font-bold text-xs text-[#0071BC] transition hover:bg-blue-50"
							>
								Back to Safety
							</button>
						</div>

						{/* Collapsible Stack Inspector */}
						<div className="mt-6 border-t border-slate-100 pt-4 text-center">
							<button
								type="button"
								onClick={() => this.setState({ showStack: !this.state.showStack })}
								className="text-xs text-slate-400 hover:text-slate-600 underline"
							>
								{this.state.showStack ? "Hide Stack Details ▲" : "View Technical Crash Stack ▼"}
							</button>
							{this.state.showStack && (
								<pre className="mt-3 max-h-48 overflow-y-auto rounded-lg bg-slate-900 p-3 text-left font-mono text-[11px] text-slate-300 whitespace-pre-wrap">
									{this.state.error?.stack || "No call stack captured"}
									{componentStack && `\n\nComponent Hierarchy:\n${componentStack}`}
								</pre>
							)}
						</div>
					</div>

					{/* Feedback Modal with Pre-Filled Crash Details */}
					<FeedbackModal
						isOpen={this.state.isFeedbackOpen}
						onClose={() => this.setState({ isFeedbackOpen: false })}
						initialValues={{
							category: "BUG",
							urgency: "CRITICAL",
							title: `Client Crash: ${errorTitle}`,
							description: crashDescription,
							additionalErrors: [`[Crash] ${errorTitle}: ${errorMessage}`],
						}}
					/>
				</div>
			);
		}

		return this.props.children;
	}
}
