import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
	createChannel,
	sendChatMessage,
	getUserProfile,
	getUsersOnlineStatus,
} from "../utils/nakamaClient";
import "./ChatConversationPage.css";

/**
 * New Conversation Page - Start a new DM conversation
 * Channel is only created when first message is sent
 */
function NewConversationPage({ client, session, socket }) {
	const { userId } = useParams();
	const navigate = useNavigate();

	const [otherUser, setOtherUser] = useState(null);
	const [messageInput, setMessageInput] = useState("");
	const [loading, setLoading] = useState(true);
	const [sending, setSending] = useState(false);
	const [isOnline, setIsOnline] = useState(false);
	const [lastSeen, setLastSeen] = useState(null);

	const inputRef = useRef(null);

	// Load user info
	const loadUserInfo = useCallback(async () => {
		if (!client || !session || !userId) return;

		setLoading(true);
		try {
			const profile = await getUserProfile(client, session, userId);
			setOtherUser({
				userId: profile.userId || userId,
				username: profile.username || "Unknown",
				avatarUrl: profile.avatarUrl || null,
			});

			// Get online status
			try {
				const statusResult = await getUsersOnlineStatus(client, session, [
					userId,
				]);
				const userStatus = (statusResult.statuses || []).find(
					(s) => s.userId === userId
				);
				if (userStatus) {
					setIsOnline(userStatus.isOnline);
					setLastSeen(userStatus.lastSeenAt);
				}
			} catch (e) {
				console.log("Could not get online status:", e);
			}
		} catch (error) {
			console.error("Failed to load user info:", error);
		} finally {
			setLoading(false);
		}
	}, [client, session, userId]);

	useEffect(() => {
		loadUserInfo();
	}, [loadUserInfo]);

	// Focus input on load
	useEffect(() => {
		if (!loading && inputRef.current) {
			inputRef.current.focus();
		}
	}, [loading]);

	// Handle sending message - creates channel and sends message
	const handleSend = async () => {
		if (!messageInput.trim() || sending) return;

		setSending(true);
		try {
			// Create the channel first
			const channelResult = await createChannel(client, session, "direct", "", [
				userId,
			]);
			const channelId =
				channelResult.channel?.channelId || channelResult.channelId;

			if (!channelId) {
				throw new Error("Failed to create channel");
			}

			// Send the message
			await sendChatMessage(client, session, channelId, messageInput.trim());

			// Navigate to the conversation page
			navigate(`/chat/${channelId}`, { replace: true });
		} catch (error) {
			console.error("Failed to send message:", error);
			setSending(false);
		}
	};

	// Handle key press
	const handleKeyPress = (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	// Format last seen time
	const formatLastSeen = (timestamp) => {
		if (!timestamp) return "";
		let ts = timestamp;
		if (ts < 1e12) ts = ts * 1000;
		const date = new Date(ts);
		return `Last seen at ${date.toLocaleTimeString([], {
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		})}`;
	};

	if (!session) {
		return (
			<div className="dm-page">
				<div className="dm-empty-state">
					<div className="dm-empty-icon">🔒</div>
					<h3>Please log in</h3>
					<p>You need to be logged in to access Direct Messages.</p>
				</div>
			</div>
		);
	}

	return (
		<div className="dm-page">
			{/* Header */}
			<div className="dm-header">
				<button className="dm-back-btn" onClick={() => navigate("/chat")}>
					<span className="back-icon">‹</span>
				</button>

				{loading ? (
					<div className="dm-user-details">
						<p className="dm-username">Loading...</p>
					</div>
				) : (
					<div
						className="dm-user-info"
						onClick={() => navigate(`/profile/${userId}`)}
						style={{ cursor: "pointer" }}
					>
						<div className="dm-avatar-container">
							{otherUser?.avatarUrl ? (
								<img
									src={otherUser.avatarUrl}
									alt={otherUser.username}
									className="dm-avatar"
								/>
							) : (
								<div className="dm-avatar-placeholder">
									{(otherUser?.username || "?")[0].toUpperCase()}
								</div>
							)}
							{isOnline && <span className="dm-online-dot" />}
						</div>

						<div className="dm-user-details">
							<p className="dm-username">{otherUser?.username || "Unknown"}</p>
							<p className="dm-status">
								{isOnline ? "Online" : lastSeen ? formatLastSeen(lastSeen) : ""}
							</p>
						</div>
					</div>
				)}
			</div>

			{/* Messages Area - Empty for new conversation */}
			<div className="dm-messages">
				<div className="new-conversation-prompt">
					<div className="prompt-avatar">
						{otherUser?.avatarUrl ? (
							<img src={otherUser.avatarUrl} alt="" />
						) : (
							<div className="prompt-avatar-placeholder">
								{(otherUser?.username || "?")[0].toUpperCase()}
							</div>
						)}
					</div>
					<h3>{otherUser?.username || "Unknown"}</h3>
					<p>Start a conversation with {otherUser?.username || "this user"}</p>
				</div>
			</div>

			{/* Input Container */}
			<div className="dm-input-container">
				<div className="dm-input-wrapper">
					<input
						ref={inputRef}
						type="text"
						className="dm-input"
						placeholder="Message..."
						value={messageInput}
						onChange={(e) => setMessageInput(e.target.value)}
						onKeyPress={handleKeyPress}
						disabled={sending}
					/>
				</div>
				<button
					className={`dm-send-btn ${messageInput.trim() ? "active" : ""}`}
					onClick={handleSend}
					disabled={!messageInput.trim() || sending}
				>
					{sending ? "..." : "➤"}
				</button>
			</div>
		</div>
	);
}

export default NewConversationPage;
