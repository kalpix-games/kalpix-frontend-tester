import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./FollowSystemPage.css";
import {
	searchUsers,
	sendFollowRequest,
	acceptFollowRequest,
	rejectFollowRequest,
	cancelFollowRequest,
	getFollowRequests,
	getSentRequests,
	getFollowers,
	getFollowing,
	unfollow,
} from "../utils/nakamaClient";
import { useNotifications } from "../contexts/NotificationContext";

/**
 * Follow System Page Component
 * Complete follow system with search, requests, followers, and following
 */
function FollowSystemPage({ client, session }) {
	const navigate = useNavigate();
	const { decrementFollowRequestCount, notifications } = useNotifications();
	const [activeTab, setActiveTab] = useState("search"); // 'search', 'requests', 'followers', 'following'
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	// Search state
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState([]);

	// Requests state
	const [receivedRequests, setReceivedRequests] = useState([]);
	const [sentRequests, setSentRequests] = useState([]);

	// Followers/Following state
	const [followers, setFollowers] = useState([]);
	const [following, setFollowing] = useState([]);

	// Track processed notifications to prevent duplicates
	const [processedNotificationIds, setProcessedNotificationIds] = useState(
		new Set()
	);

	// Load data when tab changes
	useEffect(() => {
		if (activeTab === "requests") {
			loadRequests();
		} else if (activeTab === "followers") {
			loadFollowers();
		} else if (activeTab === "following") {
			loadFollowing();
		}
	}, [activeTab]);

	// Listen for new follow request notifications and auto-reload
	useEffect(() => {
		const latestNotification = notifications[0];
		if (!latestNotification) return;

		// Check if we've already processed this notification
		if (processedNotificationIds.has(latestNotification.id)) {
			return;
		}

		// Mark as processed
		setProcessedNotificationIds((prev) =>
			new Set(prev).add(latestNotification.id)
		);

		// Handle different notification types
		if (latestNotification.subject === "follow_request") {
			// Auto-reload requests if on requests tab
			if (activeTab === "requests") {
				loadRequests();
			}
			// Show success message
			setSuccess(
				latestNotification.content.message || "New follow request received!"
			);
		} else if (latestNotification.subject === "follow_accepted") {
			// Auto-reload following if on following tab
			if (activeTab === "following") {
				loadFollowing();
			}
			setSuccess("Your follow request was accepted!");
		} else if (latestNotification.subject === "follow_request_cancelled") {
			// Auto-reload requests if on requests tab
			if (activeTab === "requests") {
				loadRequests();
			}
			// Show info message
			setSuccess(
				latestNotification.content.message || "A follow request was cancelled"
			);
		} else if (latestNotification.subject === "follow_request_accepted_self") {
			// User accepted someone's request - reload requests and followers
			if (activeTab === "requests") {
				loadRequests();
			} else if (activeTab === "followers") {
				loadFollowers();
			}
			setSuccess(
				latestNotification.content.message ||
					"Follow request accepted successfully"
			);
		} else if (latestNotification.subject === "follow_request_rejected_self") {
			// User rejected someone's request - reload requests
			if (activeTab === "requests") {
				loadRequests();
			}
			setSuccess(
				latestNotification.content.message ||
					"Follow request rejected successfully"
			);
		}
	}, [notifications, processedNotificationIds, activeTab]);

	// Clear messages after 3 seconds
	useEffect(() => {
		if (error || success) {
			const timer = setTimeout(() => {
				setError("");
				setSuccess("");
			}, 3000);
			return () => clearTimeout(timer);
		}
	}, [error, success]);

	// Search users
	const handleSearch = async () => {
		if (!searchQuery.trim()) {
			setError("Please enter a search query");
			return;
		}

		setLoading(true);
		setError("");
		try {
			const result = await searchUsers(client, session, searchQuery, 20);
			setSearchResults(result.users || []);
			if (result.users?.length === 0) {
				setError("No users found");
			}
		} catch (err) {
			console.error("Search error:", err);
			setError(err.message || "Failed to search users");
		} finally {
			setLoading(false);
		}
	};

	// Send follow request
	const handleSendRequest = async (userId) => {
		setLoading(true);
		setError("");
		try {
			await sendFollowRequest(client, session, userId);
			setSuccess("Follow request sent!");
			// Update search results to reflect the sent request
			setSearchResults(
				searchResults.map((user) =>
					(user.userId || user.user_id) === userId
						? { ...user, requestSent: true }
						: user
				)
			);
		} catch (err) {
			console.error("Send request error:", err);
			setError(err.message || "Failed to send follow request");
		} finally {
			setLoading(false);
		}
	};

	// Load received and sent requests
	const loadRequests = async () => {
		setLoading(true);
		setError("");
		try {
			const [receivedData, sentData] = await Promise.all([
				getFollowRequests(client, session),
				getSentRequests(client, session),
			]);
			// Extract arrays from response - backend returns FollowRequestList with received/sent fields
			setReceivedRequests(receivedData?.received || []);
			setSentRequests(sentData?.sent || []);
		} catch (err) {
			console.error("Load requests error:", err);
			setError(err.message || "Failed to load requests");
		} finally {
			setLoading(false);
		}
	};

	// Accept follow request
	const handleAcceptRequest = async (requesterId) => {
		setLoading(true);
		setError("");
		try {
			await acceptFollowRequest(client, session, requesterId);
			setSuccess("Follow request accepted!");
			decrementFollowRequestCount(); // Decrement notification badge
			loadRequests(); // Reload requests
		} catch (err) {
			console.error("Accept request error:", err);
			setError(err.message || "Failed to accept request");
		} finally {
			setLoading(false);
		}
	};

	// Reject follow request
	const handleRejectRequest = async (requesterId) => {
		setLoading(true);
		setError("");
		try {
			await rejectFollowRequest(client, session, requesterId);
			setSuccess("Follow request rejected");
			decrementFollowRequestCount(); // Decrement notification badge
			loadRequests(); // Reload requests
		} catch (err) {
			console.error("Reject request error:", err);
			setError(err.message || "Failed to reject request");
		} finally {
			setLoading(false);
		}
	};

	// Cancel sent request
	const handleCancelRequest = async (targetUserId) => {
		setLoading(true);
		setError("");
		try {
			await cancelFollowRequest(client, session, targetUserId);
			setSuccess("Follow request cancelled");
			loadRequests(); // Reload requests
		} catch (err) {
			console.error("Cancel request error:", err);
			setError(err.message || "Failed to cancel request");
		} finally {
			setLoading(false);
		}
	};

	// Load followers
	const loadFollowers = async () => {
		setLoading(true);
		setError("");
		try {
			const result = await getFollowers(client, session);
			setFollowers(result.followers || []);
		} catch (err) {
			console.error("Load followers error:", err);
			setError(err.message || "Failed to load followers");
		} finally {
			setLoading(false);
		}
	};

	// Load following
	const loadFollowing = async () => {
		setLoading(true);
		setError("");
		try {
			const result = await getFollowing(client, session);
			setFollowing(result.following || []);
		} catch (err) {
			console.error("Load following error:", err);
			setError(err.message || "Failed to load following");
		} finally {
			setLoading(false);
		}
	};

	// Unfollow user
	const handleUnfollow = async (userId) => {
		if (!window.confirm("Are you sure you want to unfollow this user?")) {
			return;
		}

		setLoading(true);
		setError("");
		try {
			await unfollow(client, session, userId);
			setSuccess("Unfollowed successfully");
			loadFollowing(); // Reload following list
		} catch (err) {
			console.error("Unfollow error:", err);
			setError(err.message || "Failed to unfollow");
		} finally {
			setLoading(false);
		}
	};

	// Render user card
	const renderUserCard = (user, actions) => {
		const userId = user.userId || user.user_id;

		return (
			<div key={userId} className="user-card">
				<div
					className="user-info-clickable"
					onClick={() => navigate(`/profile/${userId}`)}
					style={{
						cursor: "pointer",
						flex: 1,
						display: "flex",
						alignItems: "center",
						gap: "15px",
					}}
				>
					<div className="user-avatar">
						{user.avatarUrl || user.avatar_url ? (
							<img
								src={user.avatarUrl || user.avatar_url}
								alt={user.username}
							/>
						) : (
							<span className="avatar-placeholder">👤</span>
						)}
					</div>
					<div className="user-info">
						<div className="user-name">
							{user.displayName || user.display_name || user.username}
						</div>
						<div className="user-username">@{user.username}</div>
						{(user.isFriend || user.is_friend) && (
							<span className="friend-badge">🤝 Friend</span>
						)}
					</div>
				</div>
				<div className="user-actions">{actions}</div>
			</div>
		);
	};

	return (
		<div className="follow-system-page">
			<div className="follow-container">
				{/* Header */}
				<div className="follow-header">
					<h1>👥 Follow System</h1>
					<p>Search users, manage requests, and view connections</p>
				</div>

				{/* Messages */}
				{error && <div className="message error-message">{error}</div>}
				{success && <div className="message success-message">{success}</div>}

				{/* Tab Navigation */}
				<div className="follow-tabs">
					<button
						className={`tab-btn ${activeTab === "search" ? "active" : ""}`}
						onClick={() => setActiveTab("search")}
					>
						🔍 Search
					</button>
					<button
						className={`tab-btn ${activeTab === "requests" ? "active" : ""}`}
						onClick={() => setActiveTab("requests")}
					>
						📬 Requests
						{receivedRequests.length > 0 && (
							<span className="badge">{receivedRequests.length}</span>
						)}
					</button>
					<button
						className={`tab-btn ${activeTab === "followers" ? "active" : ""}`}
						onClick={() => setActiveTab("followers")}
					>
						👥 Followers
						{followers.length > 0 && (
							<span className="count">({followers.length})</span>
						)}
					</button>
					<button
						className={`tab-btn ${activeTab === "following" ? "active" : ""}`}
						onClick={() => setActiveTab("following")}
					>
						➕ Following
						{following.length > 0 && (
							<span className="count">({following.length})</span>
						)}
					</button>
				</div>

				{/* Search Tab */}
				{activeTab === "search" && (
					<div className="tab-content">
						<div className="search-section">
							<div className="search-bar">
								<input
									type="text"
									placeholder="Search by username or display name..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									onKeyPress={(e) => e.key === "Enter" && handleSearch()}
								/>
								<button onClick={handleSearch} disabled={loading}>
									{loading ? "Searching..." : "Search"}
								</button>
							</div>

							<div className="users-list">
								{searchResults.length === 0 ? (
									<div className="empty-state">
										<p>🔍 Search for users to connect with</p>
									</div>
								) : (
									searchResults.map((user) =>
										renderUserCard(
											user,
											<>
												{user.isFollowing || user.is_following ? (
													<span className="status-badge">✓ Following</span>
												) : user.requestSent ? (
													<span className="status-badge">⏳ Pending</span>
												) : (
													<button
														className="btn-primary"
														onClick={() =>
															handleSendRequest(user.userId || user.user_id)
														}
														disabled={loading}
													>
														Follow
													</button>
												)}
											</>
										)
									)
								)}
							</div>
						</div>
					</div>
				)}

				{/* Requests Tab */}
				{activeTab === "requests" && (
					<div className="tab-content">
						<div className="requests-section">
							<h3>📥 Received Requests</h3>
							<div className="users-list">
								{receivedRequests.length === 0 ? (
									<div className="empty-state">
										<p>No pending requests</p>
									</div>
								) : (
									receivedRequests.map((request) =>
										renderUserCard(
											{
												user_id: request.fromUserId,
												username: request.fromUsername,
												display_name: request.fromDisplayName,
												avatar_url: request.fromAvatarUrl,
											},
											<>
												<button
													className="btn-success"
													onClick={() =>
														handleAcceptRequest(request.fromUserId)
													}
													disabled={loading}
												>
													✓ Accept
												</button>
												<button
													className="btn-danger"
													onClick={() =>
														handleRejectRequest(request.fromUserId)
													}
													disabled={loading}
												>
													✗ Reject
												</button>
											</>
										)
									)
								)}
							</div>

							<h3>📤 Sent Requests</h3>
							<div className="users-list">
								{sentRequests.length === 0 ? (
									<div className="empty-state">
										<p>No sent requests</p>
									</div>
								) : (
									sentRequests.map((request) =>
										renderUserCard(
											{
												user_id: request.toUserId,
												username: request.toUsername,
												display_name: request.toUsername,
												avatar_url: "",
											},
											<button
												className="btn-secondary"
												onClick={() => handleCancelRequest(request.toUserId)}
												disabled={loading}
											>
												Cancel
											</button>
										)
									)
								)}
							</div>
						</div>
					</div>
				)}

				{/* Followers Tab */}
				{activeTab === "followers" && (
					<div className="tab-content">
						<div className="followers-section">
							<div className="users-list">
								{followers.length === 0 ? (
									<div className="empty-state">
										<p>No followers yet</p>
									</div>
								) : (
									followers.map((user) =>
										renderUserCard(
											user,
											(user.isFriend || user.is_friend) && (
												<span className="status-badge">🤝 Mutual</span>
											)
										)
									)
								)}
							</div>
						</div>
					</div>
				)}

				{/* Following Tab */}
				{activeTab === "following" && (
					<div className="tab-content">
						<div className="following-section">
							<div className="users-list">
								{following.length === 0 ? (
									<div className="empty-state">
										<p>Not following anyone yet</p>
									</div>
								) : (
									following.map((user) =>
										renderUserCard(
											user,
											<>
												{(user.isFriend || user.is_friend) && (
													<span className="status-badge">🤝 Friend</span>
												)}
												<button
													className="btn-danger"
													onClick={() =>
														handleUnfollow(user.userId || user.user_id)
													}
													disabled={loading}
												>
													Unfollow
												</button>
											</>
										)
									)
								)}
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export default FollowSystemPage;
