"use client";

import { useState } from "react";
import { FeedbackModal } from "./feedback-modal";

export function FloatingFeedbackButton() {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<>
			<div className="fixed bottom-5 right-5 z-40 group print:hidden">
				<button
					type="button"
					onClick={() => setIsOpen(true)}
					className="flex items-center gap-2 rounded-full bg-[#0071BC] p-3 text-white shadow-lg transition-all duration-300 hover:bg-[#0B2545] hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-[#0071BC] focus:ring-offset-2 active:scale-95 sm:px-4 sm:py-2.5"
					title="Report an Issue or Feedback"
					aria-label="Report an Issue or Feedback"
				>
					{/* Icon */}
					<svg
						className="h-5 w-5 flex-shrink-0"
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

					{/* Label (visible on medium+ screens or expands on hover) */}
					<span className="hidden font-bold text-xs tracking-tight sm:inline">
						Feedback
					</span>

					{/* Subtle indicator dot */}
					<span className="absolute -top-1 -right-1 flex h-3 w-3">
						<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
						<span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
					</span>
				</button>
			</div>

			<FeedbackModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
		</>
	);
}
