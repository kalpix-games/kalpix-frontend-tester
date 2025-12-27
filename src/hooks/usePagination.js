import { useState, useCallback, useRef, useEffect } from "react";

/**
 * Custom hook for infinite scroll pagination
 * @param {Function} fetchFunction - Function that fetches data: (cursor, limit) => Promise<{items, nextCursor, hasMore}>
 * @param {Object} options - Configuration options
 * @param {number} options.defaultLimit - Default items per page (default: 20)
 * @param {boolean} options.autoLoad - Whether to load on mount (default: true)
 * @param {Function} options.onError - Error handler callback
 * @returns {Object} Pagination state and controls
 */
export function usePagination(fetchFunction, options = {}) {
	const { defaultLimit = 20, autoLoad = true, onError = null } = options;

	const [items, setItems] = useState([]);
	const [loading, setLoading] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [error, setError] = useState(null);
	const [hasMore, setHasMore] = useState(true);
	const [nextCursor, setNextCursor] = useState(null);

	const isLoadingRef = useRef(false); // Prevent duplicate loads
	const hasLoadedRef = useRef(false); // Track if initial load has happened

	// Auto-load on mount if enabled (only once)
	useEffect(() => {
		if (autoLoad && !hasLoadedRef.current && !isLoadingRef.current) {
			console.log("🚀 Auto-loading on mount");
			hasLoadedRef.current = true;
			// Use a small delay to ensure component is fully mounted
			const timer = setTimeout(() => {
				if (!isLoadingRef.current) {
					load(false);
				}
			}, 100);
			return () => clearTimeout(timer);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []); // Only run once on mount

	/**
	 * Load initial data or reset and reload
	 */
	const load = useCallback(
		async (reset = false) => {
			if (isLoadingRef.current) return;

			isLoadingRef.current = true;
			setLoading(true);
			setError(null);

			try {
				const result = await fetchFunction(null, defaultLimit);

				// Handle different response formats
				let itemsData, cursor, hasMoreData;

				if (result.data) {
					// Standard API response: { data: { items, posts, messages, comments, users, nextCursor, hasMore } }
					itemsData =
						result.data.items ||
						result.data.posts ||
						result.data.messages ||
						result.data.comments ||
						result.data.users ||
						result.data ||
						[];
					cursor = result.data.nextCursor || null;
					hasMoreData =
						result.data.hasMore !== undefined
							? result.data.hasMore
							: cursor !== null && cursor !== "";
				} else if (result.items || result.users) {
					// Direct response: { items, nextCursor, hasMore }
					itemsData = result.items || [];
					cursor = result.nextCursor || null;
					hasMoreData =
						result.hasMore !== undefined
							? result.hasMore
							: cursor !== null && cursor !== "";
				} else if (Array.isArray(result)) {
					// Array response (legacy)
					itemsData = result;
					cursor = null;
					hasMoreData = false;
				} else {
					// Try to extract from result directly
					itemsData = result.posts || result.messages || result.comments || [];
					cursor = result.nextCursor || null;
					hasMoreData =
						result.hasMore !== undefined
							? result.hasMore
							: cursor !== null && cursor !== "";
				}

				if (reset) {
					setItems(itemsData);
				} else {
					setItems((prev) => {
						// Avoid duplicates
						const existingIds = new Set(
							prev.map(
								(item) =>
									item.id ||
									item.postId ||
									item.messageId ||
									item.channelId ||
									item.userId
							)
						);
						const newItems = itemsData.filter(
							(item) =>
								!existingIds.has(
									item.id ||
										item.postId ||
										item.messageId ||
										item.channelId ||
										item.userId
								)
						);
						return [...prev, ...newItems];
					});
				}

				setNextCursor(cursor);
				setHasMore(hasMoreData);
			} catch (err) {
				const errorMessage = err.message || "Failed to load data";
				setError(errorMessage);
				if (onError) {
					onError(err);
				}
			} finally {
				setLoading(false);
				isLoadingRef.current = false;
			}
		},
		[fetchFunction, defaultLimit, onError]
	);

	/**
	 * Load more data (append to existing)
	 */
	const loadMore = useCallback(async () => {
		if (isLoadingRef.current || !hasMore || loadingMore) {
			console.log("⏸️ LoadMore skipped", {
				isLoading: isLoadingRef.current,
				hasMore,
				loadingMore,
			});
			return;
		}

		console.log("📥 Loading more data, cursor:", nextCursor);
		isLoadingRef.current = true;
		setLoadingMore(true);
		setError(null);

		try {
			const result = await fetchFunction(nextCursor, defaultLimit);
			console.log("✅ LoadMore result:", result);

			// Handle different response formats
			let itemsData, cursor, hasMoreData;

			if (result.data) {
				itemsData =
					result.data.items ||
					result.data.posts ||
					result.data.messages ||
					result.data.comments ||
					result.data ||
					[];
				cursor = result.data.nextCursor || null;
				hasMoreData =
					result.data.hasMore !== undefined
						? result.data.hasMore
						: cursor !== null && cursor !== "";
			} else if (result.items || result.users) {
				itemsData = result.items || result.users || [];
				cursor = result.nextCursor || null;
				hasMoreData =
					result.hasMore !== undefined
						? result.hasMore
						: cursor !== null && cursor !== "";
			} else if (Array.isArray(result)) {
				itemsData = result;
				cursor = null;
				hasMoreData = false;
			} else {
				itemsData =
					result.posts ||
					result.messages ||
					result.comments ||
					result.users ||
					[];
				cursor = result.nextCursor || null;
				hasMoreData =
					result.hasMore !== undefined
						? result.hasMore
						: cursor !== null && cursor !== "";
			}

			// Append new items, avoiding duplicates
			setItems((prev) => {
				const existingIds = new Set(
					prev.map(
						(item) =>
							item.id ||
							item.postId ||
							item.messageId ||
							item.channelId ||
							item.userId
					)
				);
				const newItems = itemsData.filter(
					(item) =>
						!existingIds.has(
							item.id ||
								item.postId ||
								item.messageId ||
								item.channelId ||
								item.userId
						)
				);
				return [...prev, ...newItems];
			});

			setNextCursor(cursor);
			setHasMore(hasMoreData);
		} catch (err) {
			const errorMessage = err.message || "Failed to load more data";
			setError(errorMessage);
			if (onError) {
				onError(err);
			}
		} finally {
			setLoadingMore(false);
			isLoadingRef.current = false;
		}
	}, [fetchFunction, nextCursor, hasMore, defaultLimit, loadingMore, onError]);

	/**
	 * Reset pagination state
	 */
	const reset = useCallback(() => {
		if (isLoadingRef.current) {
			console.log("⏸️ Reset skipped - already loading");
			return;
		}
		console.log("🔄 Resetting pagination");
		hasLoadedRef.current = false; // Reset the flag so it can load again
		setItems([]);
		setNextCursor(null);
		setHasMore(true);
		setError(null);
		// Always load when reset is called (reset implies we want to reload)
		load(true);
	}, [load]);

	/**
	 * Refresh current data
	 */
	const refresh = useCallback(() => {
		reset();
	}, [reset]);

	return {
		items,
		loading,
		loadingMore,
		error,
		hasMore,
		nextCursor,
		load,
		loadMore,
		reset,
		refresh,
		setItems, // Allow manual item updates
	};
}
