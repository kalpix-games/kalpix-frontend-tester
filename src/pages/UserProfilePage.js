import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
	getUserProfile,
	getChannels,
	sendFollowRequest,
	cancelFollowRequest,
	unfollow,
	getFollowing,
	getSentRequests,
	getUserPosts,
} from "../utils/nakamaClient";
import { subscribeToEvent } from "../contexts/NotificationContext";
import { usePagination } from "../hooks/usePagination";
import { InfiniteScrollWindow } from "../components/InfiniteScroll";
import "./UserProfilePage.css";

// Country code to flag emoji converter
const getCountryFlag = (countryCode) => {
	if (!countryCode || countryCode.length !== 2) return "🌍";
	const codePoints = countryCode
		.toUpperCase()
		.split("")
		.map((char) => 127397 + char.charCodeAt(0));
	return String.fromCodePoint(...codePoints);
};

/**
 * User Profile Page Component - Redesigned with dark purple theme
 * Displays other user's profile with Follow/Send Message buttons
 */
function UserProfilePage({ client, session }) {
	const { userId } = useParams();
	const navigate = useNavigate();
	const [profile, setProfile] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [activeTab, setActiveTab] = useState("posts");
	const [actionLoading, setActionLoading] = useState(false);
	const [followStatus, setFollowStatus] = useState("none"); // none, following, pending

	// Create fetch function for user posts
	const fetchUserPosts = useCallback(
		async (cursor, limit) => {
			return await getUserPosts(client, session, userId, limit, cursor || "");
		},
		[client, session, userId]
	);

	// Use pagination hook for posts
	const {
		items: posts,
		loading: postsLoading,
		loadingMore: postsLoadingMore,
		hasMore: postsHasMore,
		loadMore: loadMorePosts,
		reset: resetPosts,
	} = usePagination(fetchUserPosts, {
		defaultLimit: 20,
		autoLoad: true,
		onError: (err) => {
			console.error("Failed to load posts:", err);
		},
	});

	// Load follow status
	const loadFollowStatus = useCallback(async () => {
		if (!client || !session || !userId) return;
		try {
			// Check if already following
			const followingResult = await getFollowing(client, session);
			const following = followingResult.following || [];
			if (following.some((f) => f.userId === userId)) {
				setFollowStatus("following");
				return;
			}

			// Check if request is pending
			const sentResult = await getSentRequests(client, session);
			// Backend returns { sent: [...] } with toUserId field
			const sentRequests = sentResult.sent || sentResult.requests || [];
			if (
				sentRequests.some(
					(r) => r.toUserId === userId || r.targetUserId === userId
				)
			) {
				setFollowStatus("pending");
				return;
			}

			setFollowStatus("none");
		} catch (err) {
			console.error("Failed to load follow status:", err);
		}
	}, [client, session, userId]);

	useEffect(() => {
		loadProfile();
		loadFollowStatus();
		resetPosts(); // Reset posts when userId changes
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [userId]);

	// Subscribe to real-time follow status updates
	useEffect(() => {
		// When your follow request is accepted by this user
		const unsubAccepted = subscribeToEvent("follow_accepted", (data) => {
			const accepterId = data.accepterID || data.fromUserId || data.accepter_id;
			if (accepterId === userId) {
				setFollowStatus("following");
				// Update profile counts - you are now following this user
				setProfile((prev) =>
					prev
						? {
								...prev,
								followersCount: (prev.followersCount || 0) + 1,
						  }
						: prev
				);
			}
		});

		// When your follow request is rejected by this user
		const unsubRejected = subscribeToEvent("follow_rejected", (data) => {
			const rejecterId = data.rejecterID || data.fromUserId || data.rejecter_id;
			if (rejecterId === userId) {
				setFollowStatus("none");
			}
		});

		// When someone follows you (you're viewing their profile)
		const unsubFollowRequest = subscribeToEvent("follow_request", (data) => {
			const requesterId =
				data.requesterID || data.fromUserId || data.requester_id;
			if (requesterId === userId) {
				// This user sent you a follow request - no count change needed here
			}
		});

		// When you accept someone's follow request (viewing their profile)
		const unsubAcceptedSelf = subscribeToEvent(
			"follow_request_accepted_self",
			(data) => {
				const acceptedUserId =
					data.acceptedUserId || data.fromUserId || data.accepted_user_id;
				if (acceptedUserId === userId) {
					// You accepted this user's follow request - their following count increases
					setProfile((prev) =>
						prev
							? {
									...prev,
									followingCount: (prev.followingCount || 0) + 1,
							  }
							: prev
					);
				}
			}
		);

		return () => {
			unsubAccepted();
			unsubRejected();
			unsubFollowRequest();
			unsubAcceptedSelf();
		};
	}, [userId]);

	const loadProfile = async () => {
		setLoading(true);
		setError("");
		try {
			const data = await getUserProfile(client, session, userId);
			console.log("🔍 Profile data received:", data);
			setProfile(data);
		} catch (err) {
			console.error("Load profile error:", err);
			setError(err.message || "Failed to load profile");
		} finally {
			setLoading(false);
		}
	};

	const formatJoinDate = (timestamp) => {
		if (!timestamp) return "Unknown";
		const date = new Date(timestamp * 1000);
		const day = date.getDate();
		const month = date.toLocaleString("en-US", { month: "short" });
		const year = date.getFullYear();
		return `${day} ${month} ${year}`;
	};

	// Handle follow button
	const handleFollow = async () => {
		if (actionLoading) return;
		setActionLoading(true);
		try {
			if (followStatus === "following") {
				await unfollow(client, session, userId);
				setFollowStatus("none");
				// Update profile counts - you unfollowed this user
				setProfile((prev) =>
					prev
						? {
								...prev,
								followersCount: Math.max(0, (prev.followersCount || 0) - 1),
						  }
						: prev
				);
			} else if (followStatus === "pending") {
				await cancelFollowRequest(client, session, userId);
				setFollowStatus("none");
			} else {
				await sendFollowRequest(client, session, userId);
				setFollowStatus("pending");
			}
		} catch (err) {
			console.error("Follow action failed:", err);
		} finally {
			setActionLoading(false);
		}
	};

	// Handle send message - navigate to DM or new conversation
	const handleSendMessage = async () => {
		if (actionLoading) return;
		setActionLoading(true);
		try {
			// Check if a channel already exists with this user
			const result = await getChannels(client, session);
			const existingChannel = (result.channels || []).find((ch) => {
				if (ch.channelType !== "direct") return false;
				return (ch.participantIds || []).includes(userId);
			});

			if (existingChannel) {
				// Navigate to existing channel
				navigate(`/chat/${existingChannel.channelId}`);
			} else {
				// Navigate to new conversation page - channel will be created on first message
				navigate(`/chat/new/${userId}`);
			}
		} catch (err) {
			console.error("Failed to start conversation:", err);
			// Fallback to new conversation page
			navigate(`/chat/new/${userId}`);
		} finally {
			setActionLoading(false);
		}
	};

	// Loading state
	if (loading) {
		return (
			<div className="profile-loading">
				<div className="profile-spinner"></div>
				<p>Loading profile...</p>
			</div>
		);
	}

	// Error state
	if (error || !profile) {
		return (
			<div className="profile-error">
				<div className="profile-error-icon">😕</div>
				<h3>{error || "Profile not found"}</h3>
				<p>We couldn't load this profile. Please try again.</p>
				<button className="profile-error-btn" onClick={() => navigate(-1)}>
					Go Back
				</button>
			</div>
		);
	}

	// Get follow button text
	const getFollowButtonText = () => {
		if (actionLoading) return "...";
		if (followStatus === "following") return "Unfollow";
		if (followStatus === "pending") return "Requested";
		return "Follow";
	};

	// Get content based on active tab
	const getTabContent = () => {
		switch (activeTab) {
			case "posts":
				return (
					<InfiniteScrollWindow
						onLoadMore={loadMorePosts}
						hasMore={postsHasMore}
						loading={postsLoadingMore}
						loadingComponent={
							<div style={{ padding: "20px", textAlign: "center" }}>
								Loading more posts...
							</div>
						}
						endMessage={
							posts.length > 0 ? (
								<div style={{ padding: "20px", textAlign: "center", color: "#999" }}>
									No more posts
								</div>
							) : null
						}
					>
						{postsLoading && posts.length === 0 ? (
							<div className="tab-empty">
								<div className="tab-empty-icon">⏳</div>
								<h3>Loading posts...</h3>
							</div>
						) : posts.length > 0 ? (
							<div className="posts-grid">
								{posts.map((item) => {
									const postId = item.postId || item.id;
									const mediaUrl = item.mediaUrl || item.media_url || item.url;
									return (
										<div key={postId || item.id} className="post-item">
											{mediaUrl ? (
												mediaUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
													<img src={mediaUrl} alt="Post" />
												) : (
													<video src={mediaUrl} controls />
												)
											) : (
												<div className="post-placeholder">📷</div>
											)}
										</div>
									);
								})}
							</div>
						) : (
							<div className="tab-empty">
								<div className="tab-empty-icon">📷</div>
								<h3>No posts yet</h3>
								<p>Posts will appear here</p>
							</div>
						)}
					</InfiniteScrollWindow>
				);
			case "stats":
				return (
					<div className="tab-empty">
						<div className="tab-empty-icon">📊</div>
						<h3>Stats</h3>
						<p>User statistics will appear here</p>
					</div>
				);
			case "collection":
				return (
					<div className="tab-empty">
						<div className="tab-empty-icon">🎮</div>
						<h3>Collection</h3>
						<p>Game collection will appear here</p>
					</div>
				);
			case "wishlist":
				return (
					<div className="tab-empty">
						<div className="tab-empty-icon">⭐</div>
						<h3>Wishlist</h3>
						<p>Wishlist items will appear here</p>
					</div>
				);
			default:
				return null;
		}
	};

	return (
		<div className="user-profile-page">
			{/* Header */}
			<div className="user-profile-header">
				<button className="back-btn-circle" onClick={() => navigate(-1)}>
					‹
				</button>
				<button className="menu-btn" onClick={() => {}}>
					⋮
				</button>
			</div>

			{/* Profile Card */}
			<div className="user-profile-card">
				<div className="profile-avatar-container">
					{profile.avatarUrl ? (
						<img
							src={profile.avatarUrl}
							alt={profile.username}
							className="profile-avatar-img"
						/>
					) : (
						<div className="profile-avatar-placeholder">
							{(profile.username || "U")[0].toUpperCase()}
						</div>
					)}
					{profile.isOnline && <div className="online-indicator"></div>}
				</div>

				<div className="profile-user-info">
					<h2 className="profile-display-name">
						{profile.displayName || profile.username}
					</h2>
					<p className="profile-username">@{profile.username}</p>
					<div className="profile-badges">
						{profile.country && (
							<span className="badge country-badge">
								{getCountryFlag(profile.country)} {profile.country}
							</span>
						)}
						<span className="badge join-badge">
							📅 Joined {formatJoinDate(profile.createdAt)}
						</span>
					</div>
				</div>

				{/* Stats Section */}
				<div className="profile-stats">
					<div className="stat-item">
						<span className="stat-value">{profile.friendsCount || 0}</span>
						<span className="stat-label">Friends</span>
					</div>
					<div className="stat-item">
						<span className="stat-value">{profile.followersCount || 0}</span>
						<span className="stat-label">Followers</span>
					</div>
					<div className="stat-item">
						<span className="stat-value">{profile.followingCount || 0}</span>
						<span className="stat-label">Following</span>
					</div>
					<div className="stat-item">
						<span className="stat-value">{profile.totalWins || 0}</span>
						<span className="stat-label">Total Wins</span>
					</div>
				</div>

				{/* Bio Section */}
				<div className="profile-bio-section">
					<h3 className="bio-title">Bio</h3>
					<p className="bio-text">{profile.bio || "No bio yet"}</p>
				</div>

				{/* Action Buttons */}
				<div className="profile-action-buttons">
					<button
						className={`action-btn follow-btn ${
							followStatus !== "none" ? "active" : ""
						}`}
						onClick={handleFollow}
						disabled={actionLoading}
					>
						<span className="btn-icon">👤</span>
						<span className="btn-text">{getFollowButtonText()}</span>
					</button>
					<button
						className="action-btn message-btn"
						onClick={handleSendMessage}
						disabled={actionLoading}
					>
						<span className="btn-icon">✏️</span>
						<span className="btn-text">Send Message</span>
					</button>
				</div>
			</div>

			{/* Content Tabs */}
			<div className="content-tabs">
				<button
					className={`content-tab ${activeTab === "posts" ? "active" : ""}`}
					onClick={() => setActiveTab("posts")}
				>
					Posts
				</button>
				<button
					className={`content-tab ${activeTab === "stats" ? "active" : ""}`}
					onClick={() => setActiveTab("stats")}
				>
					My Stats
				</button>
				<button
					className={`content-tab ${
						activeTab === "collection" ? "active" : ""
					}`}
					onClick={() => setActiveTab("collection")}
				>
					My Collection
				</button>
				<button
					className={`content-tab ${activeTab === "wishlist" ? "active" : ""}`}
					onClick={() => setActiveTab("wishlist")}
				>
					Wishlist
				</button>
			</div>

			{/* Tab Content */}
			<div className="tab-content">{getTabContent()}</div>
		</div>
	);
}

export default UserProfilePage;
