import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
	searchUsers,
	sendFollowRequest,
	cancelFollowRequest,
	getFollowing,
	getSentRequests,
} from "../utils/nakamaClient";
import { subscribeToEvent } from "../contexts/NotificationContext";
import { usePagination } from "../hooks/usePagination";
import { InfiniteScrollWindow } from "../components/InfiniteScroll";
import "./FindPeoplePage.css";

/**
 * Find People Page - Discover and follow new users
 */
function FindPeoplePage({ client, session }) {
	const navigate = useNavigate();
	const [searchQuery, setSearchQuery] = useState("");
	const [followingSet, setFollowingSet] = useState(new Set());
	const [pendingFollows, setPendingFollows] = useState(new Set()); // User IDs with pending follow requests
	const [dismissedUsers, setDismissedUsers] = useState(new Set());
	const [actionLoading, setActionLoading] = useState(null); // Track loading state for individual actions

	// Create fetch function for search results
	const fetchSearchResults = useCallback(
		async (cursor, limit) => {
			if (!searchQuery.trim()) {
				return { data: { users: [], nextCursor: null, hasMore: false } };
			}
			const result = await searchUsers(
				client,
				session,
				searchQuery.trim(),
				limit,
				cursor || ""
			);
			// Backend returns: { success: true, data: { users: [], nextCursor: "" } }
			// Add hasMore based on nextCursor
			if (result.data) {
				result.data.hasMore = !!(
					result.data.nextCursor && result.data.nextCursor !== ""
				);
			}
			return result;
		},
		[client, session, searchQuery]
	);

	// Create fetch function for recommended users (empty search)
	const fetchRecommendedUsers = useCallback(
		async (cursor, limit) => {
			const result = await searchUsers(
				client,
				session,
				"",
				limit,
				cursor || ""
			);
			// Backend returns: { success: true, data: { users: [], nextCursor: "" } }
			// Add hasMore based on nextCursor
			if (result.data) {
				result.data.hasMore = !!(
					result.data.nextCursor && result.data.nextCursor !== ""
				);
			}
			return result;
		},
		[client, session]
	);

	// Use pagination hook for search results
	const {
		items: searchResults,
		loading: searchLoading,
		loadingMore: searchLoadingMore,
		hasMore: searchHasMore,
		loadMore: loadMoreSearch,
		reset: resetSearch,
		load: loadSearch,
	} = usePagination(fetchSearchResults, {
		defaultLimit: 20,
		autoLoad: false, // Don't auto-load, wait for search query
		onError: (err) => {
			console.error("Failed to search users:", err);
		},
	});

	// Use pagination hook for recommended users
	const {
		items: recommendedUsers,
		loading: recommendedLoading,
		loadingMore: recommendedLoadingMore,
		hasMore: recommendedHasMore,
		loadMore: loadMoreRecommended,
		reset: resetRecommended,
	} = usePagination(fetchRecommendedUsers, {
		defaultLimit: 20,
		autoLoad: true,
		onError: (err) => {
			console.error("Failed to load recommended users:", err);
		},
	});

	// Load following list to check follow status
	const loadFollowing = useCallback(async () => {
		if (!client || !session) return;
		try {
			const result = await getFollowing(client, session);
			const followingIds = new Set(
				(result.following || []).map((u) => u.userId)
			);
			setFollowingSet(followingIds);
		} catch (error) {
			console.error("Failed to load following:", error);
		}
	}, [client, session]);

	// Load sent follow requests to show pending state
	const loadSentRequests = useCallback(async () => {
		if (!client || !session) return;
		try {
			const result = await getSentRequests(client, session);
			const sentIds = new Set((result.sent || []).map((r) => r.toUserId));
			setPendingFollows(sentIds);
		} catch (error) {
			console.error("Failed to load sent requests:", error);
		}
	}, [client, session]);

	// Reset search when query changes (debounced)
	const searchQueryRef = useRef("");
	const debounceTimerRef = useRef(null);
	const isInitialMount = useRef(true);

	useEffect(() => {
		// Skip on initial mount to prevent duplicate calls
		if (isInitialMount.current) {
			isInitialMount.current = false;
			searchQueryRef.current = searchQuery;
			return;
		}

		// Clear any existing timer
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
		}

		// Only trigger if query actually changed
		if (searchQueryRef.current === searchQuery) {
			return;
		}
		searchQueryRef.current = searchQuery;

		// Debounce the search
		debounceTimerRef.current = setTimeout(() => {
			if (searchQuery.trim()) {
				console.log("🔍 Loading search with query:", searchQuery.trim());
				loadSearch(true); // Load with reset
			} else {
				// Clear search results when query is empty - don't call API
				console.log("🔍 Clearing search results");
			}
		}, 500); // Debounce to prevent too many requests

		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchQuery, loadSearch]);

	useEffect(() => {
		if (client && session) {
			loadFollowing();
			loadSentRequests();
		}
	}, [loadFollowing, loadSentRequests, client, session]);

	// Real-time event listeners
	useEffect(() => {
		// When your follow request is accepted, update followingSet and remove from pending
		const unsubAccepted = subscribeToEvent("follow_accepted", (data) => {
			const accepterId = data.accepterID || data.fromUserId || data.accepter_id;
			if (accepterId) {
				setFollowingSet((prev) => new Set([...prev, accepterId]));
				setPendingFollows((prev) => {
					const newSet = new Set(prev);
					newSet.delete(accepterId);
					return newSet;
				});
			}
		});

		// When your follow request is rejected, remove from pending
		const unsubRejected = subscribeToEvent("follow_rejected", (data) => {
			const rejecterId = data.rejecterID || data.fromUserId || data.rejecter_id;
			if (rejecterId) {
				setPendingFollows((prev) => {
					const newSet = new Set(prev);
					newSet.delete(rejecterId);
					return newSet;
				});
			}
		});

		return () => {
			unsubAccepted();
			unsubRejected();
		};
	}, []);

	// Handle follow
	const handleFollow = async (userId) => {
		if (pendingFollows.has(userId) || actionLoading === userId) return;
		setActionLoading(userId);
		try {
			await sendFollowRequest(client, session, userId);
			// Update UI to show pending state
			setPendingFollows((prev) => new Set([...prev, userId]));
		} catch (error) {
			console.error("Failed to send follow request:", error);
		} finally {
			setActionLoading(null);
		}
	};

	// Handle cancel follow request
	const handleCancelFollow = async (userId) => {
		if (actionLoading === userId) return;
		setActionLoading(userId);
		try {
			await cancelFollowRequest(client, session, userId);
			// Remove from pending
			setPendingFollows((prev) => {
				const newSet = new Set(prev);
				newSet.delete(userId);
				return newSet;
			});
		} catch (error) {
			console.error("Failed to cancel follow request:", error);
		} finally {
			setActionLoading(null);
		}
	};

	// Handle dismiss user from recommendations
	const handleDismiss = (userId) => {
		setDismissedUsers((prev) => new Set([...prev, userId]));
	};

	// Navigate to user profile when clicked
	const handleAvatarClick = (userId, e) => {
		e.stopPropagation();
		navigate(`/profile/${userId}`);
	};

	// Get display users based on search, filter out current user and dismissed users
	const displayUsers = useMemo(() => {
		const users = searchQuery.trim() ? searchResults : recommendedUsers;
		return users.filter(
			(u) => u.userId !== session?.user_id && !dismissedUsers.has(u.userId)
		);
	}, [searchQuery, searchResults, recommendedUsers, dismissedUsers, session]);

	const isLoading = searchQuery.trim() ? searchLoading : recommendedLoading;
	const isLoadingMore = searchQuery.trim()
		? searchLoadingMore
		: recommendedLoadingMore;
	const hasMore = searchQuery.trim() ? searchHasMore : recommendedHasMore;
	const loadMore = searchQuery.trim() ? loadMoreSearch : loadMoreRecommended;

	if (!session) {
		return (
			<div className="find-people-page">
				<div className="empty-state">
					<div className="empty-icon">🔒</div>
					<h3>Please log in</h3>
					<p>You need to be logged in to find people.</p>
				</div>
			</div>
		);
	}

	return (
		<div className="find-people-page">
			{/* Header */}
			<div className="find-people-header">
				<button className="back-btn" onClick={() => navigate(-1)}>
					‹
				</button>
				<h1>Find People</h1>
			</div>

			{/* Search Bar */}
			<div className="find-people-search">
				<span className="search-icon">🔍</span>
				<input
					type="text"
					className="search-input"
					placeholder="What's new?..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
				/>
			</div>

			{/* Section Label */}
			<div className="section-label">
				{searchQuery.trim() ? "Search Results" : "Recommended"}
			</div>

			{/* Users List */}
			<InfiniteScrollWindow
				onLoadMore={loadMore}
				hasMore={hasMore}
				loading={isLoadingMore}
				loadingComponent={
					<div className="users-loading">
						<div className="spinner"></div>
						<p>Loading more users...</p>
					</div>
				}
				endMessage={
					displayUsers.length > 0 ? (
						<div
							className="users-empty"
							style={{ padding: "20px", color: "#999" }}
						>
							No more users to load
						</div>
					) : null
				}
			>
				<div className="users-list">
					{isLoading && displayUsers.length === 0 ? (
						<div className="users-loading">
							<div className="spinner"></div>
						</div>
					) : displayUsers.length === 0 ? (
						<div className="users-empty">
							{searchQuery.trim()
								? "No users found"
								: "No recommendations available"}
						</div>
					) : (
						displayUsers.map((user) => {
							const isFollowing = followingSet.has(user.userId);
							const isPending = pendingFollows.has(user.userId);

							return (
								<div key={user.userId} className="user-item">
									{/* Avatar - click to view profile */}
									<div
										className="user-avatar-wrapper clickable"
										onClick={(e) => handleAvatarClick(user.userId, e)}
										title="View profile"
									>
										{user.avatarUrl ? (
											<img
												src={user.avatarUrl}
												alt={user.username}
												className="user-avatar"
											/>
										) : (
											<div className="user-avatar-placeholder">
												{(user.username || "U")[0].toUpperCase()}
											</div>
										)}
									</div>
									{/* User info - click to view profile */}
									<div
										className="user-info clickable"
										onClick={(e) => handleAvatarClick(user.userId, e)}
										title="View profile"
									>
										<div className="user-name">
											{user.displayName || user.username || "Unknown User"}
										</div>
										{isFollowing && (
											<div className="user-subtitle">Following</div>
										)}
									</div>
									<div
										className="user-actions"
										onClick={(e) => e.stopPropagation()}
									>
										{isFollowing ? (
											<span className="following-badge">Following</span>
										) : isPending ? (
											<>
												<span className="pending-badge">Pending</span>
												<button
													className="cancel-btn"
													onClick={() => handleCancelFollow(user.userId)}
													disabled={actionLoading === user.userId}
												>
													{actionLoading === user.userId ? "..." : "Cancel"}
												</button>
											</>
										) : (
											<>
												<button
													className="follow-btn"
													onClick={() => handleFollow(user.userId)}
													disabled={actionLoading === user.userId}
												>
													{actionLoading === user.userId ? "..." : "Follow"}
												</button>
												{!searchQuery.trim() && (
													<button
														className="dismiss-btn"
														onClick={() => handleDismiss(user.userId)}
													>
														×
													</button>
												)}
											</>
										)}
									</div>
								</div>
							);
						})
					)}
				</div>
			</InfiniteScrollWindow>
		</div>
	);
}

export default FindPeoplePage;
