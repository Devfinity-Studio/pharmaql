"use client";

import { useEffect, useState } from "react";
import confetti from "canvas-confetti";

export function NoticeModal({ notices }: { notices: any[] }) {
	const [unseenNotices, setUnseenNotices] = useState<any[]>([]);
	const [currentIndex, setCurrentIndex] = useState(0);

	useEffect(() => {
		if (!notices || notices.length === 0) return;

		const toShow = notices.filter(notice => {
			if (notice.expiresAt && new Date(notice.expiresAt) < new Date()) return false;
			const key = `seen_notice_${notice.id}`;
			const lastSeenDate = sessionStorage.getItem(key);
			const currentUpdateDate = new Date(notice.updatedAt).toISOString();
			return lastSeenDate !== currentUpdateDate;
		});

		setUnseenNotices(toShow);
		if (toShow.length > 0) {
			setCurrentIndex(0);
		}
	}, [notices]);

	// Fire confetti when a festive notice appears
	useEffect(() => {
		if (unseenNotices.length > 0 && unseenNotices[currentIndex]) {
			const current = unseenNotices[currentIndex];
			if (current.variant === "festive") {
				// Fire confetti multiple times for a party effect
				const duration = 3000;
				const end = Date.now() + duration;

				const frame = () => {
					confetti({
						particleCount: 5,
						angle: 60,
						spread: 55,
						origin: { x: 0 },
						colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff']
					});
					confetti({
						particleCount: 5,
						angle: 120,
						spread: 55,
						origin: { x: 1 },
						colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff']
					});

					if (Date.now() < end) {
						requestAnimationFrame(frame);
					}
				};
				frame();
			}
		}
	}, [currentIndex, unseenNotices]);

	const handleNext = () => {
		const current = unseenNotices[currentIndex];
		const key = `seen_notice_${current.id}`;
		sessionStorage.setItem(key, new Date(current.updatedAt).toISOString());

		if (currentIndex < unseenNotices.length - 1) {
			setCurrentIndex(currentIndex + 1);
		} else {
			setUnseenNotices([]);
		}
	};

	if (unseenNotices.length === 0) return null;

	const notice = unseenNotices[currentIndex];

	let headerColor = "bg-blue-600";
	let icon = (
		<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
			<path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
		</svg>
	);

	if (notice.variant === "warning") {
		headerColor = "bg-yellow-500";
		icon = (
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
				<path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
			</svg>
		);
	} else if (notice.variant === "danger") {
		headerColor = "bg-red-600";
		icon = (
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
				<path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
			</svg>
		);
	} else if (notice.variant === "success") {
		headerColor = "bg-green-600";
		icon = (
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
				<path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
		);
	} else if (notice.variant === "festive") {
		headerColor = "bg-fuchsia-600";
		icon = (
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
				<path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
				<path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
			</svg>
		);
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
			<div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
				<div className={`${headerColor} px-6 py-4 flex items-center justify-between`}>
					<h2 className="text-xl font-bold text-white flex items-center gap-2">
						{icon}
						{notice.title || "Important Notice"}
					</h2>
					{unseenNotices.length > 1 && (
						<span className="text-white text-xs font-medium bg-white/20 px-2 py-1 rounded">
							{currentIndex + 1} of {unseenNotices.length}
						</span>
					)}
				</div>
				<div className="p-6">
					<div className="text-gray-800 text-lg whitespace-pre-wrap leading-relaxed min-h-[100px]">
						{notice.content}
					</div>
					<div className="mt-8 flex justify-end">
						<button
							onClick={handleNext}
							className={`px-6 py-2.5 text-white font-bold rounded-lg transition-colors ${headerColor.replace('bg-', 'hover:bg-').replace('500', '600').replace('600', '700')} ${headerColor}`}
						>
							{currentIndex < unseenNotices.length - 1 ? "Next Notice" : "I understand"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
