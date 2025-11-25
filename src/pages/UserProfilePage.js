import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
	getUserProfile,
	sendFollowRequest,
	cancelFollowRequest,
	unfollow,
} from "../utils/nakamaClient";
import FollowersModal from "../components/FollowersModal";
import "./UserProfilePage.css";

/**
 * User Profile Page Component
 * Displays user profile with privacy controls
 * - Public info: always visible
 * - Private info: visible only to friends or profile owner
 */
function UserProfilePage({ client, session }) {
	const { userId } = useParams();
	const navigate = useNavigate();
	const [profile, setProfile] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [actionLoading, setActionLoading] = useState(false);
	const [activeTab, setActiveTab] = useState("posts"); // 'posts', 'followers', 'following'
	const [showFollowersModal, setShowFollowersModal] = useState(false);
	const [showFollowingModal, setShowFollowingModal] = useState(false);
	const [showFriendsModal, setShowFriendsModal] = useState(false);

	useEffect(() => {
		loadProfile();
	}, [userId]);

	const loadProfile = async () => {
		setLoading(true);
		setError("");
		try {
			const data = await getUserProfile(client, session, userId);
			console.log("🔍 Profile data received:", {
				username: data.username,
				isFriend: data.isFriend,
				isFollowing: data.isFollowing,
				isFollowedBy: data.isFollowedBy,
				hasPendingRequest: data.hasPendingRequest,
			});
			setProfile(data);
		} catch (err) {
			console.error("Load profile error:", err);
			setError(err.message || "Failed to load profile");
		} finally {
			setLoading(false);
		}
	};

	const formatDate = (timestamp) => {
		if (!timestamp) return "Unknown";
		const date = new Date(timestamp * 1000);
		return date.toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	};

	const formatLastSeen = (timestamp) => {
		if (!timestamp) return "Never";
		const now = Date.now();
		const lastSeen = timestamp * 1000;
		const diff = now - lastSeen;

		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (minutes < 1) return "Just now";
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		return `${days}d ago`;
	};

	const handleSendFollowRequest = async () => {
		setActionLoading(true);
		setError("");
		setSuccess("");
		try {
			await sendFollowRequest(client, session, userId);
			setSuccess("Follow request sent!");
			// Reload profile to update status
			await loadProfile();
		} catch (err) {
			setError(err.message || "Failed to send follow request");
		} finally {
			setActionLoading(false);
		}
	};

	const handleCancelFollowRequest = async () => {
		setActionLoading(true);
		setError("");
		setSuccess("");
		try {
			await cancelFollowRequest(client, session, userId);
			setSuccess("Follow request cancelled");
			// Reload profile to update status
			await loadProfile();
		} catch (err) {
			setError(err.message || "Failed to cancel follow request");
		} finally {
			setActionLoading(false);
		}
	};

	const handleUnfollow = async () => {
		if (!window.confirm("Are you sure you want to unfollow this user?")) {
			return;
		}
		setActionLoading(true);
		setError("");
		setSuccess("");
		try {
			await unfollow(client, session, userId);
			setSuccess("Unfollowed successfully");
			// Reload profile to update status
			await loadProfile();
		} catch (err) {
			setError(err.message || "Failed to unfollow");
		} finally {
			setActionLoading(false);
		}
	};

	const handleRemoveFollower = async () => {
		if (
			!window.confirm(
				"Are you sure you want to remove this follower? They will no longer see your followers-only posts."
			)
		) {
			return;
		}
		setActionLoading(true);
		setError("");
		setSuccess("");
		try {
			// To remove a follower, we call unfollow with their ID
			// This removes the follow relationship from our side
			// In Nakama's friend system, this removes them from our followers list
			await unfollow(client, session, userId);
			setSuccess("Follower removed successfully");
			// Reload profile to update status
			await loadProfile();
		} catch (err) {
			setError(err.message || "Failed to remove follower");
		} finally {
			setActionLoading(false);
		}
	};

	if (loading) {
		return (
			<div className="profile-page">
				<div className="loading-container">
					<div className="spinner"></div>
					<p>Loading profile...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="profile-page">
				<div className="error-container">
					<p className="error-message">{error}</p>
					<button onClick={() => navigate(-1)} className="back-btn">
						Go Back
					</button>
				</div>
			</div>
		);
	}

	if (!profile) {
		return (
			<div className="profile-page">
				<div className="error-container">
					<p>Profile not found</p>
					<button onClick={() => navigate(-1)} className="back-btn">
						Go Back
					</button>
				</div>
			</div>
		);
	}

	const isOwnProfile = session?.user_id === userId;
	const canViewPrivateInfo = isOwnProfile || profile.isFriend;

	return (
		<div className="profile-page">
			{/* Header */}
			<div className="profile-header">
				<button onClick={() => navigate(-1)} className="back-button">
					← Back
				</button>
				<h1>User Profile</h1>
			</div>

			{/* Error/Success Messages */}
			{error && <div className="error-message">{error}</div>}
			{success && <div className="success-message">{success}</div>}

			{/* Profile Card */}
			<div className="profile-card">
				{/* Avatar and Basic Info */}
				<div className="profile-basic">
					<div className="avatar-container">
						<img
							src={profile.avatarUrl || "/default-avatar.png"}
							alt={profile.username}
							className="profile-avatar"
						/>
						{profile.isOnline && <span className="online-indicator"></span>}
					</div>
					<div className="profile-info">
						<h2 className="profile-username">{profile.username}</h2>
						<p className="profile-displayname">{profile.displayName}</p>
						{profile.bio && <p className="profile-bio">{profile.bio}</p>}
						<div className="profile-meta">
							<span className="meta-item">
								{profile.isOnline ? (
									<span className="status-online">● Online</span>
								) : (
									<span className="status-offline">
										Last seen {formatLastSeen(profile.lastSeenAt)}
									</span>
								)}
							</span>
							<span className="meta-item">
								Joined {formatDate(profile.createdAt)}
							</span>
						</div>
					</div>
				</div>

				{/* Stats - Always Visible */}
				<div className="profile-stats">
					<div className="stat-item">
						<span className="stat-value">{profile.postsCount}</span>
						<span className="stat-label">Posts</span>
					</div>
					<div
						className="stat-item clickable"
						onClick={() => canViewPrivateInfo && setShowFollowersModal(true)}
						style={{ cursor: canViewPrivateInfo ? "pointer" : "default" }}
					>
						<span className="stat-value">{profile.followersCount}</span>
						<span className="stat-label">Followers</span>
					</div>
					<div
						className="stat-item clickable"
						onClick={() => canViewPrivateInfo && setShowFollowingModal(true)}
						style={{ cursor: canViewPrivateInfo ? "pointer" : "default" }}
					>
						<span className="stat-value">{profile.followingCount}</span>
						<span className="stat-label">Following</span>
					</div>
					<div
						className={`stat-item ${
							(isOwnProfile || profile.isFriend) && profile.friendsCount > 0
								? "clickable"
								: ""
						}`}
						onClick={() => {
							if (
								(isOwnProfile || profile.isFriend) &&
								profile.friendsCount > 0
							) {
								setShowFriendsModal(true);
							}
						}}
					>
						<span className="stat-value">{profile.friendsCount}</span>
						<span className="stat-label">Friends</span>
					</div>
				</div>

				{/* Relationship Status */}
				{!isOwnProfile && (
					<div className="relationship-status">
						{profile.isFriend && (
							<span className="badge badge-friend">🤝 Friends</span>
						)}
						{profile.isFollowing && !profile.isFriend && (
							<span className="badge badge-following">👥 Following</span>
						)}
						{profile.hasPendingRequest && !profile.isFollowing && (
							<span className="badge badge-pending">⏳ Pending</span>
						)}
						{!profile.isFollowing &&
							!profile.isFriend &&
							!profile.hasPendingRequest && (
								<span className="badge badge-none">Not Following</span>
							)}
					</div>
				)}

				{/* Action Buttons */}
				{!isOwnProfile && (
					<div className="profile-actions">
						{/* Primary action button: Follow/Following/Requested */}
						{profile.isFollowing ? (
							<button
								onClick={handleUnfollow}
								disabled={actionLoading}
								className="btn-following"
							>
								{actionLoading ? "Processing..." : "Following"}
							</button>
						) : profile.hasPendingRequest ? (
							<button
								onClick={handleCancelFollowRequest}
								disabled={actionLoading}
								className="btn-pending"
							>
								{actionLoading ? "Processing..." : "Requested"}
							</button>
						) : (
							<button
								onClick={handleSendFollowRequest}
								disabled={actionLoading}
								className="btn-follow"
							>
								{actionLoading ? "Processing..." : "Follow"}
							</button>
						)}

						{/* Remove Follower button - shown when this user is following you */}
						{profile.isFollowedBy && (
							<button
								onClick={handleRemoveFollower}
								disabled={actionLoading}
								className="btn-remove-follower"
								title="Remove this follower"
							>
								{actionLoading ? "Processing..." : "Remove Follower"}
							</button>
						)}
					</div>
				)}
			</div>

			{/* Private Content - Only for Friends or Owner */}
			{canViewPrivateInfo ? (
				<div className="profile-content">
					{/* Tabs */}
					<div className="tabs">
						<button
							className={activeTab === "posts" ? "tab active" : "tab"}
							onClick={() => setActiveTab("posts")}
						>
							Posts ({profile.posts?.length || 0})
						</button>
						<button
							className={activeTab === "followers" ? "tab active" : "tab"}
							onClick={() => setActiveTab("followers")}
						>
							Followers ({profile.followers?.length || 0})
						</button>
						<button
							className={activeTab === "following" ? "tab active" : "tab"}
							onClick={() => setActiveTab("following")}
						>
							Following ({profile.following?.length || 0})
						</button>
					</div>

					{/* Tab Content */}
					<div className="tab-content">
						{activeTab === "posts" && (
							<div className="posts-list">
								{profile.posts && profile.posts.length > 0 ? (
									profile.posts.map((post) => (
										<div key={post.postId} className="post-card">
											<div className="post-header">
												<img
													src={post.avatarUrl || "/default-avatar.png"}
													alt={post.username}
													className="post-avatar"
												/>
												<div className="post-info">
													<span className="post-username">{post.username}</span>
													<span className="post-time">
														{formatDate(post.createdAt)}
													</span>
												</div>
												<span
													className={`post-visibility visibility-${post.visibility}`}
												>
													{post.visibility === "public" && "🌍 Public"}
													{post.visibility === "friends" && "👥 Friends"}
													{post.visibility === "private" && "🔒 Private"}
												</span>
											</div>
											<div className="post-content">{post.content}</div>
											<div className="post-stats">
												<span>❤️ {post.likesCount}</span>
												<span>💬 {post.commentsCount}</span>
												<span>🔄 {post.sharesCount}</span>
											</div>
										</div>
									))
								) : (
									<div className="empty-state">
										<p>No posts yet</p>
									</div>
								)}
							</div>
						)}

						{activeTab === "followers" && (
							<div className="users-list">
								{profile.followers && profile.followers.length > 0 ? (
									profile.followers.map((user) => (
										<div
											key={user.userId}
											className="user-card"
											onClick={() => navigate(`/profile/${user.userId}`)}
										>
											<img
												src={user.avatarUrl || "/default-avatar.png"}
												alt={user.username}
												className="user-avatar"
											/>
											<div className="user-info">
												<span className="user-username">{user.username}</span>
												<span className="user-displayname">
													{user.displayName}
												</span>
											</div>
											{user.isFriend && (
												<span className="badge badge-friend-small">
													Friends
												</span>
											)}
										</div>
									))
								) : (
									<div className="empty-state">
										<p>No followers yet</p>
									</div>
								)}
							</div>
						)}

						{activeTab === "following" && (
							<div className="users-list">
								{profile.following && profile.following.length > 0 ? (
									profile.following.map((user) => (
										<div
											key={user.userId}
											className="user-card"
											onClick={() => navigate(`/profile/${user.userId}`)}
										>
											<img
												src={user.avatarUrl || "/default-avatar.png"}
												alt={user.username}
												className="user-avatar"
											/>
											<div className="user-info">
												<span className="user-username">{user.username}</span>
												<span className="user-displayname">
													{user.displayName}
												</span>
											</div>
											{user.isFriend && (
												<span className="badge badge-friend-small">
													Friends
												</span>
											)}
										</div>
									))
								) : (
									<div className="empty-state">
										<p>Not following anyone yet</p>
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			) : (
				<div className="private-content-locked">
					<div className="lock-icon">🔒</div>
					<h3>Private Content</h3>
					<p>
						Only friends can see {profile.username}'s posts and connections.
					</p>
					<p className="hint">Send a follow request to connect!</p>
				</div>
			)}

			{/* Followers Modal */}
			<FollowersModal
				isOpen={showFollowersModal}
				onClose={() => setShowFollowersModal(false)}
				users={profile?.followers || []}
				title="Followers"
				currentUserId={session?.user_id}
			/>

			{/* Following Modal */}
			<FollowersModal
				isOpen={showFollowingModal}
				onClose={() => setShowFollowingModal(false)}
				users={profile?.following || []}
				title="Following"
				currentUserId={session?.user_id}
			/>

			{/* Friends Modal */}
			<FollowersModal
				isOpen={showFriendsModal}
				onClose={() => setShowFriendsModal(false)}
				users={profile?.friends || []}
				title="Friends"
				currentUserId={session?.user_id}
			/>
		</div>
	);
}

export default UserProfilePage;
