import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
	getChannelInfo,
	getChannelMessages,
	acceptDMRequest,
	blockDMSender,
	deleteDMRequest,
	joinChannelStream,
	leaveChannelStream,
} from "../utils/nakamaClient";
import {
	subscribeToEvent,
	useNotifications,
} from "../contexts/NotificationContext";
import "./MessageRequestPage.css";

/**
 * Format time for display (HH:MM)
 */
function formatTime(timestamp) {
	if (!timestamp) return "";
	const date = new Date(timestamp);
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Group messages by date
 */
function groupMessagesByDate(messages) {
	const groups = [];
	let currentDate = null;

	messages.forEach((msg) => {
		const msgDate = new Date(msg.createdAt).toDateString();
		if (msgDate !== currentDate) {
			currentDate = msgDate;
			const date = new Date(msg.createdAt);
			const today = new Date().toDateString();
			const yesterday = new Date(Date.now() - 86400000).toDateString();

			let label;
			if (msgDate === today) {
				label = "Today";
			} else if (msgDate === yesterday) {
				label = "Yesterday";
			} else {
				label = date.toLocaleDateString([], {
					weekday: "long",
					month: "short",
					day: "numeric",
				});
			}
			groups.push({ type: "date", label });
		}
		groups.push({ type: "message", data: msg });
	});

	return groups;
}

function MessageRequestPage({ client, session }) {
	const { channelId } = useParams();
	const navigate = useNavigate();
	const { decrementDmRequestCount } = useNotifications();
	const messagesEndRef = useRef(null);

	const [, setChannel] = useState(null);
	const [messages, setMessages] = useState([]);
	const [loading, setLoading] = useState(true);
	const [otherUser, setOtherUser] = useState(null);
	const [actionLoading, setActionLoading] = useState(null);

	// Load channel info and messages
	const loadData = useCallback(async () => {
		if (!client || !session || !channelId) return;
		setLoading(true);
		try {
			const [channelResult, messagesResult] = await Promise.all([
				getChannelInfo(client, session, channelId),
				getChannelMessages(client, session, channelId),
			]);

			setChannel(channelResult.channel || channelResult);
			setMessages(messagesResult.messages || []);

			// Find the other participant
			const channelData = channelResult.channel || channelResult;
			const otherParticipant = (channelData.participants || []).find(
				(p) => p.userId !== session.user_id
			);
			setOtherUser(otherParticipant);
		} catch (error) {
			console.error("Failed to load request data:", error);
		} finally {
			setLoading(false);
		}
	}, [client, session, channelId]);

	useEffect(() => {
		loadData();
	}, [loadData]);

	// Join channel stream for real-time updates
	useEffect(() => {
		if (!client || !session || !channelId) return;

		const joinStream = async () => {
			try {
				console.log("🔗 Joining message request stream:", channelId);
				await joinChannelStream(client, session, channelId);
				console.log("✅ Joined message request stream:", channelId);
			} catch (error) {
				console.error("❌ Failed to join message request stream:", error);
			}
		};

		joinStream();

		return () => {
			leaveChannelStream(client, session, channelId).catch((error) => {
				console.warn("Failed to leave message request stream:", error);
			});
		};
	}, [client, session, channelId]);

	// Subscribe to new messages
	useEffect(() => {
		if (!channelId) return;
		const unsubscribe = subscribeToEvent("new_message", (data) => {
			// Handle both wrapped and unwrapped message data
			const messageData = data.message || data;
			if (messageData.channelId === channelId || data.channelId === channelId) {
				setMessages((prev) => {
					// Avoid duplicates
					const msgToAdd = messageData.messageId ? messageData : data;
					if (prev.some((m) => m.messageId === msgToAdd.messageId)) return prev;
					return [...prev, msgToAdd];
				});
			}
		});
		return () => unsubscribe();
	}, [channelId]);

	// Scroll to bottom when messages change
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	// Handle accept
	const handleAccept = async () => {
		if (actionLoading) return;
		setActionLoading("accept");
		try {
			await acceptDMRequest(client, session, channelId);
			decrementDmRequestCount();
			// Navigate to the regular chat conversation
			navigate(`/chat/${channelId}`, { replace: true });
		} catch (error) {
			console.error("Failed to accept request:", error);
			setActionLoading(null);
		}
	};

	// Handle block
	const handleBlock = async () => {
		if (actionLoading) return;
		if (!window.confirm(`Block ${otherUser?.username || "this user"}?`)) return;
		setActionLoading("block");
		try {
			await blockDMSender(client, session, channelId);
			decrementDmRequestCount();
			navigate("/chat", { replace: true });
		} catch (error) {
			console.error("Failed to block user:", error);
			setActionLoading(null);
		}
	};

	// Handle delete
	const handleDelete = async () => {
		if (actionLoading) return;
		setActionLoading("delete");
		try {
			await deleteDMRequest(client, session, channelId);
			decrementDmRequestCount();
			navigate("/chat", { replace: true });
		} catch (error) {
			console.error("Failed to delete request:", error);
			setActionLoading(null);
		}
	};

	// Navigate to user profile
	const handleViewProfile = () => {
		if (otherUser?.userId) {
			navigate(`/profile/${otherUser.userId}`);
		}
	};

	if (!session) {
		return (
			<div className="request-page">
				<div className="request-loading">
					<p>You need to be logged in to view message requests.</p>
				</div>
			</div>
		);
	}

	const groupedMessages = groupMessagesByDate(messages);

	return (
		<div className="request-page">
			{/* Header */}
			<div className="request-header">
				<button className="request-back-btn" onClick={() => navigate("/chat")}>
					<span className="back-icon">‹</span>
				</button>
				<h1 className="request-title">Message Request</h1>
			</div>

			{loading ? (
				<div className="request-loading">
					<div className="request-spinner"></div>
				</div>
			) : (
				<>
					{/* Profile Section */}
					<div className="request-profile-section">
						<div className="request-avatar-large">
							{otherUser?.avatarUrl ? (
								<img src={otherUser.avatarUrl} alt="" />
							) : (
								<div className="request-avatar-placeholder">
									{(otherUser?.username || "?")[0].toUpperCase()}
								</div>
							)}
						</div>
						<h2 className="request-username">
							{otherUser?.username || "Unknown"}
						</h2>
						<button
							className="request-view-profile-btn"
							onClick={handleViewProfile}
						>
							View Profile
						</button>
					</div>

					{/* Messages */}
					<div className="request-messages">
						{messages.length === 0 ? (
							<div className="request-no-messages">
								<p>No messages yet</p>
							</div>
						) : (
							<>
								{groupedMessages.map((item, index) => {
									if (item.type === "date") {
										return (
											<div
												key={`date-${index}`}
												className="request-date-separator"
											>
												<span className="request-date-label">{item.label}</span>
											</div>
										);
									}

									const msg = item.data;
									const isOwn = msg.senderId === session.user_id;

									return (
										<div
											key={msg.messageId}
											className={`request-message ${
												isOwn ? "request-message-own" : "request-message-other"
											}`}
										>
											<div className="request-message-bubble">
												<p className="request-message-content">{msg.content}</p>
												<span className="request-message-time">
													{formatTime(msg.createdAt)}
												</span>
											</div>
										</div>
									);
								})}
								<div ref={messagesEndRef} />
							</>
						)}
					</div>

					{/* Accept Info */}
					<div className="request-accept-info">
						<p>
							Accept message request from{" "}
							<strong>{otherUser?.username || "this user"}</strong>? If you
							accept, they will also be able to call you and see info like when
							you're online.
						</p>
					</div>

					{/* Action Bar */}
					<div className="request-action-bar">
						<button
							className="request-action-btn request-action-block"
							onClick={handleBlock}
							disabled={actionLoading !== null}
						>
							{actionLoading === "block" ? "..." : "Block"}
						</button>
						<button
							className="request-action-btn request-action-delete"
							onClick={handleDelete}
							disabled={actionLoading !== null}
						>
							{actionLoading === "delete" ? "..." : "Delete"}
						</button>
						<button
							className="request-action-btn request-action-accept"
							onClick={handleAccept}
							disabled={actionLoading !== null}
						>
							{actionLoading === "accept" ? "..." : "Accept"}
						</button>
					</div>
				</>
			)}
		</div>
	);
}

export default MessageRequestPage;
