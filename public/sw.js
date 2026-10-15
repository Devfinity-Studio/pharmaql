// @ts-nocheck
// PharmaQL PWA Service Worker v1.0.0
const CACHE_NAME = "pharmaql-pwa-v1";

const PRECACHE_ASSETS = [
	"/",
	"/login",
	"/dashboard",
	"/devfinity.png",
	"/logo.png",
	"/favicons/android-chrome-192x192.png",
	"/favicons/android-chrome-512x512.png",
	"/favicons/apple-touch-icon.png",
	"/favicons/favicon.ico",
	"/favicons/site.webmanifest",
];

// Install: Precache application shell
self.addEventListener("install", (event) => {
	self.skipWaiting();
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return cache.addAll(PRECACHE_ASSETS).catch((err) => {
				console.warn("[PWA SW] Precache partial error (non-fatal):", err);
			});
		}),
	);
});

// Activate: Clean up previous cache versions
self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames.map((name) => {
					if (name !== CACHE_NAME) {
						return caches.delete(name);
					}
				}),
			);
		}).then(() => self.clients.claim()),
	);
});

// Fetch: Strategy dispatch
self.addEventListener("fetch", (event) => {
	const request = event.request;

	// Only handle GET requests
	if (request.method !== "GET") {
		return;
	}

	const url = new URL(request.url);

	// Bypass cross-origin requests
	if (url.origin !== self.location.origin) {
		return;
	}

	// 1. Navigation requests (HTML pages): Network-First with cached page fallback
	if (request.mode === "navigate") {
		event.respondWith(
			fetch(request)
				.then((response) => {
					if (response.status === 200) {
						const clone = response.clone();
						caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
					}
					return response;
				})
				.catch(async () => {
					const cachedResponse = await caches.match(request);
					if (cachedResponse) {
						return cachedResponse;
					}
					// Fallback to cached dashboard or offline page
					const dashboardFallback = await caches.match("/dashboard");
					if (dashboardFallback) {
						return dashboardFallback;
					}
					return new Response(
						`<!DOCTYPE html>
						<html lang="en">
						<head>
							<meta charset="UTF-8">
							<meta name="viewport" content="width=device-width, initial-scale=1.0">
							<title>PharmaQL Offline</title>
							<style>
								body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0B2545; color: #ffffff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; text-align: center; }
								.card { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 32px; max-width: 420px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
								h1 { color: #38bdf8; font-size: 24px; margin-bottom: 12px; }
								p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
								button { margin-top: 24px; background: #0071BC; color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: bold; cursor: pointer; font-size: 14px; }
								button:hover { background: #005a96; }
							</style>
						</head>
						<body>
							<div class="card">
								<h1>PharmaQL Offline Mode</h1>
								<p>You appear to be offline. Any reports you previously viewed are available in your local offline storage.</p>
								<button onclick="window.location.reload()">Retry Connection</button>
							</div>
						</body>
						</html>`,
						{
							status: 200,
							headers: { "Content-Type": "text/html" },
						},
					);
				}),
		);
		return;
	}

	// 2. Static Assets (_next/static, icons, images, fonts): Stale-While-Revalidate
	const isStaticAsset =
		url.pathname.startsWith("/_next/static/") ||
		url.pathname.startsWith("/favicons/") ||
		url.pathname.startsWith("/icons/") ||
		url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff2|woff|css|js)$/i);

	if (isStaticAsset) {
		event.respondWith(
			caches.match(request).then((cachedResponse) => {
				const fetchPromise = fetch(request)
					.then((networkResponse) => {
						if (networkResponse && networkResponse.status === 200) {
							const clone = networkResponse.clone();
							caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
						}
						return networkResponse;
					})
					.catch(() => null);

				return cachedResponse || fetchPromise;
			}),
		);
		return;
	}

	// 3. All other requests: Network-First
	event.respondWith(
		fetch(request).catch(() => caches.match(request)),
	);
});
