import {
	defaultShouldDehydrateQuery,
	QueryClient,
} from "@tanstack/react-query";
import SuperJSON from "superjson";

export const createQueryClient = () =>
	new QueryClient({
		defaultOptions: {
			queries: {
				// 2-minute staleTime prevents jarring refetches on routine user navigation
				staleTime: 2 * 60 * 1000,
				// 10-minute garbage collection time keeps previously loaded statements in memory
				gcTime: 10 * 60 * 1000,
				// Suppress aggressive background refetches on window focus
				refetchOnWindowFocus: false,
				refetchOnReconnect: true,
				retry: 1,
			},
			dehydrate: {
				serializeData: SuperJSON.serialize,
				shouldDehydrateQuery: (query) =>
					defaultShouldDehydrateQuery(query) ||
					query.state.status === "pending",
			},
			hydrate: {
				deserializeData: SuperJSON.deserialize,
			},
		},
	});
