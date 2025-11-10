import React, { useState, useEffect } from "react";
import {
	createPost,
	getUserFeed,
	likePost,
	unlikePost,
	addComment,
	getComments,
	sendFollowRequest,
	acceptFollowRequest,
	getFollowRequests,
	searchUsers,
} from "../utils/nakamaClient";

/**
 * Social Section Component
 * Handles social feed, posts, likes, comments, and follows
 */
function SocialSection({ client, session, onEvent }) {
	const [activeTab, setActiveTab] = useState("feed"); // feed, create, search, follows

	// Feed state
	const [feed, setFeed] = useState([]);
	const [feedLoading, setFeedLoading] = useState(false);

	// Create post state
	const [postContent, setPostContent] = useState("");
	const [postMediaURL, setPostMediaURL] = useState("");

	// Search state
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState([]);

	// Follow requests state
	const [followRequests, setFollowRequests] = useState([]);
	const [unreadRequestsCount, setUnreadRequestsCount] = useState(0);

	// Comments state
	const [selectedPostId, setSelectedPostId] = useState(null);
	const [comments, setComments] = useState({});
	const [commentInput, setCommentInput] = useState("");

	// Load feed on mount
	useEffect(() => {
		if (session && activeTab === "feed") {
			loadFeed();
		}
	}, [session, activeTab]);

	// Load follow requests when component mounts and periodically
	useEffect(() => {
		if (session) {
			// Load immediately
			loadFollowRequests();

			// Auto-refresh every 10 seconds to check for new requests
			const interval = setInterval(() => {
				loadFollowRequests(true); // Silent refresh (no event log)
			}, 10000);

			return () => clearInterval(interval);
		}
	}, [session]);

	const loadFeed = async () => {
		try {
			setFeedLoading(true);
			const result = await getUserFeed(client, session, 20);
			setFeed(result.posts || []);
			onEvent(
				"feed_loaded",
				`Loaded ${result.posts?.length || 0} posts`,
				"success"
			);
		} catch (error) {
			onEvent("feed_error", `Failed to load feed: ${error.message}`, "error");
		} finally {
			setFeedLoading(false);
		}
	};

	const handleCreatePost = async () => {
		if (!postContent.trim()) {
			onEvent("validation_error", "Post content is required", "error");
			return;
		}

		try {
			const result = await createPost(
				client,
				session,
				postContent,
				postMediaURL
			);
			onEvent("post_created", "Post created successfully", "success");
			setPostContent("");
			setPostMediaURL("");
			setActiveTab("feed");
			loadFeed();
		} catch (error) {
			onEvent("post_error", `Failed to create post: ${error.message}`, "error");
		}
	};

	const handleLikePost = async (postId, isLiked) => {
		try {
			if (isLiked) {
				await unlikePost(client, session, postId);
				onEvent("post_unliked", "Post unliked", "info");
			} else {
				await likePost(client, session, postId);
				onEvent("post_liked", "Post liked", "success");
			}
			loadFeed();
		} catch (error) {
			onEvent(
				"like_error",
				`Failed to like/unlike post: ${error.message}`,
				"error"
			);
		}
	};

	const handleLoadComments = async (postId) => {
		if (selectedPostId === postId) {
			setSelectedPostId(null);
			return;
		}

		try {
			const result = await getComments(client, session, postId, 20);
			setComments({ ...comments, [postId]: result.comments || [] });
			setSelectedPostId(postId);
			onEvent(
				"comments_loaded",
				`Loaded ${result.comments?.length || 0} comments`,
				"info"
			);
		} catch (error) {
			onEvent(
				"comments_error",
				`Failed to load comments: ${error.message}`,
				"error"
			);
		}
	};

	const handleAddComment = async (postId) => {
		if (!commentInput.trim()) return;

		try {
			await addComment(client, session, postId, commentInput);
			setCommentInput("");
			onEvent("comment_added", "Comment added", "success");
			handleLoadComments(postId);
			loadFeed();
		} catch (error) {
			onEvent(
				"comment_error",
				`Failed to add comment: ${error.message}`,
				"error"
			);
		}
	};

	const handleSearch = async () => {
		if (!searchQuery.trim()) return;

		try {
			const result = await searchUsers(client, session, searchQuery, 20);
			// Remove duplicates based on userId
			const uniqueUsers = [];
			const seenIds = new Set();

			(result.users || []).forEach((user) => {
				const userId = user.userId || user.user_id;
				if (!seenIds.has(userId)) {
					seenIds.add(userId);
					uniqueUsers.push(user);
				}
			});

			setSearchResults(uniqueUsers);
			onEvent("search_complete", `Found ${uniqueUsers.length} users`, "info");
		} catch (error) {
			onEvent("search_error", `Search failed: ${error.message}`, "error");
		}
	};

	const handleSendFollowRequest = async (userId) => {
		if (!userId) {
			onEvent("follow_error", "User ID is missing", "error");
			return;
		}

		try {
			console.log("Sending follow request to user:", userId);
			await sendFollowRequest(client, session, userId);
			onEvent(
				"follow_request_sent",
				`Follow request sent to user ${userId}`,
				"success"
			);
		} catch (error) {
			console.error("Follow request error:", error);
			onEvent(
				"follow_error",
				`Failed to send follow request: ${error.message}`,
				"error"
			);
		}
	};

	const loadFollowRequests = async (silent = false) => {
		try {
			const result = await getFollowRequests(client, session);
			const requests = result.requests || [];
			const receivedRequests = requests.filter(
				(req) =>
					req.toUserId === session.user_id || req.to_user_id === session.user_id
			);

			setFollowRequests(receivedRequests);
			setUnreadRequestsCount(receivedRequests.length);

			if (!silent) {
				onEvent(
					"follow_requests_loaded",
					`Loaded ${receivedRequests.length} requests`,
					"info"
				);
			}

			// Show notification if there are new requests
			if (receivedRequests.length > 0 && !silent) {
				onEvent(
					"new_follow_requests",
					`You have ${receivedRequests.length} pending follow request(s)`,
					"warning"
				);
			}
		} catch (error) {
			if (!silent) {
				onEvent(
					"follow_requests_error",
					`Failed to load requests: ${error.message}`,
					"error"
				);
			}
		}
	};

	const handleAcceptFollowRequest = async (fromUserId) => {
		try {
			await acceptFollowRequest(client, session, fromUserId);
			onEvent("follow_accepted", "Follow request accepted", "success");
			loadFollowRequests();
		} catch (error) {
			onEvent(
				"follow_accept_error",
				`Failed to accept request: ${error.message}`,
				"error"
			);
		}
	};

	if (!session) {
		return (
			<div className="section">
				<h2>📱 Social</h2>
				<p style={{ color: "#888" }}>Please authenticate first</p>
			</div>
		);
	}

	return (
		<div className="section">
			<h2>📱 Social</h2>

			{/* Tabs */}
			<div style={{ display: "flex", gap: "5px", marginBottom: "15px" }}>
				<button
					onClick={() => setActiveTab("feed")}
					style={{
						flex: 1,
						padding: "8px",
						backgroundColor: activeTab === "feed" ? "#007bff" : "#6c757d",
						color: "white",
						border: "none",
						borderRadius: "4px",
						cursor: "pointer",
					}}
				>
					Feed
				</button>
				<button
					onClick={() => setActiveTab("create")}
					style={{
						flex: 1,
						padding: "8px",
						backgroundColor: activeTab === "create" ? "#007bff" : "#6c757d",
						color: "white",
						border: "none",
						borderRadius: "4px",
						cursor: "pointer",
					}}
				>
					Create
				</button>
				<button
					onClick={() => setActiveTab("search")}
					style={{
						flex: 1,
						padding: "8px",
						backgroundColor: activeTab === "search" ? "#007bff" : "#6c757d",
						color: "white",
						border: "none",
						borderRadius: "4px",
						cursor: "pointer",
					}}
				>
					Search
				</button>
				<button
					onClick={() => setActiveTab("follows")}
					style={{
						flex: 1,
						padding: "8px",
						backgroundColor: activeTab === "follows" ? "#007bff" : "#6c757d",
						color: "white",
						border: "none",
						borderRadius: "4px",
						cursor: "pointer",
						position: "relative",
					}}
				>
					Follows
					{unreadRequestsCount > 0 && (
						<span
							style={{
								position: "absolute",
								top: "-5px",
								right: "-5px",
								backgroundColor: "#dc3545",
								color: "white",
								borderRadius: "50%",
								width: "20px",
								height: "20px",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								fontSize: "11px",
								fontWeight: "bold",
							}}
						>
							{unreadRequestsCount}
						</span>
					)}
				</button>
			</div>

			{/* Feed Tab */}
			{activeTab === "feed" && (
				<div>
					<button
						onClick={loadFeed}
						disabled={feedLoading}
						style={{ marginBottom: "10px", width: "100%" }}
					>
						{feedLoading ? "Loading..." : "🔄 Refresh Feed"}
					</button>

					<div style={{ maxHeight: "400px", overflowY: "auto" }}>
						{feed.length === 0 ? (
							<p style={{ color: "#888", textAlign: "center" }}>No posts yet</p>
						) : (
							feed.map((post) => (
								<div
									key={post.post_id}
									style={{
										padding: "12px",
										marginBottom: "10px",
										backgroundColor: "#f8f9fa",
										borderRadius: "6px",
										border: "1px solid #dee2e6",
									}}
								>
									<div style={{ fontWeight: "bold", marginBottom: "5px" }}>
										{post.author_username || "Unknown"}
									</div>
									<div style={{ marginBottom: "8px" }}>{post.content}</div>
									{post.media_url && (
										<div
											style={{
												marginBottom: "8px",
												fontSize: "12px",
												color: "#666",
											}}
										>
											📎 {post.media_url}
										</div>
									)}
									<div
										style={{
											display: "flex",
											gap: "10px",
											fontSize: "12px",
											color: "#666",
										}}
									>
										<button
											onClick={() =>
												handleLikePost(post.post_id, post.is_liked)
											}
											style={{ fontSize: "12px", padding: "4px 8px" }}
										>
											{post.is_liked ? "❤️" : "🤍"} {post.likes_count || 0}
										</button>
										<button
											onClick={() => handleLoadComments(post.post_id)}
											style={{ fontSize: "12px", padding: "4px 8px" }}
										>
											💬 {post.comments_count || 0}
										</button>
									</div>

									{/* Comments */}
									{selectedPostId === post.post_id && (
										<div
											style={{
												marginTop: "10px",
												paddingTop: "10px",
												borderTop: "1px solid #dee2e6",
											}}
										>
											{comments[post.post_id]?.map((comment) => (
												<div
													key={comment.comment_id}
													style={{
														padding: "6px",
														marginBottom: "5px",
														backgroundColor: "white",
														borderRadius: "4px",
														fontSize: "12px",
													}}
												>
													<strong>{comment.author_username}:</strong>{" "}
													{comment.content}
												</div>
											))}
											<div
												style={{
													display: "flex",
													gap: "5px",
													marginTop: "8px",
												}}
											>
												<input
													type="text"
													value={commentInput}
													onChange={(e) => setCommentInput(e.target.value)}
													placeholder="Add a comment..."
													style={{ flex: 1, padding: "6px", fontSize: "12px" }}
													onKeyPress={(e) =>
														e.key === "Enter" && handleAddComment(post.post_id)
													}
												/>
												<button
													onClick={() => handleAddComment(post.post_id)}
													style={{ fontSize: "12px" }}
												>
													Send
												</button>
											</div>
										</div>
									)}
								</div>
							))
						)}
					</div>
				</div>
			)}

			{/* Create Post Tab */}
			{activeTab === "create" && (
				<div>
					<div className="form-group">
						<label>Post Content:</label>
						<textarea
							value={postContent}
							onChange={(e) => setPostContent(e.target.value)}
							placeholder="What's on your mind?"
							rows="4"
							style={{ width: "100%", padding: "8px", resize: "vertical" }}
						/>
					</div>
					<div className="form-group">
						<label>Media URL (optional):</label>
						<input
							type="text"
							value={postMediaURL}
							onChange={(e) => setPostMediaURL(e.target.value)}
							placeholder="https://example.com/image.jpg"
						/>
					</div>
					<button onClick={handleCreatePost} style={{ width: "100%" }}>
						📝 Create Post
					</button>
				</div>
			)}

			{/* Search Tab */}
			{activeTab === "search" && (
				<div>
					<div style={{ display: "flex", gap: "5px", marginBottom: "15px" }}>
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search users..."
							style={{ flex: 1 }}
							onKeyPress={(e) => e.key === "Enter" && handleSearch()}
						/>
						<button onClick={handleSearch}>🔍 Search</button>
					</div>

					<div style={{ maxHeight: "400px", overflowY: "auto" }}>
						{searchResults.map((user) => {
							const userId = user.userId || user.user_id;
							const username = user.username;
							const displayName = user.displayName || user.display_name;

							return (
								<div
									key={userId}
									style={{
										padding: "10px",
										marginBottom: "8px",
										backgroundColor: "#f8f9fa",
										borderRadius: "6px",
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center",
									}}
								>
									<div>
										<div style={{ fontWeight: "bold" }}>{username}</div>
										<div style={{ fontSize: "12px", color: "#666" }}>
											{displayName}
										</div>
										<div style={{ fontSize: "10px", color: "#999" }}>
											ID: {userId}
										</div>
									</div>
									<button
										onClick={() => handleSendFollowRequest(userId)}
										style={{ fontSize: "12px" }}
									>
										➕ Follow
									</button>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* Follows Tab */}
			{activeTab === "follows" && (
				<div>
					<div
						style={{
							backgroundColor: "#e7f3ff",
							padding: "10px",
							borderRadius: "6px",
							marginBottom: "10px",
							fontSize: "13px",
						}}
					>
						<strong>ℹ️ How it works:</strong>
						<ul style={{ marginTop: "5px", marginLeft: "20px" }}>
							<li>Search for users and send follow requests</li>
							<li>When someone sends you a request, it appears here</li>
							<li>Accept requests to become friends</li>
							<li>Friends can see each other's posts and chat</li>
							<li>Auto-refreshes every 10 seconds</li>
						</ul>
					</div>

					<button
						onClick={() => loadFollowRequests(false)}
						style={{ marginBottom: "10px", width: "100%" }}
					>
						🔄 Refresh Requests
					</button>

					<div style={{ maxHeight: "400px", overflowY: "auto" }}>
						{followRequests.length === 0 ? (
							<div style={{ textAlign: "center", padding: "20px" }}>
								<p style={{ color: "#888", marginBottom: "10px" }}>
									No pending follow requests
								</p>
								<p style={{ fontSize: "12px", color: "#999" }}>
									When someone sends you a follow request, it will appear here
								</p>
							</div>
						) : (
							followRequests.map((request) => (
								<div
									key={request.request_id}
									style={{
										padding: "10px",
										marginBottom: "8px",
										backgroundColor: "#f8f9fa",
										borderRadius: "6px",
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center",
									}}
								>
									<div>
										<div style={{ fontWeight: "bold" }}>
											{request.from_username}
										</div>
										<div style={{ fontSize: "12px", color: "#666" }}>
											{request.from_display_name}
										</div>
									</div>
									<button
										onClick={() =>
											handleAcceptFollowRequest(request.from_user_id)
										}
										style={{ fontSize: "12px" }}
									>
										✅ Accept
									</button>
								</div>
							))
						)}
					</div>
				</div>
			)}
		</div>
	);
}

export default SocialSection;
