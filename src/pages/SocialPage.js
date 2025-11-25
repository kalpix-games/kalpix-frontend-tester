import React, { useState, useEffect } from "react";
import "./SocialPage.css";
import {
	createPost,
	getUserFeed,
	getPublicFeed,
	likePost,
	unlikePost,
	addComment,
	getComments,
} from "../utils/nakamaClient";
import { useNotifications } from "../contexts/NotificationContext";

/**
 * Social Page Component
 * Displays Feed (posts from followed users) and News (official announcements)
 */
function SocialPage({ client, session, socket, isConnected }) {
	const { notifications } = useNotifications();
	const [activeTab, setActiveTab] = useState("feed"); // 'feed' or 'news'
	const [feedType, setFeedType] = useState("discover"); // 'foryou' or 'discover'
	const [posts, setPosts] = useState([]);
	const [news, setNews] = useState([]);
	const [newPostContent, setNewPostContent] = useState("");
	const [postVisibility, setPostVisibility] = useState("public"); // 'public', 'followers', 'friends', 'private'
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	// Comments modal state
	const [commentsModalOpen, setCommentsModalOpen] = useState(false);
	const [selectedPost, setSelectedPost] = useState(null);
	const [comments, setComments] = useState([]);
	const [newComment, setNewComment] = useState("");
	const [replyingTo, setReplyingTo] = useState(null); // { commentId, username }
	const [loadingComments, setLoadingComments] = useState(false);

	// Load posts and news on mount
	useEffect(() => {
		loadFeed();
		loadNews();
	}, []);

	// Reload feed when feed type changes
	useEffect(() => {
		if (activeTab === "feed") {
			loadFeed();
		}
	}, [feedType]);

	// Listen for real-time post notifications from NotificationContext
	useEffect(() => {
		// Get the latest notification
		const latestNotification = notifications[0];

		if (!latestNotification) return;

		// Check if it's a new post notification (code 30)
		if (latestNotification.code === 30) {
			const content = latestNotification.content;
			console.log("New post notification:", content);

			// Only update feed if we're on the feed tab
			if (activeTab === "feed") {
				// For "For You" tab, only show if it's from someone we follow
				// For "Discover" tab, show all public posts
				if (feedType === "discover" && content.visibility === "public") {
					// Reload feed to show new post
					loadFeed();
				} else if (feedType === "foryou") {
					// Reload feed to show new post from followed users
					loadFeed();
				}
			}
		}
	}, [notifications, activeTab, feedType]);

	// Load feed posts based on feed type
	const loadFeed = async () => {
		setLoading(true);
		setError("");
		try {
			let data;
			if (feedType === "discover") {
				// Discover: All public posts from all users
				data = await getPublicFeed(client, session, 50);
			} else {
				// For You: Posts from users you follow
				data = await getUserFeed(client, session, 50);
			}
			setPosts(data.posts || []);
		} catch (err) {
			console.error("Failed to load feed:", err);
			setError(err.message || "Failed to load feed");
		} finally {
			setLoading(false);
		}
	};

	// Load news posts (official announcements)
	const loadNews = async () => {
		try {
			// TODO: Implement RPC call to fetch news
			// For now, using placeholder data
			setNews([
				{
					id: "news1",
					title: "🎉 Welcome to Plazy!",
					content:
						"Start playing UNO and connect with friends. More games coming soon!",
					timestamp: Date.now() - 86400000,
					type: "announcement",
					likes: 150,
				},
				{
					id: "news2",
					title: "🏆 Weekend Tournament",
					content: "Join our UNO tournament this weekend! Win amazing prizes!",
					timestamp: Date.now() - 172800000,
					type: "tournament",
					likes: 89,
				},
				{
					id: "news3",
					title: "💰 Special Offer",
					content: "Get 50% off on premium features this week only!",
					timestamp: Date.now() - 259200000,
					type: "sale",
					likes: 234,
				},
			]);
		} catch (error) {
			console.error("Failed to load news:", error);
		}
	};

	// Create new post
	const handleCreatePost = async () => {
		if (!newPostContent.trim()) {
			setError("Post content cannot be empty");
			return;
		}

		setLoading(true);
		setError("");
		setSuccess("");
		try {
			const newPost = await createPost(
				client,
				session,
				newPostContent,
				postVisibility
			);
			setPosts([newPost, ...posts]);
			setNewPostContent("");
			setPostVisibility("public");
			setSuccess("Post created successfully!");
			setTimeout(() => setSuccess(""), 3000);
		} catch (err) {
			console.error("Failed to create post:", err);
			setError(err.message || "Failed to create post");
		} finally {
			setLoading(false);
		}
	};

	// Like/Unlike post
	const handleLikePost = async (postId) => {
		const post = posts.find((p) => p.postId === postId || p.id === postId);
		if (!post) return;

		const isLiked = post.isLiked || post.liked;
		const currentLikesCount = post.likesCount || post.likes || 0;

		// Optimistic update - Update UI immediately
		setPosts((prevPosts) =>
			prevPosts.map((p) => {
				if ((p.postId || p.id) === postId) {
					return {
						...p,
						isLiked: !isLiked,
						liked: !isLiked,
						likesCount: isLiked ? currentLikesCount - 1 : currentLikesCount + 1,
						likes: isLiked ? currentLikesCount - 1 : currentLikesCount + 1,
					};
				}
				return p;
			})
		);

		try {
			if (isLiked) {
				await unlikePost(client, session, postId);
			} else {
				await likePost(client, session, postId);
			}
		} catch (err) {
			console.error("Failed to like/unlike post:", err);
			// Revert optimistic update on error
			setPosts((prevPosts) =>
				prevPosts.map((p) => {
					if ((p.postId || p.id) === postId) {
						return {
							...p,
							isLiked: isLiked,
							liked: isLiked,
							likesCount: currentLikesCount,
							likes: currentLikesCount,
						};
					}
					return p;
				})
			);
			setError(err.message || "Failed to update like");
		}
	};

	// Open comments modal
	const handleOpenComments = async (post) => {
		setSelectedPost(post);
		setCommentsModalOpen(true);
		setReplyingTo(null);
		setNewComment("");
		await loadComments(post.postId || post.id);
	};

	// Close comments modal
	const handleCloseComments = () => {
		setCommentsModalOpen(false);
		setSelectedPost(null);
		setComments([]);
		setReplyingTo(null);
		setNewComment("");
	};

	// Load comments for a post
	const loadComments = async (postId) => {
		setLoadingComments(true);
		try {
			const data = await getComments(client, session, postId, 50);
			setComments(data.comments || []);
		} catch (err) {
			console.error("Failed to load comments:", err);
			setError(err.message || "Failed to load comments");
		} finally {
			setLoadingComments(false);
		}
	};

	// Add comment or reply
	const handleAddComment = async () => {
		if (!newComment.trim() || !selectedPost) return;

		try {
			const postId = selectedPost.postId || selectedPost.id;
			const parentCommentId = replyingTo ? replyingTo.commentId : null;

			await addComment(
				client,
				session,
				postId,
				newComment.trim(),
				parentCommentId
			);

			// Reload comments
			await loadComments(postId);

			// Update post's comment count in the feed
			setPosts(
				posts.map((p) => {
					if ((p.postId || p.id) === postId) {
						return {
							...p,
							commentsCount: (p.commentsCount || 0) + (parentCommentId ? 0 : 1),
							comments: (p.comments || 0) + (parentCommentId ? 0 : 1),
						};
					}
					return p;
				})
			);

			// Clear input and reply state
			setNewComment("");
			setReplyingTo(null);
		} catch (err) {
			console.error("Failed to add comment:", err);
			setError(err.message || "Failed to add comment");
		}
	};

	// Start replying to a comment
	const handleReplyToComment = (comment) => {
		setReplyingTo({
			commentId: comment.commentId,
			username: comment.username,
		});
		setNewComment(`@${comment.username} `);
	};

	// Cancel reply
	const handleCancelReply = () => {
		setReplyingTo(null);
		setNewComment("");
	};

	// Share post
	const handleSharePost = async (postId) => {
		setPosts(
			posts.map((post) => {
				if (post.id === postId) {
					return { ...post, shares: post.shares + 1 };
				}
				return post;
			})
		);
		// TODO: Implement RPC call to share post
		alert("Post shared!");
	};

	// Format timestamp (backend sends Unix timestamp in seconds)
	const formatTimestamp = (timestamp) => {
		// Convert seconds to milliseconds
		const timestampMs = timestamp * 1000;
		const now = Date.now();
		const diff = now - timestampMs;

		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);
		const weeks = Math.floor(diff / (86400000 * 7));
		const months = Math.floor(diff / (86400000 * 30));
		const years = Math.floor(diff / (86400000 * 365));

		if (seconds < 10) return "Just now";
		if (seconds < 60) return `${seconds}s ago`;
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		if (days < 7) return `${days}d ago`;
		if (weeks < 4) return `${weeks}w ago`;
		if (months < 12) return `${months}mo ago`;
		return `${years}y ago`;
	};

	return (
		<div className="social-page">
			<div className="social-container">
				{/* Header */}
				<div className="social-header">
					<h1>📱 Social</h1>
					<p>Connect with friends and stay updated</p>
				</div>

				{/* Tab Navigation */}
				<div className="social-tabs">
					<button
						className={`tab-btn ${activeTab === "feed" ? "active" : ""}`}
						onClick={() => setActiveTab("feed")}
					>
						<span className="tab-icon">📰</span>
						<span className="tab-text">Feed</span>
					</button>
					<button
						className={`tab-btn ${activeTab === "news" ? "active" : ""}`}
						onClick={() => setActiveTab("news")}
					>
						<span className="tab-icon">📢</span>
						<span className="tab-text">News</span>
					</button>
				</div>

				{/* Messages */}
				{error && <div className="message error-message">{error}</div>}
				{success && <div className="message success-message">{success}</div>}

				{/* Feed Tab */}
				{activeTab === "feed" && (
					<div className="feed-section">
						{/* Feed Type Sub-Tabs with Refresh Button */}
						<div className="feed-type-header">
							<div className="feed-type-tabs">
								<button
									className={`feed-type-btn ${
										feedType === "foryou" ? "active" : ""
									}`}
									onClick={() => setFeedType("foryou")}
								>
									<span className="feed-type-icon">✨</span>
									<span className="feed-type-text">For You</span>
								</button>
								<button
									className={`feed-type-btn ${
										feedType === "discover" ? "active" : ""
									}`}
									onClick={() => setFeedType("discover")}
								>
									<span className="feed-type-icon">🌍</span>
									<span className="feed-type-text">Discover</span>
								</button>
							</div>
							<button
								className="refresh-btn"
								onClick={loadFeed}
								disabled={loading}
								title="Refresh feed"
							>
								🔄
							</button>
						</div>

						{/* Create Post */}
						<div className="create-post-card">
							<h3>✍️ Create Post</h3>
							<textarea
								className="post-input"
								placeholder="What's on your mind?"
								value={newPostContent}
								onChange={(e) => setNewPostContent(e.target.value)}
								rows={4}
							/>
							<div className="post-controls">
								<div className="visibility-selector">
									<label htmlFor="visibility">
										<span className="visibility-icon">
											{postVisibility === "public" && "🌍"}
											{postVisibility === "followers" && "👤"}
											{postVisibility === "friends" && "👥"}
											{postVisibility === "private" && "🔒"}
										</span>
										<span className="visibility-label">Visibility:</span>
									</label>
									<select
										id="visibility"
										className="visibility-dropdown"
										value={postVisibility}
										onChange={(e) => setPostVisibility(e.target.value)}
									>
										<option value="public">🌍 Public (Everyone)</option>
										<option value="followers">👤 Followers Only</option>
										<option value="friends">👥 Friends Only</option>
										<option value="private">🔒 Private (Only Me)</option>
									</select>
								</div>
								<button
									className="post-btn"
									onClick={handleCreatePost}
									disabled={!newPostContent.trim() || loading}
								>
									{loading ? "Posting..." : "Post"}
								</button>
							</div>
						</div>

						{/* Posts List */}
						<div className="posts-list">
							{loading && posts.length === 0 ? (
								<div className="loading-state">
									<div className="spinner"></div>
									<p>Loading posts...</p>
								</div>
							) : posts.length === 0 ? (
								<div className="empty-state">
									<p>No posts yet. Follow users to see their posts here!</p>
								</div>
							) : (
								posts.map((post) => {
									const postId = post.postId || post.id;
									const username = post.username || post.author;
									const displayName = post.displayName || post.author;
									const avatarUrl = post.avatarUrl || post.avatar_url;
									const content = post.content;
									const timestamp = post.createdAt || post.timestamp;
									const likesCount = post.likesCount || post.likes || 0;
									const commentsCount =
										post.commentsCount || post.comments || 0;
									const sharesCount = post.sharesCount || post.shares || 0;
									const isLiked = post.isLiked || post.liked || false;
									const visibility = post.visibility || "public";

									return (
										<div key={postId} className="post-card">
											<div className="post-header">
												<div className="post-author">
													{avatarUrl ? (
														<img
															src={avatarUrl}
															alt={username}
															className="author-avatar-img"
														/>
													) : (
														<span className="author-avatar">👤</span>
													)}
													<div className="author-info">
														<span className="author-name">{displayName}</span>
														<span className="author-username">@{username}</span>
														<span className="post-time">
															{formatTimestamp(timestamp)}
														</span>
													</div>
												</div>
												<span
													className={`post-visibility-badge visibility-${visibility}`}
												>
													{visibility === "public" && "🌍 Public"}
													{visibility === "followers" && "👤 Followers"}
													{visibility === "friends" && "👥 Friends"}
													{visibility === "private" && "🔒 Private"}
												</span>
											</div>

											<div className="post-content">
												<p>{content}</p>
											</div>

											<div className="post-actions">
												<button
													className={`action-btn ${isLiked ? "liked" : ""}`}
													onClick={() => handleLikePost(postId)}
												>
													<span className="action-icon">
														{isLiked ? "❤️" : "🤍"}
													</span>
													<span className="action-text">
														{likesCount} {likesCount === 1 ? "Like" : "Likes"}
													</span>
												</button>
												<button
													className="action-btn"
													onClick={() => handleOpenComments(post)}
												>
													<span className="action-icon">💬</span>
													<span className="action-text">
														{commentsCount}{" "}
														{commentsCount === 1 ? "Comment" : "Comments"}
													</span>
												</button>
												<button
													className="action-btn"
													onClick={() => handleSharePost(postId)}
												>
													<span className="action-icon">🔄</span>
													<span className="action-text">
														{sharesCount}{" "}
														{sharesCount === 1 ? "Share" : "Shares"}
													</span>
												</button>
											</div>
										</div>
									);
								})
							)}
						</div>
					</div>
				)}

				{/* News Tab */}
				{activeTab === "news" && (
					<div className="news-section">
						<div className="news-list">
							{news.length === 0 ? (
								<div className="empty-state">
									<p>No news available at the moment.</p>
								</div>
							) : (
								news.map((item) => (
									<div key={item.id} className={`news-card ${item.type}`}>
										<div className="news-header">
											<h3>{item.title}</h3>
											<span className="news-time">
												{formatTimestamp(item.timestamp)}
											</span>
										</div>
										<div className="news-content">
											<p>{item.content}</p>
										</div>
										<div className="news-footer">
											<button className="news-like-btn">
												<span className="action-icon">❤️</span>
												<span className="action-text">{item.likes} Likes</span>
											</button>
											<span className="news-type-badge">{item.type}</span>
										</div>
									</div>
								))
							)}
						</div>
					</div>
				)}
			</div>

			{/* Comments Modal */}
			{commentsModalOpen && selectedPost && (
				<div className="modal-overlay" onClick={handleCloseComments}>
					<div className="comments-modal" onClick={(e) => e.stopPropagation()}>
						{/* Modal Header */}
						<div className="comments-modal-header">
							<h3>Comments</h3>
							<button className="close-modal-btn" onClick={handleCloseComments}>
								✕
							</button>
						</div>

						{/* Post Preview */}
						<div className="comments-post-preview">
							<div className="post-author">
								{selectedPost.avatarUrl ? (
									<img
										src={selectedPost.avatarUrl}
										alt={selectedPost.username}
										className="author-avatar-img"
									/>
								) : (
									<span className="author-avatar">👤</span>
								)}
								<div className="author-info">
									<span className="author-name">
										{selectedPost.displayName || selectedPost.username}
									</span>
									<span className="author-username">
										@{selectedPost.username}
									</span>
								</div>
							</div>
							<p className="post-preview-content">{selectedPost.content}</p>
						</div>

						{/* Comments List */}
						<div className="comments-list">
							{loadingComments ? (
								<div className="loading-state">
									<div className="spinner"></div>
									<p>Loading comments...</p>
								</div>
							) : comments.length === 0 ? (
								<div className="empty-state">
									<p>No comments yet. Be the first to comment!</p>
								</div>
							) : (
								comments.map((comment) => (
									<div key={comment.commentId} className="comment-item">
										{/* Top-level comment */}
										<div className="comment-main">
											<div className="comment-avatar">
												{comment.avatarUrl ? (
													<img
														src={comment.avatarUrl}
														alt={comment.username}
														className="avatar-img"
													/>
												) : (
													<span className="avatar-placeholder">👤</span>
												)}
											</div>
											<div className="comment-content-wrapper">
												<div className="comment-header">
													<span className="comment-username">
														{comment.username}
													</span>
													<span className="comment-time">
														{formatTimestamp(comment.createdAt)}
													</span>
												</div>
												<p className="comment-text">{comment.content}</p>
												<div className="comment-actions">
													<button
														className="comment-action-btn"
														onClick={() => handleReplyToComment(comment)}
													>
														Reply
													</button>
													{comment.likesCount > 0 && (
														<span className="comment-likes">
															{comment.likesCount}{" "}
															{comment.likesCount === 1 ? "like" : "likes"}
														</span>
													)}
												</div>
											</div>
										</div>

										{/* Replies (1 level deep - Instagram style) */}
										{comment.replies && comment.replies.length > 0 && (
											<div className="comment-replies">
												{comment.replies.map((reply) => (
													<div key={reply.commentId} className="reply-item">
														<div className="comment-avatar">
															{reply.avatarUrl ? (
																<img
																	src={reply.avatarUrl}
																	alt={reply.username}
																	className="avatar-img"
																/>
															) : (
																<span className="avatar-placeholder">👤</span>
															)}
														</div>
														<div className="comment-content-wrapper">
															<div className="comment-header">
																<span className="comment-username">
																	{reply.username}
																</span>
																<span className="comment-time">
																	{formatTimestamp(reply.createdAt)}
																</span>
															</div>
															<p className="comment-text">{reply.content}</p>
															<div className="comment-actions">
																<button
																	className="comment-action-btn"
																	onClick={() => handleReplyToComment(comment)}
																>
																	Reply
																</button>
																{reply.likesCount > 0 && (
																	<span className="comment-likes">
																		{reply.likesCount}{" "}
																		{reply.likesCount === 1 ? "like" : "likes"}
																	</span>
																)}
															</div>
														</div>
													</div>
												))}
											</div>
										)}
									</div>
								))
							)}
						</div>

						{/* Add Comment Input */}
						<div className="add-comment-section">
							{replyingTo && (
								<div className="replying-to-banner">
									<span>Replying to @{replyingTo.username}</span>
									<button
										className="cancel-reply-btn"
										onClick={handleCancelReply}
									>
										✕
									</button>
								</div>
							)}
							<div className="add-comment-input-wrapper">
								<input
									type="text"
									className="add-comment-input"
									placeholder={
										replyingTo
											? `Reply to @${replyingTo.username}...`
											: "Add a comment..."
									}
									value={newComment}
									onChange={(e) => setNewComment(e.target.value)}
									onKeyPress={(e) => {
										if (e.key === "Enter" && !e.shiftKey) {
											e.preventDefault();
											handleAddComment();
										}
									}}
								/>
								<button
									className="send-comment-btn"
									onClick={handleAddComment}
									disabled={!newComment.trim()}
								>
									Send
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

export default SocialPage;
