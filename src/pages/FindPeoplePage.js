import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
	searchUsers,
	sendFollowRequest,
	cancelFollowRequest,
	getFollowing,
	getSentRequests,
} from "../utils/nakamaClient";
import { subscribeToEvent } from "../contexts/NotificationContext";
import "./FindPeoplePage.css";

/**
 * Find People Page - Discover and follow new users
 */
function FindPeoplePage({ client, session }) {
	const navigate = useNavigate();
	const [searchQuery, setSearchQuery] = useState("");
	const [recommendedUsers, setRecommendedUsers] = useState([]);
	const [searchResults, setSearchResults] = useState([]);
	const [loading, setLoading] = useState(false);
	const [followingSet, setFollowingSet] = useState(new Set());
	const [pendingFollows, setPendingFollows] = useState(new Set()); // User IDs with pending follow requests
	const [dismissedUsers, setDismissedUsers] = useState(new Set());
	const [actionLoading, setActionLoading] = useState(null); // Track loading state for individual actions

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

	// Load recommended users (search with empty query or popular users)
	const loadRecommendedUsers = useCallback(async () => {
		if (!client || !session) return;
		setLoading(true);
		try {
			// Search for users to get recommendations
			const result = await searchUsers(client, session, "", 50);
			console.log("🔍 Search result:", result);
			const users = result.users || [];
			console.log("🔍 Users array:", users);
			if (users.length > 0) {
				console.log("🔍 First user object:", users[0]);
			}
			// Filter out current user and already following
			const filtered = users.filter(
				(u) => u.userId !== session.user_id && !followingSet.has(u.userId)
			);
			setRecommendedUsers(filtered);
		} catch (error) {
			console.error("Failed to load recommended users:", error);
		} finally {
			setLoading(false);
		}
	}, [client, session, followingSet]);

	// Search users
	const handleSearch = useCallback(async () => {
		if (!client || !session || !searchQuery.trim()) {
			setSearchResults([]);
			return;
		}
		setLoading(true);
		try {
			const result = await searchUsers(client, session, searchQuery.trim(), 20);
			const users = result.users || [];
			// Filter out current user
			const filtered = users.filter((u) => u.userId !== session.user_id);
			setSearchResults(filtered);
		} catch (error) {
			console.error("Failed to search users:", error);
		} finally {
			setLoading(false);
		}
	}, [client, session, searchQuery]);

	useEffect(() => {
		loadFollowing();
		loadSentRequests();
	}, [loadFollowing, loadSentRequests]);

	useEffect(() => {
		if (followingSet.size > 0 || session) {
			loadRecommendedUsers();
		}
	}, [followingSet, session, loadRecommendedUsers]);

	useEffect(() => {
		const debounce = setTimeout(() => {
			if (searchQuery.trim()) {
				handleSearch();
			} else {
				setSearchResults([]);
			}
		}, 300);
		return () => clearTimeout(debounce);
	}, [searchQuery, handleSearch]);

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

	// Get display users based on search
	const displayUsers = searchQuery.trim()
		? searchResults
		: recommendedUsers.filter((u) => !dismissedUsers.has(u.userId));

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
			<div className="users-list">
				{loading ? (
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
		</div>
	);
}

export default FindPeoplePage;
