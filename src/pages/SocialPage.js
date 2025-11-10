import React, { useState, useEffect } from "react";
import "./SocialPage.css";

/**
 * Social Page Component
 * Displays Feed (posts from followed users) and News (official announcements)
 */
function SocialPage({ client, session, socket, isConnected }) {
	const [activeTab, setActiveTab] = useState("feed"); // 'feed' or 'news'
	const [posts, setPosts] = useState([]);
	const [news, setNews] = useState([]);
	const [newPostContent, setNewPostContent] = useState("");
	const [loading, setLoading] = useState(false);

	// Load posts and news on mount
	useEffect(() => {
		loadFeed();
		loadNews();
	}, []);

	// Load feed posts (from followed users)
	const loadFeed = async () => {
		setLoading(true);
		try {
			// TODO: Implement RPC call to fetch feed posts
			// For now, using placeholder data
			setPosts([
				{
					id: "1",
					author: "Player123",
					authorId: "user1",
					content: "Just won my first UNO game! 🎉",
					timestamp: Date.now() - 3600000,
					likes: 5,
					comments: 2,
					shares: 1,
					liked: false,
				},
			]);
		} catch (error) {
			console.error("Failed to load feed:", error);
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
					content: "Start playing UNO and connect with friends. More games coming soon!",
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
		if (!newPostContent.trim()) return;

		setLoading(true);
		try {
			// TODO: Implement RPC call to create post
			const newPost = {
				id: `post_${Date.now()}`,
				author: session?.username || "You",
				authorId: session?.user_id,
				content: newPostContent,
				timestamp: Date.now(),
				likes: 0,
				comments: 0,
				shares: 0,
				liked: false,
			};

			setPosts([newPost, ...posts]);
			setNewPostContent("");
		} catch (error) {
			console.error("Failed to create post:", error);
		} finally {
			setLoading(false);
		}
	};

	// Like/Unlike post
	const handleLikePost = async (postId) => {
		setPosts(posts.map(post => {
			if (post.id === postId) {
				return {
					...post,
					liked: !post.liked,
					likes: post.liked ? post.likes - 1 : post.likes + 1,
				};
			}
			return post;
		}));
		// TODO: Implement RPC call to like/unlike post
	};

	// Share post
	const handleSharePost = async (postId) => {
		setPosts(posts.map(post => {
			if (post.id === postId) {
				return { ...post, shares: post.shares + 1 };
			}
			return post;
		}));
		// TODO: Implement RPC call to share post
		alert("Post shared!");
	};

	// Format timestamp
	const formatTimestamp = (timestamp) => {
		const now = Date.now();
		const diff = now - timestamp;
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (minutes < 1) return "Just now";
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		return `${days}d ago`;
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

				{/* Feed Tab */}
				{activeTab === "feed" && (
					<div className="feed-section">
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
							<button
								className="post-btn"
								onClick={handleCreatePost}
								disabled={!newPostContent.trim() || loading}
							>
								{loading ? "Posting..." : "Post"}
							</button>
						</div>

						{/* Posts List */}
						<div className="posts-list">
							{posts.length === 0 ? (
								<div className="empty-state">
									<p>No posts yet. Follow users to see their posts here!</p>
								</div>
							) : (
								posts.map((post) => (
									<div key={post.id} className="post-card">
										<div className="post-header">
											<div className="post-author">
												<span className="author-avatar">👤</span>
												<div className="author-info">
													<span className="author-name">{post.author}</span>
													<span className="post-time">{formatTimestamp(post.timestamp)}</span>
												</div>
											</div>
										</div>

										<div className="post-content">
											<p>{post.content}</p>
										</div>

										<div className="post-actions">
											<button
												className={`action-btn ${post.liked ? "liked" : ""}`}
												onClick={() => handleLikePost(post.id)}
											>
												<span className="action-icon">{post.liked ? "❤️" : "🤍"}</span>
												<span className="action-text">{post.likes} Likes</span>
											</button>
											<button className="action-btn">
												<span className="action-icon">💬</span>
												<span className="action-text">{post.comments} Comments</span>
											</button>
											<button
												className="action-btn"
												onClick={() => handleSharePost(post.id)}
											>
												<span className="action-icon">🔄</span>
												<span className="action-text">{post.shares} Shares</span>
											</button>
										</div>
									</div>
								))
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
											<span className="news-time">{formatTimestamp(item.timestamp)}</span>
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
		</div>
	);
}

export default SocialPage;

