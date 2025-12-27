import React, { useState, useEffect, useCallback, useMemo } from "react";
import "./SocialPage.css";
import {
	createPost,
	getUserFeed,
	getPublicFeed,
	likePost,
	unlikePost,
	addComment,
	getComments,
	postStory,
	uploadStoryMedia,
	getStoryTray,
	viewStory,
	getStoryViewers,
	replyToStory,
} from "../utils/nakamaClient";
import {
	useNotifications,
	subscribeToEvent,
} from "../contexts/NotificationContext";
import { usePagination } from "../hooks/usePagination";
import { InfiniteScrollWindow } from "../components/InfiniteScroll";

/**
 * Social Page Component
 * Displays Feed (posts from followed users) and News (official announcements)
 */
function SocialPage({ client, session, socket, isConnected }) {
	useNotifications(); // Subscribe to notifications context
	const [activeTab, setActiveTab] = useState("feed"); // 'feed' or 'news'
	const [feedType, setFeedType] = useState("discover"); // 'foryou' or 'discover'
	const [news, setNews] = useState([]);
	const [newPostContent, setNewPostContent] = useState("");
	const [postVisibility, setPostVisibility] = useState("public"); // 'public', 'followers', 'friends', 'private'
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [creatingPost, setCreatingPost] = useState(false);

	// Comments modal state
	const [commentsModalOpen, setCommentsModalOpen] = useState(false);
	const [selectedPost, setSelectedPost] = useState(null);
	const [comments, setComments] = useState([]);
	const [newComment, setNewComment] = useState("");
	// Stories state
	const [storyTray, setStoryTray] = useState([]);
	const [storyTrayLoading, setStoryTrayLoading] = useState(false);
	const [storyMediaUrl, setStoryMediaUrl] = useState("");
	const [storyFile, setStoryFile] = useState(null);
	const [storyCaption, setStoryCaption] = useState("");
	const [storyVisibility, setStoryVisibility] = useState("followers");
	const [storyMediaType, setStoryMediaType] = useState("image");
	const [creatingStory, setCreatingStory] = useState(false);

	const [storyViewerOpen, setStoryViewerOpen] = useState(false);
	const [selectedStoryUser, setSelectedStoryUser] = useState(null);
	const [userStories, setUserStories] = useState([]);
	const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
	const [storyReply, setStoryReply] = useState("");
	const [storyViewers, setStoryViewers] = useState([]);
	const [storyViewersLoading, setStoryViewersLoading] = useState(false);

	const [replyingTo, setReplyingTo] = useState(null); // { commentId, username }
	const [loadingComments, setLoadingComments] = useState(false);

	// Create fetch function for pagination based on feed type
	const fetchFeed = useCallback(
		async (cursor, limit) => {
			if (feedType === "discover") {
				return await getPublicFeed(client, session, limit, cursor || "");
			} else {
				return await getUserFeed(client, session, limit, cursor || "");
			}
		},
		[client, session, feedType]
	);

	// Use pagination hook for feed
	const {
		items: posts,
		loading,
		loadingMore,
		hasMore,
		loadMore,
		reset: resetFeed,
		setItems: setPosts,
	} = usePagination(fetchFeed, {
		defaultLimit: 20,
		autoLoad: true,
		onError: (err) => {
			setError(err.message || "Failed to load feed");
		},
	});

	// Reset feed when feed type changes
	useEffect(() => {
		if (activeTab === "feed") {
			resetFeed();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [feedType]);

	// Load news and stories on mount
	useEffect(() => {
		loadNews();
		loadStoryTray();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Subscribe to real-time events
	useEffect(() => {
		// New post notification - reload feed
		const unsubNewPost = subscribeToEvent("new_post", (content) => {
			console.log("📝 Real-time new post:", content);
			if (activeTab === "feed") {
				if (feedType === "discover" && content.visibility === "public") {
					resetFeed();
				} else if (feedType === "foryou") {
					resetFeed();
				}
			}
		});

		// New story notification - reload story tray
		const unsubNewStory = subscribeToEvent("new_story", (content) => {
			console.log("📸 Real-time new story:", content);
			loadStoryTray();
		});

		// Post like notification - update like count in real-time
		const unsubPostLike = subscribeToEvent("post_like", (content) => {
			console.log("❤️ Real-time post like:", content);
			setPosts((prevPosts) =>
				prevPosts.map((post) =>
					post.postId === content.postID || post.id === content.postID
						? { ...post, likesCount: (post.likesCount || 0) + 1 }
						: post
				)
			);
		});

		// Post comment notification - update comment count in real-time
		const unsubPostComment = subscribeToEvent("post_comment", (content) => {
			console.log("💬 Real-time post comment:", content);
			setPosts((prevPosts) =>
				prevPosts.map((post) =>
					post.postId === content.postID || post.id === content.postID
						? { ...post, commentsCount: (post.commentsCount || 0) + 1 }
						: post
				)
			);
			// If comments modal is open for this post, reload comments
			if (
				selectedPost &&
				(selectedPost.postId === content.postID ||
					selectedPost.id === content.postID)
			) {
				loadComments(content.postID);
			}
		});

		return () => {
			unsubNewPost();
			unsubNewStory();
			unsubPostLike();
			unsubPostComment();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeTab, feedType, selectedPost]);


	// Load story tray for the current user
	const loadStoryTray = async () => {
		setStoryTrayLoading(true);
		try {
			const data = await getStoryTray(client, session);
			setStoryTray(data.items || []);
		} catch (err) {
			console.error("Failed to load story tray:", err);
			setError(err.message || "Failed to load stories");
		} finally {
			setStoryTrayLoading(false);
		}
	};

	// Helper: convert File object to base64 string (without data: prefix)
	const fileToBase64 = (file) =>
		new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const result = reader.result;
				if (typeof result === "string") {
					const commaIndex = result.indexOf(",");
					resolve(commaIndex >= 0 ? result.substring(commaIndex + 1) : result);
				} else {
					reject(new Error("Failed to read file"));
				}
			};
			reader.onerror = (e) => reject(e);
			reader.readAsDataURL(file);
		});

	const handleStoryFileChange = (event) => {
		const file = event.target.files && event.target.files[0];
		if (!file) {
			setStoryFile(null);
			return;
		}
		setStoryFile(file);
		// Infer media type from MIME type
		if (file.type && file.type.startsWith("video/")) {
			setStoryMediaType("video");
		} else {
			setStoryMediaType("image");
		}
		// Clear manual URL when a file is selected
		setStoryMediaUrl("");
	};

	// Create new story
	const handleCreateStory = async () => {
		if (!storyFile && !storyMediaUrl.trim()) {
			setError("Please provide a story image or video (file or URL)");
			return;
		}

		setCreatingStory(true);
		setError("");
		setSuccess("");
		try {
			let mediaUrlToUse = storyMediaUrl.trim();
			// If a file is selected, upload it first and use its S3 URL
			if (storyFile) {
				const base64Data = await fileToBase64(storyFile);
				const upload = await uploadStoryMedia(
					client,
					session,
					storyMediaType,
					storyFile.name,
					base64Data
				);
				mediaUrlToUse = upload.fileUrl || upload.url || upload.mediaUrl;
			}

			await postStory(
				client,
				session,
				mediaUrlToUse,
				storyMediaType,
				storyCaption.trim(),
				storyVisibility
			);
			setStoryMediaUrl("");
			setStoryFile(null);
			setStoryCaption("");
			setStoryVisibility("followers");
			setStoryMediaType("image");
			setSuccess("Story posted successfully!");
			setTimeout(() => setSuccess(""), 3000);
			await loadStoryTray();
		} catch (err) {
			console.error("Failed to post story:", err);
			setError(err.message || "Failed to post story");
		} finally {
			setCreatingStory(false);
		}
	};

	const openStoryViewer = async (trayItem) => {
		if (!trayItem || !trayItem.stories || trayItem.stories.length === 0) {
			return;
		}
		setSelectedStoryUser(trayItem);
		setUserStories(trayItem.stories);
		setCurrentStoryIndex(0);
		setStoryReply("");
		setStoryViewers([]);
		setStoryViewerOpen(true);

		const firstStory = trayItem.stories[0];
		try {
			await viewStory(client, session, firstStory.storyId, trayItem.userId);
			await loadStoryTray();
		} catch (err) {
			console.error("Failed to record story view:", err);
		}
	};

	const closeStoryViewer = () => {
		setStoryViewerOpen(false);
		setSelectedStoryUser(null);
		setUserStories([]);
		setCurrentStoryIndex(0);
		setStoryReply("");
		setStoryViewers([]);
	};

	const goToStory = async (nextIndex) => {
		if (!selectedStoryUser || userStories.length === 0) return;
		if (nextIndex < 0 || nextIndex >= userStories.length) {
			closeStoryViewer();
			await loadStoryTray();
			return;
		}
		setCurrentStoryIndex(nextIndex);
		setStoryReply("");
		setStoryViewers([]);
		const story = userStories[nextIndex];
		try {
			await viewStory(client, session, story.storyId, selectedStoryUser.userId);
		} catch (err) {
			console.error("Failed to record story view:", err);
		}
	};

	const goToNextStory = () => {
		void goToStory(currentStoryIndex + 1);
	};

	const goToPrevStory = () => {
		void goToStory(currentStoryIndex - 1);
	};

	const handleReplyToCurrentStory = async () => {
		if (!storyReply.trim() || !selectedStoryUser || userStories.length === 0) {
			return;
		}
		const story = userStories[currentStoryIndex];
		try {
			await replyToStory(
				client,
				session,
				story.storyId,
				selectedStoryUser.userId,
				storyReply.trim()
			);
			setStoryReply("");
			setSuccess("Reply sent!");
			setTimeout(() => setSuccess(""), 2000);
		} catch (err) {
			console.error("Failed to send story reply:", err);
			setError(err.message || "Failed to send story reply");
		}
	};

	const loadCurrentStoryViewers = async () => {
		if (!selectedStoryUser || userStories.length === 0) return;
		const story = userStories[currentStoryIndex];
		setStoryViewersLoading(true);
		try {
			const data = await getStoryViewers(client, session, story.storyId);
			setStoryViewers(data.views || []);
		} catch (err) {
			console.error("Failed to load story viewers:", err);
			setError(err.message || "Failed to load story viewers");
		} finally {
			setStoryViewersLoading(false);
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

		setCreatingPost(true);
		setError("");
		setSuccess("");
		try {
			const newPost = await createPost(
				client,
				session,
				newPostContent,
				postVisibility
			);
			// Add new post to the beginning of the list
			setPosts((prev) => [newPost, ...prev]);
			setNewPostContent("");
			setPostVisibility("public");
			setSuccess("Post created successfully!");
			setTimeout(() => setSuccess(""), 3000);
			// Optionally refresh feed to get updated counts
			resetFeed();
		} catch (err) {
			console.error("Failed to create post:", err);
			setError(err.message || "Failed to create post");
		} finally {
			setCreatingPost(false);
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
	const currentStory =
		userStories.length > 0
			? userStories[
					Math.min(Math.max(currentStoryIndex, 0), userStories.length - 1)
			  ]
			: null;

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
								onClick={resetFeed}
								disabled={loading}
								title="Refresh feed"
							>
								🔄
							</button>
						</div>
						{/* Stories Tray + Create Story */}
						<div style={{ marginTop: "16px", marginBottom: "16px" }}>
							{/* Stories Tray */}
							<div
								style={{
									marginBottom: "12px",
									padding: "12px",
									borderRadius: "12px",
									backgroundColor: "#ffffff",
									boxShadow: "0 1px 3px rgba(15, 23, 42, 0.08)",
								}}
							>
								<div
									style={{
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center",
										marginBottom: "8px",
									}}
								>
									<h3 style={{ margin: 0, fontSize: "16px" }}>Stories</h3>
									<button
										className="refresh-btn"
										onClick={loadStoryTray}
										disabled={storyTrayLoading}
										title="Refresh stories"
									>
										{storyTrayLoading ? "..." : "🔄"}
									</button>
								</div>
								{storyTrayLoading && storyTray.length === 0 ? (
									<div className="loading-state">
										<p>Loading stories...</p>
									</div>
								) : storyTray.length === 0 ? (
									<div className="empty-state">
										<p>No stories yet. Post a story to share moments!</p>
									</div>
								) : (
									<div
										style={{
											display: "flex",
											gap: "12px",
											overflowX: "auto",
											paddingBottom: "4px",
										}}
									>
										{storyTray.map((item) => (
											<div
												key={item.userId}
												onClick={() => openStoryViewer(item)}
												style={{
													cursor: "pointer",
													display: "flex",
													flexDirection: "column",
													alignItems: "center",
													minWidth: "64px",
												}}
											>
												<div
													style={{
														width: "56px",
														height: "56px",
														borderRadius: "50%",
														border: item.hasUnseen
															? "3px solid #ff4f8b"
															: "2px solid #d1d5db",
														display: "flex",
														alignItems: "center",
														justifyContent: "center",
														overflow: "hidden",
														backgroundColor: "#f3f4f6",
													}}
												>
													{item.avatarUrl ? (
														<img
															src={item.avatarUrl}
															alt={item.username}
															style={{
																width: "100%",
																height: "100%",
																objectFit: "cover",
															}}
														/>
													) : (
														<span style={{ fontSize: "24px" }}>👤</span>
													)}
												</div>
												<div
													style={{
														marginTop: "4px",
														fontSize: "11px",
														textAlign: "center",
														maxWidth: "64px",
														whiteSpace: "nowrap",
														overflow: "hidden",
														textOverflow: "ellipsis",
													}}
												>
													{item.userId === session.user_id
														? "Your story"
														: item.username}
												</div>
											</div>
										))}
									</div>
								)}
							</div>

							{/* Create Story */}
							<div className="create-post-card">
								<h3>📸 Create Story</h3>
								<p
									style={{
										marginBottom: "8px",
										fontSize: "12px",
										color: "#6b7280",
									}}
								>
									Upload an image/video from your device or paste a URL.
								</p>
								<input
									type="text"
									className="post-input"
									placeholder="Image or video URL..."
									value={storyMediaUrl}
									onChange={(e) => setStoryMediaUrl(e.target.value)}
								/>
								<input
									type="file"
									accept="image/*,video/*"
									className="post-input"
									onChange={handleStoryFileChange}
									style={{ marginTop: "8px" }}
								/>
								<input
									type="text"
									className="post-input"
									placeholder="Optional caption..."
									value={storyCaption}
									onChange={(e) => setStoryCaption(e.target.value)}
									style={{ marginTop: "8px" }}
								/>
								<div className="post-controls">
									<div className="visibility-selector">
										<label htmlFor="story-visibility">
											<span className="visibility-icon">
												{storyVisibility === "public" && "🌍"}
												{storyVisibility === "followers" && "👤"}
												{storyVisibility === "friends" && "👥"}
												{storyVisibility === "private" && "🔒"}
											</span>
											<span className="visibility-label">Visibility:</span>
										</label>
										<select
											id="story-visibility"
											className="visibility-dropdown"
											value={storyVisibility}
											onChange={(e) => setStoryVisibility(e.target.value)}
										>
											<option value="public">🌍 Public</option>
											<option value="followers">👤 Followers</option>
											<option value="friends">👥 Friends</option>
											<option value="private">🔒 Private</option>
										</select>
									</div>
									<div
										style={{
											display: "flex",
											gap: "8px",
											alignItems: "center",
										}}
									>
										<select
											value={storyMediaType}
											onChange={(e) => setStoryMediaType(e.target.value)}
											className="visibility-dropdown"
										>
											<option value="image">🖼️ Image</option>
											<option value="video">🎬 Video</option>
										</select>
										<button
											className="post-btn"
											onClick={handleCreateStory}
											disabled={
												(!storyMediaUrl.trim() && !storyFile) || creatingStory
											}
										>
											{creatingStory ? "Posting..." : "Post Story"}
										</button>
									</div>
								</div>
								{/* Story Viewer Modal */}
								{storyViewerOpen && selectedStoryUser && currentStory && (
									<div className="modal-overlay" onClick={closeStoryViewer}>
										<div
											className="story-modal"
											onClick={(e) => e.stopPropagation()}
										>
											<div className="comments-modal-header">
												<h3>
													{selectedStoryUser.userId === session.user_id
														? "Your story"
														: selectedStoryUser.username}
												</h3>
												<button
													className="close-modal-btn"
													onClick={closeStoryViewer}
												>
													✕
												</button>
											</div>
											<div className="story-modal-body">
												<div className="story-media-wrapper">
													{currentStory.mediaType === "video" ? (
														<video
															src={currentStory.mediaUrl}
															controls
															className="story-media"
														/>
													) : (
														<img
															src={currentStory.mediaUrl}
															alt={currentStory.caption || "Story"}
															className="story-media"
														/>
													)}
												</div>
												{currentStory.caption && (
													<p className="story-caption">
														{currentStory.caption}
													</p>
												)}
												<div className="story-nav">
													<button
														className="story-nav-btn"
														onClick={goToPrevStory}
														disabled={currentStoryIndex === 0}
													>
														Prev
													</button>
													<div className="story-counter">
														{currentStoryIndex + 1} / {userStories.length}
													</div>
													<button
														className="story-nav-btn"
														onClick={goToNextStory}
														disabled={
															currentStoryIndex === userStories.length - 1
														}
													>
														Next
													</button>
												</div>
												<div className="story-reply-section">
													<input
														type="text"
														className="add-comment-input"
														placeholder="Reply to this story..."
														value={storyReply}
														onChange={(e) => setStoryReply(e.target.value)}
														onKeyPress={(e) => {
															if (e.key === "Enter" && !e.shiftKey) {
																e.preventDefault();
																handleReplyToCurrentStory();
															}
														}}
													/>
													<button
														className="send-comment-btn"
														onClick={handleReplyToCurrentStory}
														disabled={!storyReply.trim()}
													>
														Send
													</button>
												</div>
												{selectedStoryUser.userId === session.user_id && (
													<div className="story-viewers-section">
														<button
															className="refresh-btn"
															onClick={loadCurrentStoryViewers}
														>
															View viewers ({storyViewers.length})
														</button>
														{storyViewersLoading ? (
															<p>Loading viewers...</p>
														) : storyViewers.length > 0 ? (
															<ul className="story-viewers-list">
																{storyViewers.map((viewer) => (
																	<li key={viewer.userId}>{viewer.username}</li>
																))}
															</ul>
														) : (
															<p>No viewers yet.</p>
														)}
													</div>
												)}
											</div>
										</div>
									</div>
								)}
							</div>
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
						<InfiniteScrollWindow
							onLoadMore={loadMore}
							hasMore={hasMore}
							loading={loadingMore}
							loadingComponent={
								<div className="loading-state">
									<div className="spinner"></div>
									<p>Loading more posts...</p>
								</div>
							}
							endMessage={
								<div className="empty-state">
									<p>No more posts to load</p>
								</div>
							}
						>
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
						</InfiniteScrollWindow>
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
