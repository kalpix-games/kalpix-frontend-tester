import { useEffect, useRef, useCallback, useState } from "react";

/**
 * InfiniteScroll component - triggers loadMore when user scrolls near bottom
 * @param {Object} props
 * @param {Function} props.onLoadMore - Callback when more data should be loaded
 * @param {boolean} props.hasMore - Whether more data is available
 * @param {boolean} props.loading - Whether currently loading
 * @param {React.ReactNode} props.children - Content to render
 * @param {number} props.threshold - Distance from bottom to trigger load (default: 200px)
 * @param {string} props.className - Additional CSS classes
 * @param {React.ReactNode} props.loadingComponent - Component to show while loading more
 * @param {React.ReactNode} props.endMessage - Message to show when no more data
 */
export function InfiniteScroll({
	onLoadMore,
	hasMore,
	loading,
	children,
	threshold = 200,
	className = "",
	loadingComponent = null,
	endMessage = null,
}) {
	const scrollRef = useRef(null);
	const observerRef = useRef(null);

	const handleScroll = useCallback(() => {
		if (loading || !hasMore) return;

		const element = scrollRef.current;
		if (!element) return;

		const scrollTop = element.scrollTop;
		const scrollHeight = element.scrollHeight;
		const clientHeight = element.clientHeight;

		// Check if user scrolled near bottom
		if (scrollHeight - scrollTop - clientHeight < threshold) {
			onLoadMore();
		}
	}, [onLoadMore, hasMore, loading, threshold]);

	// Set up scroll listener
	useEffect(() => {
		const element = scrollRef.current;
		if (!element) return;

		element.addEventListener("scroll", handleScroll);
		return () => {
			element.removeEventListener("scroll", handleScroll);
		};
	}, [handleScroll]);

	// Intersection Observer approach (alternative, more efficient)
	useEffect(() => {
		if (!hasMore || loading) return;

		const element = scrollRef.current;
		if (!element) return;

		// Create sentinel element at bottom
		const sentinel = document.createElement("div");
		sentinel.style.height = "1px";
		sentinel.style.visibility = "hidden";
		element.appendChild(sentinel);

		observerRef.current = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasMore && !loading) {
					onLoadMore();
				}
			},
			{
				root: element,
				rootMargin: `${threshold}px`,
				threshold: 0.1,
			}
		);

		observerRef.current.observe(sentinel);

		return () => {
			if (observerRef.current) {
				observerRef.current.disconnect();
			}
			if (element.contains(sentinel)) {
				element.removeChild(sentinel);
			}
		};
	}, [hasMore, loading, onLoadMore, threshold]);

	const defaultLoadingComponent = (
		<div style={{ padding: "20px", textAlign: "center", color: "#666" }}>
			Loading more...
		</div>
	);

	const defaultEndMessage = (
		<div style={{ padding: "20px", textAlign: "center", color: "#999" }}>
			No more items to load
		</div>
	);

	return (
		<div
			ref={scrollRef}
			className={className}
			style={{ overflowY: "auto", height: "100%" }}
		>
			{children}
			{loading && (loadingComponent || defaultLoadingComponent)}
			{!hasMore && (endMessage || defaultEndMessage)}
		</div>
	);
}

/**
 * Simpler scroll-based infinite scroll (for window/document scrolling)
 */
export function InfiniteScrollWindow({
	onLoadMore,
	hasMore,
	loading,
	children,
	threshold = 200,
	className = "",
	loadingComponent = null,
	endMessage = null,
}) {
	const isLoadingRef = useRef(false);
	const lastScrollTopRef = useRef(0);

	const handleScroll = useCallback(() => {
		// Prevent multiple simultaneous loads
		if (isLoadingRef.current || loading || !hasMore) {
			return;
		}

		const scrollTop =
			window.pageYOffset ||
			document.documentElement.scrollTop ||
			document.body.scrollTop;
		const scrollHeight =
			document.documentElement.scrollHeight || document.body.scrollHeight;
		const clientHeight =
			window.innerHeight || document.documentElement.clientHeight;

		// Only check if scrolling down
		if (scrollTop <= lastScrollTopRef.current) {
			lastScrollTopRef.current = scrollTop;
			return;
		}
		lastScrollTopRef.current = scrollTop;

		const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

		// Trigger when within threshold distance from bottom
		if (distanceFromBottom <= threshold) {
			console.log("🔄 InfiniteScroll: Triggering loadMore", {
				distanceFromBottom,
				threshold,
				hasMore,
				loading,
				scrollTop,
				scrollHeight,
				clientHeight,
			});
			isLoadingRef.current = true;
			try {
				onLoadMore();
			} catch (error) {
				console.error("Error in onLoadMore:", error);
				isLoadingRef.current = false;
			}
		}
	}, [onLoadMore, hasMore, loading, threshold]);

	// Check scroll position when dependencies change
	useEffect(() => {
		// Small delay to ensure DOM is ready
		const timer = setTimeout(() => {
			if (!loading && hasMore) {
				handleScroll();
			}
		}, 100);
		return () => clearTimeout(timer);
	}, [hasMore, loading, handleScroll]);

	// Reset isLoadingRef when loading state changes
	useEffect(() => {
		if (!loading) {
			isLoadingRef.current = false;
		}
	}, [loading]);

	useEffect(() => {
		// Add scroll listener with passive option for better performance
		let ticking = false;
		const throttledHandleScroll = () => {
			if (!ticking) {
				window.requestAnimationFrame(() => {
					handleScroll();
					ticking = false;
				});
				ticking = true;
			}
		};

		window.addEventListener("scroll", throttledHandleScroll, { passive: true });
		// Also listen to resize events in case content height changes
		window.addEventListener("resize", throttledHandleScroll, { passive: true });

		return () => {
			window.removeEventListener("scroll", throttledHandleScroll);
			window.removeEventListener("resize", throttledHandleScroll);
		};
	}, [handleScroll]);

	const defaultLoadingComponent = (
		<div style={{ padding: "20px", textAlign: "center", color: "#666" }}>
			Loading more...
		</div>
	);

	const defaultEndMessage = (
		<div style={{ padding: "20px", textAlign: "center", color: "#999" }}>
			No more items to load
		</div>
	);

	const sentinelRef = useRef(null);

	// Use Intersection Observer as primary method (more reliable)
	useEffect(() => {
		if (!hasMore || loading) return;

		const sentinel = sentinelRef.current;
		if (!sentinel) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (
					entry.isIntersecting &&
					hasMore &&
					!loading &&
					!isLoadingRef.current
				) {
					console.log(
						"🔄 InfiniteScroll: Intersection Observer triggered loadMore",
						{ hasMore, loading, isLoadingRef: isLoadingRef.current }
					);
					isLoadingRef.current = true;
					// Use setTimeout to prevent immediate re-triggering
					setTimeout(() => {
						onLoadMore();
					}, 100);
				}
			},
			{
				root: null, // Use viewport
				rootMargin: `${threshold}px`,
				threshold: 0.1,
			}
		);

		observer.observe(sentinel);

		return () => {
			observer.disconnect();
		};
	}, [hasMore, loading, onLoadMore, threshold]);

	return (
		<div className={className}>
			{children}
			{/* Sentinel element for Intersection Observer */}
			<div
				ref={sentinelRef}
				style={{
					height: "1px",
					visibility: "hidden",
					pointerEvents: "none",
				}}
			/>
			{loading && (loadingComponent || defaultLoadingComponent)}
			{!hasMore && (endMessage || defaultEndMessage)}
		</div>
	);
}
