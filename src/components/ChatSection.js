import { useState, useEffect, useRef } from "react";
import {
	createChannel,
	getChannels,
	getInboxChannels,
	getRequestChannels,
	sendChatMessage,
	getMessages,
	acceptDMRequest,
	declineDMRequest,
	sendTypingIndicator,
	markMessageRead,
	addReaction,
	removeReaction,
	editMessage,
	deleteMessage,
	getUsersOnlineStatus,
	joinChannelStream,
	leaveChannelStream,
} from "../utils/nakamaClient";
import { subscribeToEvent } from "../contexts/NotificationContext";

/**
 * Format timestamp for display
 * Handles both millisecond and second timestamps
 */
function formatTimestamp(timestamp) {
	if (!timestamp) return "";

	// Convert to milliseconds if timestamp appears to be in seconds
	let ts = timestamp;
	if (ts < 1e12) {
		ts = ts * 1000;
	}

	const date = new Date(ts);
	const now = new Date();
	const isToday = date.toDateString() === now.toDateString();

	if (isToday) {
		return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
	}

	// Check if yesterday
	const yesterday = new Date(now);
	yesterday.setDate(yesterday.getDate() - 1);
	if (date.toDateString() === yesterday.toDateString()) {
		return (
			"Yesterday " +
			date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
		);
	}

	return (
		date.toLocaleDateString([], { month: "short", day: "numeric" }) +
		" " +
		date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
	);
}

/**
 * Get message status icon
 */
function getStatusIcon(status, isRead) {
	// Use isRead as fallback for backward compatibility
	if (status === "seen" || isRead) return "✓✓"; // Blue double check
	if (status === "delivered") return "✓✓"; // Gray double check
	if (status === "sent") return "✓"; // Single check
	if (status === "pending") return "🕐"; // Clock
	if (status === "failed") return "⚠️"; // Warning
	return "✓"; // Default to sent
}

/**
 * Chat Header Component with Online Status
 */
function ChatHeader({
	selectedChannel,
	session,
	onlineStatuses,
	formatTimestamp,
	onRefresh,
	theme,
}) {
	// Get online status for the other participant (for DMs)
	const otherParticipant = (selectedChannel.participantIds || []).find(
		(id) => id !== session.user_id
	);
	const otherUserStatus = otherParticipant
		? onlineStatuses[otherParticipant]
		: null;
	const isOtherOnline = otherUserStatus?.isOnline;

	return (
		<div
			style={{
				padding: "10px 12px",
				backgroundColor: theme.surface,
				borderBottom: `1px solid ${theme.border}`,
				fontSize: "13px",
			}}
		>
			<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
				{/* Avatar placeholder */}
				<div
					style={{
						width: "36px",
						height: "36px",
						minWidth: "36px",
						borderRadius: "50%",
						backgroundColor: theme.primaryLight,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						fontSize: "16px",
						position: "relative",
						flexShrink: 0,
					}}
				>
					{selectedChannel.channelType === "bot"
						? "🤖"
						: selectedChannel.channelType === "group"
						? "👥"
						: "👤"}
					{selectedChannel.channelType === "direct" && (
						<span
							style={{
								position: "absolute",
								bottom: "0",
								right: "0",
								width: "10px",
								height: "10px",
								borderRadius: "50%",
								backgroundColor: isOtherOnline ? theme.accent : "#6c757d",
								border: `2px solid ${theme.surface}`,
							}}
							title={isOtherOnline ? "Online" : "Offline"}
						/>
					)}
				</div>
				<div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
					<div
						style={{
							fontWeight: "600",
							color: theme.text,
							fontSize: "14px",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
						}}
					>
						{selectedChannel.name || "Direct Message"}
					</div>
					{selectedChannel.channelType === "direct" && (
						<div
							style={{
								fontSize: "11px",
								color: isOtherOnline ? theme.accent : theme.textSecondary,
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
							}}
						>
							{isOtherOnline
								? "Online"
								: otherUserStatus?.lastSeenAt
								? `Last seen ${formatTimestamp(otherUserStatus.lastSeenAt)}`
								: "Offline"}
						</div>
					)}
				</div>
				<button
					onClick={onRefresh}
					style={{
						fontSize: "11px",
						padding: "5px 10px",
						backgroundColor: theme.surfaceLight,
						color: theme.text,
						border: "none",
						borderRadius: "6px",
						cursor: "pointer",
						flexShrink: 0,
						whiteSpace: "nowrap",
					}}
				>
					🔄
				</button>
			</div>
		</div>
	);
}

/**
 * Chat Section Component
 * Handles chat channels, messages, and bot conversations
 */
function ChatSection({ client, session, socket, onEvent }) {
	const [activeTab, setActiveTab] = useState("channels"); // channels, create, messages

	// Channels state
	const [channels, setChannels] = useState([]);
	const [selectedChannel, setSelectedChannel] = useState(null);
	const [channelView, setChannelView] = useState("all"); // all, inbox, requests
	const [channelsLoading, setChannelsLoading] = useState(false);

	// Create channel state
	const [channelType, setChannelType] = useState("direct");
	const [channelName, setChannelName] = useState("");
	const [participantIds, setParticipantIds] = useState("");

	// Messages state
	const [messages, setMessages] = useState([]);
	const [messageInput, setMessageInput] = useState("");
	const [messagesLoading, setMessagesLoading] = useState(false);
	const [typingUser, setTypingUser] = useState(null);

	// Online status state
	const [onlineStatuses, setOnlineStatuses] = useState({}); // userId -> { isOnline, lastSeenAt }

	// Message action states
	const [editingMessage, setEditingMessage] = useState(null); // { messageId, content }
	const [replyingTo, setReplyingTo] = useState(null); // { messageId, senderName, content }
	const [showReactionPicker, setShowReactionPicker] = useState(null); // messageId or null

	const messagesEndRef = useRef(null);
	const typingTimeoutRef = useRef(null);
	const typingActiveRef = useRef(false);
	const remoteTypingTimeoutRef = useRef(null);

	// Load channels on mount / when switching to channels tab
	useEffect(() => {
		if (session && activeTab === "channels") {
			loadChannels(channelView);
		}
	}, [session, activeTab]);

	// Subscribe to real-time channel and DM events
	useEffect(() => {
		// DM request notification - reload channels if on requests view
		const unsubDmRequest = subscribeToEvent("dm_request", (content) => {
			console.log("📨 Real-time DM request:", content);
			if (channelView === "requests") {
				loadChannels("requests");
			}
		});

		// New channel notification - reload channels
		const unsubNewChannel = subscribeToEvent("new_channel", (content) => {
			console.log("📬 Real-time new channel:", content);
			loadChannels(channelView);
		});

		// Presence update notification - update online status
		const unsubPresence = subscribeToEvent("presence_update", (content) => {
			console.log("🟢 Real-time presence update:", content);
			setOnlineStatuses((prev) => ({
				...prev,
				[content.userId]: {
					isOnline: content.isOnline,
					lastSeenAt: content.timestamp,
				},
			}));
		});

		return () => {
			unsubDmRequest();
			unsubNewChannel();
			unsubPresence();
		};
	}, [channelView]);

	// Load messages when channel is selected
	useEffect(() => {
		if (selectedChannel) {
			loadMessages(selectedChannel.channelId);
		}
	}, [selectedChannel]);

	// Auto-scroll to bottom when new messages arrive
	// Subscribe to chat stream for typing indicators and read receipts
	// Subscribe to typing indicator and read receipt notifications
	useEffect(() => {
		if (!session || !selectedChannel) {
			return;
		}

		const channelId = selectedChannel.channelId;

		// Subscribe to typing indicator notifications
		const unsubscribeTyping = subscribeToEvent("typing_indicator", (data) => {
			console.log("📝 Typing indicator event received:", data);
			// Only handle events for this channel
			if (data.channelId !== channelId) return;
			// Ignore our own typing events
			if (data.userId === session.user_id) return;

			if (data.isTyping) {
				setTypingUser(data.userName || "Someone");
				if (remoteTypingTimeoutRef.current) {
					clearTimeout(remoteTypingTimeoutRef.current);
				}
				remoteTypingTimeoutRef.current = setTimeout(() => {
					setTypingUser(null);
					remoteTypingTimeoutRef.current = null;
				}, 3000);
			} else {
				setTypingUser(null);
			}
		});

		// Subscribe to read receipt notifications
		const unsubscribeReadReceipt = subscribeToEvent("read_receipt", (data) => {
			console.log("✓ Read receipt event received:", data);
			// Only handle events for this channel
			const receiptChannelId = data.channel_id || data.channelId;
			if (receiptChannelId !== channelId) return;

			// Mark message as seen in local state and update status
			const receiptMessageId = data.message_id || data.messageId;
			setMessages((prevMessages) =>
				prevMessages.map((m) =>
					m.messageId === receiptMessageId
						? { ...m, isRead: true, status: "seen" }
						: m
				)
			);
		});

		// Subscribe to new chat messages
		const unsubscribeChatMessage = subscribeToEvent("chat_message", (data) => {
			console.log("💬 Chat message event received:", data);
			// Backend sends snake_case fields: channel_id, sender_id, message_id
			const msgChannelId = data.channel_id || data.channelID;
			const msgSenderId = data.sender_id || data.senderID;

			// Only handle events for this channel
			if (msgChannelId !== channelId) return;
			// Ignore our own messages (we add them optimistically)
			if (msgSenderId === session.user_id) return;

			const replyToId = data.reply_to_id || data.replyToId || "";

			// Add the message directly from notification data
			const newMessage = {
				messageId: data.message_id || data.messageId,
				channelId: msgChannelId,
				senderId: msgSenderId,
				senderName: data.sender_username || data.senderName || "Unknown",
				content: data.content,
				messageType: data.message_type || "text",
				status: "sent",
				createdAt: data.created_at || Date.now(),
				isRead: false,
				replyToId: replyToId,
				replyToSenderName: "",
				replyToContent: "",
			};

			setMessages((prevMessages) => {
				// Check if message already exists (avoid duplicates)
				const exists = prevMessages.some(
					(m) => m.messageId === newMessage.messageId
				);
				if (exists) return prevMessages;

				// If this is a reply, find the original message and populate reply info
				if (replyToId) {
					const repliedToMsg = prevMessages.find(
						(m) => m.messageId === replyToId
					);
					if (repliedToMsg) {
						newMessage.replyToSenderName = repliedToMsg.senderName;
						newMessage.replyToContent = repliedToMsg.isDeleted
							? "[Message deleted]"
							: repliedToMsg.content?.substring(0, 100) || "";
					}
				}

				return [...prevMessages, newMessage];
			});
		});

		// Subscribe to message updates (edits)
		const unsubscribeMessageUpdate = subscribeToEvent(
			"message_update",
			(data) => {
				console.log("✏️ Message update event received:", data);
				const msgChannelId = data.channel_id || data.channelID;
				const msgId = data.message_id || data.messageId;

				// Only handle events for this channel
				if (msgChannelId !== channelId) return;

				setMessages((prevMessages) =>
					prevMessages.map((msg) =>
						msg.messageId === msgId
							? {
									...msg,
									content: data.content,
									isEdited: data.is_edited || data.isEdited || true,
									updatedAt: data.updated_at || data.updatedAt || Date.now(),
							  }
							: msg
					)
				);
			}
		);

		// Subscribe to message deletes
		const unsubscribeMessageDelete = subscribeToEvent(
			"message_delete",
			(data) => {
				console.log("🗑️ Message delete event received:", data);
				const msgChannelId = data.channel_id || data.channelID;
				const msgId = data.message_id || data.messageId;

				// Only handle events for this channel
				if (msgChannelId !== channelId) return;

				setMessages((prevMessages) =>
					prevMessages.map((msg) =>
						msg.messageId === msgId
							? { ...msg, content: "[Message deleted]", isDeleted: true }
							: msg
					)
				);
			}
		);

		// Subscribe to reaction updates
		const unsubscribeReactionUpdate = subscribeToEvent(
			"reaction_update",
			(data) => {
				console.log("😀 Reaction update event received:", data);
				const msgChannelId = data.channel_id || data.channelID;
				const msgId = data.message_id || data.messageId;
				const emoji = data.emoji;
				const userId = data.user_id || data.userId;
				const action = data.action;

				// Only handle events for this channel
				if (msgChannelId !== channelId) return;

				setMessages((prevMessages) =>
					prevMessages.map((msg) => {
						if (msg.messageId !== msgId) return msg;

						// Clone reactions object
						const reactions = { ...(msg.reactions || {}) };
						const currentUsers = reactions[emoji] || [];

						if (action === "added") {
							// Add user to reaction if not already present
							if (!currentUsers.includes(userId)) {
								reactions[emoji] = [...currentUsers, userId];
							}
						} else if (action === "removed") {
							// Remove user from reaction
							reactions[emoji] = currentUsers.filter((id) => id !== userId);
							// Remove emoji key if no users left
							if (reactions[emoji].length === 0) {
								delete reactions[emoji];
							}
						}

						return { ...msg, reactions };
					})
				);
			}
		);

		return () => {
			unsubscribeTyping();
			unsubscribeReadReceipt();
			unsubscribeChatMessage();
			unsubscribeMessageUpdate();
			unsubscribeMessageDelete();
			unsubscribeReactionUpdate();
			setTypingUser(null);
			if (remoteTypingTimeoutRef.current) {
				clearTimeout(remoteTypingTimeoutRef.current);
				remoteTypingTimeoutRef.current = null;
			}
		};
	}, [session, selectedChannel]);

	useEffect(() => {
		if (!socket || !session || !selectedChannel || !client) {
			return;
		}

		let isMounted = true;
		const channelId = selectedChannel.channelId;

		// Join the channel stream via RPC (server-side stream joining) - for future use
		const joinStream = async () => {
			try {
				console.log("🔗 Attempting to join channel stream:", channelId);
				const result = await joinChannelStream(client, session, channelId);
				console.log("✅ Joined channel stream:", channelId, result);
			} catch (error) {
				console.error("❌ Failed to join chat stream:", error);
			}
		};

		joinStream();

		const previousHandler = socket.onstreamdata;

		socket.onstreamdata = (streamData) => {
			try {
				if (!isMounted) return;

				console.log(
					"📡 Stream data received:",
					JSON.stringify(streamData, null, 2)
				);

				// Only handle chat stream events for this channel
				// Nakama JS SDK uses stream.mode and stream.subject
				const mode = streamData.stream?.mode || streamData.mode;
				const subject = streamData.stream?.subject || streamData.subject;

				console.log(
					"📡 Stream mode:",
					mode,
					"subject:",
					subject,
					"expected channelId:",
					channelId
				);

				// Compare mode as number (could be string "1" or number 1)
				if (parseInt(mode) !== 1 || subject !== channelId) {
					console.log("📡 Skipping stream data - mode or subject mismatch");
					if (previousHandler) {
						previousHandler(streamData);
					}
					return;
				}

				let payload;
				try {
					payload = JSON.parse(streamData.data);
					console.log("📡 Parsed stream payload:", payload);
				} catch (e) {
					console.warn("Failed to parse chat stream data", e);
					return;
				}

				if (!payload || !payload.type) {
					return;
				}

				// Handle stream-based events (backup for notifications)
				if (payload.type === "new_message") {
					// Real-time new message - add to messages list
					const newMessage = payload.message;
					if (newMessage && newMessage.senderId !== session.user_id) {
						// Only add messages from others (we already add our own optimistically)
						setMessages((prevMessages) => {
							// Check if message already exists (avoid duplicates)
							const exists = prevMessages.some(
								(m) => m.messageId === newMessage.messageId
							);
							if (exists) return prevMessages;

							// Only populate reply info locally if backend didn't provide it
							if (newMessage.replyToId && !newMessage.replyToSenderName) {
								const repliedToMsg = prevMessages.find(
									(m) => m.messageId === newMessage.replyToId
								);
								if (repliedToMsg) {
									newMessage.replyToSenderName = repliedToMsg.senderName;
									newMessage.replyToContent = repliedToMsg.isDeleted
										? "[Message deleted]"
										: repliedToMsg.content?.substring(0, 100) || "";
								}
							}

							console.log("➕ Adding new message with reply info:", {
								messageId: newMessage.messageId,
								replyToId: newMessage.replyToId,
								replyToSenderName: newMessage.replyToSenderName,
								replyToContent: newMessage.replyToContent,
							});

							return [...prevMessages, newMessage];
						});
					}
				} else if (payload.type === "message_update") {
					// Real-time message update (edit)
					// Handle both {message: {...}} and {data: {...}} structures
					const updatedMessage = payload.message || payload.data;
					console.log("✏️ Received message_update payload:", payload);
					if (updatedMessage) {
						const msgId = updatedMessage.messageId || updatedMessage.message_id;
						const content = updatedMessage.content;
						const isEdited =
							updatedMessage.isEdited || updatedMessage.is_edited || true;
						const updatedAt =
							updatedMessage.updatedAt ||
							updatedMessage.updated_at ||
							Date.now();

						console.log("✏️ Updating message:", { msgId, content, isEdited });
						setMessages((prevMessages) =>
							prevMessages.map((m) =>
								m.messageId === msgId
									? { ...m, content, isEdited, updatedAt }
									: m
							)
						);
						console.log("✏️ Message updated via stream:", msgId);
					}
				} else if (payload.type === "message_delete") {
					// Real-time message deletion
					// Handle both {messageID: "..."} and {data: {...}} structures
					const deletedMessageId =
						payload.messageID || payload.messageId || payload.data?.message_id;
					console.log("🗑️ Received message_delete payload:", payload);
					if (deletedMessageId) {
						setMessages((prevMessages) =>
							prevMessages.map((m) =>
								m.messageId === deletedMessageId
									? { ...m, content: "[Message deleted]", isDeleted: true }
									: m
							)
						);
						console.log("🗑️ Message deleted via stream:", deletedMessageId);
					}
				} else if (payload.type === "reaction_update") {
					// Real-time reaction update
					console.log("😊 Received reaction_update payload:", payload);
					const msgId =
						payload.messageID || payload.messageId || payload.message_id;
					const emoji = payload.emoji;
					const action = payload.action; // "added" or "removed"
					const reactingUserId =
						payload.userID || payload.userId || payload.user_id;

					if (msgId && emoji) {
						setMessages((prevMessages) =>
							prevMessages.map((m) => {
								if (m.messageId !== msgId) return m;

								const reactions = { ...(m.reactions || {}) };
								const currentUsers = reactions[emoji] || [];

								if (action === "added") {
									if (!currentUsers.includes(reactingUserId)) {
										reactions[emoji] = [...currentUsers, reactingUserId];
									}
								} else if (action === "removed") {
									reactions[emoji] = currentUsers.filter(
										(u) => u !== reactingUserId
									);
									if (reactions[emoji].length === 0) {
										delete reactions[emoji];
									}
								}

								return { ...m, reactions };
							})
						);
						console.log(
							"😊 Reaction updated via stream:",
							msgId,
							emoji,
							action
						);
					}
				} else if (
					payload.type === "read_receipt" ||
					payload.type === "delivery_receipt"
				) {
					// Handle read/delivery receipts via stream
					const msgId = payload.messageID || payload.message_id;
					const status = payload.status; // "delivered" or "seen"

					if (msgId && status) {
						setMessages((prevMessages) =>
							prevMessages.map((m) =>
								m.messageId === msgId
									? { ...m, status, isRead: status === "seen" }
									: m
							)
						);
						console.log("📬 Receipt via stream:", msgId, status);
					}
				}

				if (previousHandler) {
					previousHandler(streamData);
				}
			} catch (e) {
				console.error("Error in chat onstreamdata handler", e);
			}
		};

		return () => {
			isMounted = false;
			if (remoteTypingTimeoutRef.current) {
				clearTimeout(remoteTypingTimeoutRef.current);
				remoteTypingTimeoutRef.current = null;
			}

			// Leave the channel stream via RPC
			if (client && session) {
				leaveChannelStream(client, session, channelId).catch((error) => {
					console.warn("Failed to leave chat stream", error);
				});
			}

			// Restore any previous handler
			socket.onstreamdata = previousHandler;
		};
	}, [socket, session, selectedChannel, client]);

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	const scrollToBottom = () => {
		// Use block: "nearest" to prevent page-level scrolling
		// This only scrolls within the messages container
		messagesEndRef.current?.scrollIntoView({
			behavior: "smooth",
			block: "nearest",
		});
	};

	// Fetch online status for users
	const fetchOnlineStatuses = async (userIds) => {
		if (!userIds || userIds.length === 0) return;

		try {
			const result = await getUsersOnlineStatus(client, session, userIds);
			if (result.statuses) {
				const statusMap = {};
				result.statuses.forEach((status) => {
					statusMap[status.userId] = {
						isOnline: status.isOnline,
						lastSeenAt: status.lastSeenAt,
					};
				});
				setOnlineStatuses((prev) => ({ ...prev, ...statusMap }));
			}
		} catch (error) {
			console.error("Failed to fetch online statuses:", error);
		}
	};

	const loadChannels = async (view = channelView) => {
		try {
			setChannelsLoading(true);
			let result;
			if (view === "inbox") {
				result = await getInboxChannels(client, session);
			} else if (view === "requests") {
				result = await getRequestChannels(client, session);
			} else {
				result = await getChannels(client, session);
			}

			setChannels(result.channels || []);
			setChannelView(view);

			// Fetch online status for all participants
			const allParticipants = new Set();
			(result.channels || []).forEach((channel) => {
				(channel.participantIds || []).forEach((id) => {
					if (id !== session.user_id) {
						allParticipants.add(id);
					}
				});
			});
			if (allParticipants.size > 0) {
				fetchOnlineStatuses(Array.from(allParticipants));
			}

			onEvent(
				"channels_loaded",
				`Loaded ${result.channels?.length || 0} ${view} channels`,
				"success"
			);
		} catch (error) {
			onEvent(
				"channels_error",
				`Failed to load ${view} channels: ${error.message}`,
				"error"
			);
		} finally {
			setChannelsLoading(false);
		}
	};

	const handleCreateChannel = async () => {
		if (!channelName.trim() && channelType !== "direct") {
			onEvent("validation_error", "Channel name is required", "error");
			return;
		}

		if (!participantIds.trim()) {
			onEvent("validation_error", "Participant IDs are required", "error");
			return;
		}

		try {
			const participantArray = participantIds
				.split(",")
				.map((id) => id.trim())
				.filter((id) => id);
			const result = await createChannel(
				client,
				session,
				channelType,
				channelName,
				participantArray
			);
			onEvent("channel_created", "Channel created successfully", "success");
			setChannelName("");
			setParticipantIds("");
			setActiveTab("channels");
			loadChannels(channelView);
		} catch (error) {
			onEvent(
				"channel_error",
				`Failed to create channel: ${error.message}`,
				"error"
			);
		}
	};

	const loadMessages = async (channelId) => {
		try {
			setMessagesLoading(true);
			const result = await getMessages(client, session, channelId, 50);
			const loadedMessages = result.messages || [];

			// Populate replyToContent and replyToSenderName for messages that have replyToId
			const enrichedMessages = loadedMessages.map((msg) => {
				if (msg.replyToId) {
					const repliedToMsg = loadedMessages.find(
						(m) => m.messageId === msg.replyToId
					);
					if (repliedToMsg) {
						return {
							...msg,
							replyToSenderName: repliedToMsg.senderName,
							replyToContent: repliedToMsg.isDeleted
								? "[Message deleted]"
								: repliedToMsg.content?.substring(0, 100) || "",
						};
					}
				}
				return msg;
			});

			setMessages(enrichedMessages);
			onEvent(
				"messages_loaded",
				`Loaded ${loadedMessages.length} messages`,
				"info"
			);

			// Mark all incoming messages as read for this user
			if (session?.user_id && enrichedMessages.length > 0) {
				const unreadIncoming = enrichedMessages.filter(
					(msg) => msg.senderId !== session.user_id && !msg.isRead
				);
				for (const msg of unreadIncoming) {
					try {
						await markMessageRead(client, session, channelId, msg.messageId);
					} catch (err) {
						console.error("Failed to mark message as read", err);
						break;
					}
				}
			}
		} catch (error) {
			onEvent(
				"messages_error",
				`Failed to load messages: ${error.message}`,
				"error"
			);
		} finally {
			setMessagesLoading(false);
		}
	};
	const handleMessageInputChange = (e) => {
		const value = e.target.value;
		setMessageInput(value);

		if (!selectedChannel) {
			return;
		}

		// Start typing indicator on first keystroke
		if (!typingActiveRef.current) {
			typingActiveRef.current = true;
			try {
				sendTypingIndicator(client, session, selectedChannel.channelId, true);
			} catch (error) {
				console.error("Failed to send typing indicator", error);
			}
		}

		// Reset debounce timer to turn off typing
		if (typingTimeoutRef.current) {
			clearTimeout(typingTimeoutRef.current);
		}
		typingTimeoutRef.current = setTimeout(() => {
			typingActiveRef.current = false;
			try {
				sendTypingIndicator(client, session, selectedChannel.channelId, false);
			} catch (error) {
				console.error("Failed to clear typing indicator", error);
			}
		}, 2000);
	};

	const handleSendMessage = async () => {
		if (!messageInput.trim() || !selectedChannel) return;

		const content = messageInput.trim();
		const tempMessageId = `temp-${Date.now()}`;
		const replyToMessageId = replyingTo?.messageId || "";

		// Add optimistic message with pending status
		const optimisticMessage = {
			messageId: tempMessageId,
			channelId: selectedChannel.channelId,
			senderId: session.user_id,
			senderName: session.username || "You",
			content: content,
			messageType: "text",
			status: "pending",
			createdAt: Date.now(),
			isRead: false,
			replyToId: replyToMessageId,
			replyToSenderName: replyingTo?.senderName || "",
			replyToContent: replyingTo?.content || "",
		};

		setMessages((prev) => [...prev, optimisticMessage]);
		setMessageInput("");
		setReplyingTo(null); // Clear reply state

		try {
			const result = await sendChatMessage(
				client,
				session,
				selectedChannel.channelId,
				content,
				"text",
				"",
				replyToMessageId
			);

			// Update optimistic message with real data
			setMessages((prev) =>
				prev.map((msg) =>
					msg.messageId === tempMessageId
						? {
								...msg,
								messageId:
									result.messageId ||
									result.message?.messageId ||
									tempMessageId,
								status: "sent",
								createdAt: result.message?.createdAt || msg.createdAt,
						  }
						: msg
				)
			);
		} catch (error) {
			// Mark message as failed
			setMessages((prev) =>
				prev.map((msg) =>
					msg.messageId === tempMessageId ? { ...msg, status: "failed" } : msg
				)
			);
			onEvent(
				"message_error",
				`Failed to send message: ${error.message}`,
				"error"
			);
		}
	};

	const handleSelectChannel = (channel) => {
		setSelectedChannel(channel);
		setActiveTab("messages");
	};

	// Handle reaction click - toggle reaction
	const handleReactionClick = async (messageId, emoji, users) => {
		if (!selectedChannel) return;

		try {
			const hasReacted = users.includes(session.user_id);
			if (hasReacted) {
				await removeReaction(
					client,
					session,
					selectedChannel.channelId,
					messageId,
					emoji
				);
				onEvent("reaction_removed", `Removed ${emoji} reaction`, "success");
			} else {
				await addReaction(
					client,
					session,
					selectedChannel.channelId,
					messageId,
					emoji
				);
				onEvent("reaction_added", `Added ${emoji} reaction`, "success");
			}
			// Reload messages to show updated reactions
			loadMessages(selectedChannel.channelId);
		} catch (error) {
			onEvent(
				"reaction_error",
				`Failed to update reaction: ${error.message}`,
				"error"
			);
		}
	};

	// Add reaction to a message (quick reaction)
	const handleAddReaction = async (messageId, emoji) => {
		if (!selectedChannel) return;

		try {
			await addReaction(
				client,
				session,
				selectedChannel.channelId,
				messageId,
				emoji
			);
			loadMessages(selectedChannel.channelId);
		} catch (error) {
			onEvent(
				"reaction_error",
				`Failed to add reaction: ${error.message}`,
				"error"
			);
		}
		setShowReactionPicker(null);
	};

	// Edit a message
	const handleEditMessage = async (messageId, newContent) => {
		if (!selectedChannel || !newContent.trim()) return;

		try {
			await editMessage(
				client,
				session,
				selectedChannel.channelId,
				messageId,
				newContent.trim()
			);
			// Update local state
			setMessages((prev) =>
				prev.map((msg) =>
					msg.messageId === messageId
						? { ...msg, content: newContent.trim(), isEdited: true }
						: msg
				)
			);
			setEditingMessage(null);
		} catch (error) {
			onEvent(
				"edit_error",
				`Failed to edit message: ${error.message}`,
				"error"
			);
		}
	};

	// Delete a message
	const handleDeleteMessage = async (messageId) => {
		if (!selectedChannel) return;

		if (!window.confirm("Are you sure you want to delete this message?")) {
			return;
		}

		try {
			await deleteMessage(
				client,
				session,
				selectedChannel.channelId,
				messageId
			);
			// Update local state to show deleted message
			setMessages((prev) =>
				prev.map((msg) =>
					msg.messageId === messageId
						? { ...msg, content: "[Message deleted]", isDeleted: true }
						: msg
				)
			);
		} catch (error) {
			onEvent(
				"delete_error",
				`Failed to delete message: ${error.message}`,
				"error"
			);
		}
	};

	// Start replying to a message
	const handleReply = (msg) => {
		setReplyingTo({
			messageId: msg.messageId,
			senderName: msg.senderName,
			content:
				msg.content.substring(0, 50) + (msg.content.length > 50 ? "..." : ""),
		});
	};

	// Cancel reply
	const cancelReply = () => {
		setReplyingTo(null);
	};

	// Start editing a message
	const startEditMessage = (msg) => {
		setEditingMessage({
			messageId: msg.messageId,
			content: msg.content,
		});
	};

	// Cancel edit
	const cancelEdit = () => {
		setEditingMessage(null);
	};

	// Toggle reaction picker for a message
	const toggleReactionPicker = (messageId) => {
		setShowReactionPicker((prev) => (prev === messageId ? null : messageId));
	};

	// Quick reactions
	const quickReactions = ["❤️", "👍", "😂", "😮", "😢", "🙏"];

	const handleAcceptRequest = async (channelId) => {
		try {
			await acceptDMRequest(client, session, channelId);
			onEvent("dm_request_accepted", "DM request accepted", "success");
			// After accepting, refresh inbox and requests
			loadChannels(channelView === "requests" ? "requests" : "inbox");
		} catch (error) {
			onEvent(
				"dm_request_error",
				`Failed to accept DM request: ${error.message}`,
				"error"
			);
		}
	};

	const handleDeclineRequest = async (channelId) => {
		try {
			await declineDMRequest(client, session, channelId);
			onEvent("dm_request_declined", "DM request declined", "info");
			// After declining, refresh requests view
			loadChannels("requests");
		} catch (error) {
			onEvent(
				"dm_request_error",
				`Failed to decline DM request: ${error.message}`,
				"error"
			);
		}
	};

	if (!session) {
		return (
			<div className="section">
				<h2>💬 Chat</h2>
				<p style={{ color: "#888" }}>Please authenticate first</p>
			</div>
		);
	}

	// Theme colors
	const theme = {
		primary: "#7C3AED", // Purple
		primaryDark: "#5B21B6",
		primaryLight: "#A78BFA",
		background: "#1E1B2E", // Dark purple background
		surface: "#2D2A3E", // Slightly lighter surface
		surfaceLight: "#3D3A4E",
		text: "#FFFFFF",
		textSecondary: "#A0A0B0",
		accent: "#10B981", // Green for online/success
		sent: "#7C3AED",
		received: "#3D3A4E",
		border: "#4A4760",
	};

	return (
		<div
			className="section"
			style={{
				backgroundColor: theme.background,
				borderRadius: "12px",
				padding: "0",
				maxWidth: "100%",
				overflow: "hidden",
			}}
		>
			<div
				style={{
					padding: "12px 16px",
					borderBottom: `1px solid ${theme.border}`,
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
				}}
			>
				<h2
					style={{
						margin: 0,
						color: theme.text,
						fontSize: "18px",
						fontWeight: "600",
					}}
				>
					💬 Chat
				</h2>
			</div>

			{/* Tabs */}
			<div
				style={{
					display: "flex",
					gap: "4px",
					padding: "8px 12px",
					borderBottom: `1px solid ${theme.border}`,
					flexWrap: "wrap",
				}}
			>
				<button
					onClick={() => setActiveTab("channels")}
					style={{
						flex: "1 1 auto",
						minWidth: "80px",
						padding: "8px 12px",
						backgroundColor:
							activeTab === "channels" ? theme.primary : theme.surface,
						color: theme.text,
						border: "none",
						borderRadius: "8px",
						cursor: "pointer",
						fontWeight: activeTab === "channels" ? "600" : "400",
						transition: "all 0.2s ease",
						fontSize: "13px",
					}}
				>
					📋 Channels
				</button>
				<button
					onClick={() => setActiveTab("create")}
					style={{
						flex: "1 1 auto",
						minWidth: "80px",
						padding: "8px 12px",
						backgroundColor:
							activeTab === "create" ? theme.primary : theme.surface,
						color: theme.text,
						border: "none",
						borderRadius: "8px",
						cursor: "pointer",
						fontWeight: activeTab === "create" ? "600" : "400",
						transition: "all 0.2s ease",
						fontSize: "13px",
					}}
				>
					➕ Create
				</button>
				{selectedChannel && (
					<button
						onClick={() => setActiveTab("messages")}
						style={{
							flex: "1 1 auto",
							minWidth: "80px",
							padding: "8px 12px",
							backgroundColor:
								activeTab === "messages" ? theme.primary : theme.surface,
							color: theme.text,
							border: "none",
							borderRadius: "8px",
							cursor: "pointer",
							fontWeight: activeTab === "messages" ? "600" : "400",
							transition: "all 0.2s ease",
							fontSize: "13px",
						}}
					>
						💬 Messages
					</button>
				)}
			</div>

			{/* Channels Tab */}
			{activeTab === "channels" && (
				<div style={{ padding: "12px 16px" }}>
					{/* Channel view filters */}
					<div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
						<button
							onClick={() => loadChannels("all")}
							style={{
								flex: 1,
								padding: "8px 12px",
								backgroundColor:
									channelView === "all" ? theme.primary : theme.surface,
								color: theme.text,
								border: "none",
								borderRadius: "6px",
								cursor: "pointer",
								fontSize: "12px",
								fontWeight: channelView === "all" ? "600" : "400",
							}}
						>
							All
						</button>
						<button
							onClick={() => loadChannels("inbox")}
							style={{
								flex: 1,
								padding: "8px 12px",
								backgroundColor:
									channelView === "inbox" ? theme.primary : theme.surface,
								color: theme.text,
								border: "none",
								borderRadius: "6px",
								cursor: "pointer",
								fontSize: "12px",
								fontWeight: channelView === "inbox" ? "600" : "400",
							}}
						>
							Inbox
						</button>
						<button
							onClick={() => loadChannels("requests")}
							style={{
								flex: 1,
								padding: "8px 12px",
								backgroundColor:
									channelView === "requests" ? theme.primary : theme.surface,
								color: theme.text,
								border: "none",
								borderRadius: "6px",
								cursor: "pointer",
								fontSize: "12px",
								fontWeight: channelView === "requests" ? "600" : "400",
							}}
						>
							Requests
						</button>
					</div>
					<button
						onClick={() => loadChannels(channelView)}
						style={{
							marginBottom: "12px",
							width: "100%",
							padding: "10px",
							backgroundColor: theme.surfaceLight,
							color: theme.text,
							border: "none",
							borderRadius: "8px",
							cursor: "pointer",
							fontSize: "13px",
						}}
						disabled={channelsLoading}
					>
						{channelsLoading ? "Loading..." : "🔄 Refresh Channels"}
					</button>
					<div
						style={{
							maxHeight: "calc(100vh - 350px)",
							minHeight: "200px",
							overflowY: "auto",
						}}
					>
						{channels.length === 0 ? (
							<p style={{ color: theme.textSecondary, textAlign: "center" }}>
								No channels yet
							</p>
						) : (
							channels.map((channel) => {
								const isSelectedChannel =
									selectedChannel?.channelId === channel.channelId;
								const isRequest = channel.isRequest;
								const isPendingRequest =
									isRequest && channel.requestStatus === "pending";
								const isIncomingRequest =
									isPendingRequest &&
									channel.requestRecipientId === session.user_id;

								// Get online status for the other participant (for DMs)
								const otherParticipant = (channel.participantIds || []).find(
									(id) => id !== session.user_id
								);
								const otherUserStatus = otherParticipant
									? onlineStatuses[otherParticipant]
									: null;
								const isOtherOnline = otherUserStatus?.isOnline;

								return (
									<div
										key={channel.channelId}
										onClick={() => handleSelectChannel(channel)}
										style={{
											padding: "14px",
											marginBottom: "8px",
											backgroundColor: isSelectedChannel
												? theme.primary + "30"
												: theme.surface,
											borderRadius: "10px",
											border: isSelectedChannel
												? `1px solid ${theme.primary}`
												: "none",
											cursor: "pointer",
											transition: "all 0.2s ease",
										}}
									>
										<div
											style={{
												display: "flex",
												justifyContent: "space-between",
												alignItems: "center",
												marginBottom: "6px",
											}}
										>
											<div
												style={{
													fontWeight: "600",
													display: "flex",
													alignItems: "center",
													gap: "8px",
													color: theme.text,
													fontSize: "14px",
												}}
											>
												{/* Avatar placeholder */}
												<div
													style={{
														width: "40px",
														height: "40px",
														borderRadius: "50%",
														backgroundColor: theme.primaryLight,
														display: "flex",
														alignItems: "center",
														justifyContent: "center",
														fontSize: "16px",
														position: "relative",
													}}
												>
													{channel.channelType === "bot"
														? "🤖"
														: channel.channelType === "group"
														? "👥"
														: "👤"}
													{channel.channelType === "direct" && (
														<span
															style={{
																position: "absolute",
																bottom: "0",
																right: "0",
																width: "12px",
																height: "12px",
																borderRadius: "50%",
																backgroundColor: isOtherOnline
																	? theme.accent
																	: theme.textSecondary,
																border: `2px solid ${theme.surface}`,
															}}
															title={isOtherOnline ? "Online" : "Offline"}
														/>
													)}
												</div>
												<span>{channel.name || "Direct Message"}</span>
											</div>
											{channel.lastMessageAt && (
												<span
													style={{
														fontSize: "11px",
														color: theme.textSecondary,
													}}
												>
													{formatTimestamp(channel.lastMessageAt)}
												</span>
											)}
										</div>
										{isRequest && (
											<div
												style={{
													fontSize: "11px",
													color: theme.primaryLight,
													marginBottom: "4px",
													marginLeft: "48px",
												}}
											>
												Request ({channel.requestStatus || "pending"})
											</div>
										)}
										{channel.lastMessageText && (
											<div
												style={{
													fontSize: "13px",
													color: theme.textSecondary,
													marginTop: "2px",
													marginLeft: "48px",
													display: "flex",
													justifyContent: "space-between",
													alignItems: "center",
												}}
											>
												<span style={{ opacity: 0.8 }}>
													{channel.lastMessageText.substring(0, 40)}
													{channel.lastMessageText.length > 40 ? "..." : ""}
												</span>
												{channel.unreadCount > 0 && (
													<span
														style={{
															backgroundColor: theme.primary,
															color: theme.text,
															borderRadius: "12px",
															padding: "2px 8px",
															fontSize: "11px",
															fontWeight: "600",
															minWidth: "20px",
															textAlign: "center",
														}}
													>
														{channel.unreadCount}
													</span>
												)}
											</div>
										)}
										{isIncomingRequest && (
											<div
												style={{
													marginTop: "8px",
													marginLeft: "48px",
													display: "flex",
													gap: "8px",
													fontSize: "12px",
												}}
											>
												<button
													onClick={(e) => {
														e.stopPropagation();
														handleAcceptRequest(channel.channelId);
													}}
													style={{
														flex: 1,
														padding: "6px 12px",
														backgroundColor: theme.accent,
														color: theme.text,
														border: "none",
														borderRadius: "6px",
														cursor: "pointer",
														fontWeight: "500",
													}}
												>
													Accept
												</button>
												<button
													onClick={(e) => {
														e.stopPropagation();
														handleDeclineRequest(channel.channelId);
													}}
													style={{
														flex: 1,
														padding: "6px 12px",
														backgroundColor: "#dc3545",
														color: theme.text,
														border: "none",
														borderRadius: "6px",
														cursor: "pointer",
													}}
												>
													Decline
												</button>
											</div>
										)}
									</div>
								);
							})
						)}
					</div>
				</div>
			)}

			{/* Create Channel Tab */}
			{activeTab === "create" && (
				<div style={{ padding: "16px" }}>
					<div style={{ marginBottom: "16px" }}>
						<label
							style={{
								display: "block",
								marginBottom: "6px",
								color: theme.text,
								fontWeight: "500",
							}}
						>
							Channel Type:
						</label>
						<select
							value={channelType}
							onChange={(e) => setChannelType(e.target.value)}
							style={{
								width: "100%",
								padding: "10px 12px",
								borderRadius: "8px",
								border: `1px solid ${theme.border}`,
								backgroundColor: theme.surface,
								color: theme.text,
								fontSize: "14px",
							}}
						>
							<option value="direct">Direct Message</option>
							<option value="group">Group Chat</option>
							<option value="bot">Bot Chat</option>
						</select>
					</div>

					<div style={{ marginBottom: "16px" }}>
						<label
							style={{
								display: "block",
								marginBottom: "6px",
								color: theme.text,
								fontWeight: "500",
							}}
						>
							Channel Name{" "}
							{channelType === "direct" ? "(optional)" : "(required)"}:
						</label>
						<input
							type="text"
							value={channelName}
							onChange={(e) => setChannelName(e.target.value)}
							placeholder="My Channel"
							style={{
								width: "100%",
								padding: "10px 12px",
								borderRadius: "8px",
								border: `1px solid ${theme.border}`,
								backgroundColor: theme.surface,
								color: theme.text,
								fontSize: "14px",
								boxSizing: "border-box",
							}}
						/>
					</div>

					<div style={{ marginBottom: "16px" }}>
						<label
							style={{
								display: "block",
								marginBottom: "6px",
								color: theme.text,
								fontWeight: "500",
							}}
						>
							Participant User IDs (comma-separated):
						</label>
						<input
							type="text"
							value={participantIds}
							onChange={(e) => setParticipantIds(e.target.value)}
							placeholder="user_id_1, user_id_2"
							style={{
								width: "100%",
								padding: "10px 12px",
								borderRadius: "8px",
								border: `1px solid ${theme.border}`,
								backgroundColor: theme.surface,
								color: theme.text,
								fontSize: "14px",
								boxSizing: "border-box",
							}}
						/>
						<small
							style={{
								color: theme.textSecondary,
								fontSize: "12px",
								marginTop: "4px",
								display: "block",
							}}
						>
							For bot chat, use bot user IDs like bot_1, bot_2, etc.
						</small>
					</div>

					<button
						onClick={handleCreateChannel}
						style={{
							width: "100%",
							padding: "12px",
							borderRadius: "8px",
							border: "none",
							backgroundColor: theme.primary,
							color: theme.text,
							fontSize: "14px",
							fontWeight: "500",
							cursor: "pointer",
						}}
					>
						➕ Create Channel
					</button>
				</div>
			)}

			{/* Messages Tab */}
			{activeTab === "messages" && selectedChannel && (
				<div style={{ padding: "0" }}>
					{/* Chat Header with Online Status */}
					<ChatHeader
						selectedChannel={selectedChannel}
						session={session}
						onlineStatuses={onlineStatuses}
						formatTimestamp={formatTimestamp}
						onRefresh={() => loadMessages(selectedChannel.channelId)}
						theme={theme}
					/>

					{/* Messages List */}
					<div
						style={{
							height: "calc(100vh - 400px)",
							minHeight: "250px",
							maxHeight: "500px",
							overflowY: "auto",
							backgroundColor: theme.background,
							padding: "16px",
							marginBottom: "0",
						}}
					>
						{messagesLoading ? (
							<p style={{ textAlign: "center", color: theme.textSecondary }}>
								Loading messages...
							</p>
						) : messages.length === 0 ? (
							<p style={{ textAlign: "center", color: theme.textSecondary }}>
								No messages yet. Start the conversation!
							</p>
						) : (
							messages.map((msg) => {
								const isMyMessage = msg.senderId === session.user_id;
								const isStoryReply = !!msg.storyId;
								const isDeleted = msg.isDeleted;
								const isEditing = editingMessage?.messageId === msg.messageId;

								return (
									<div
										key={msg.messageId}
										style={{
											marginBottom: "12px",
											display: "flex",
											justifyContent: isMyMessage ? "flex-end" : "flex-start",
											position: "relative",
										}}
									>
										<div
											style={{
												maxWidth: "85%",
												minWidth: "60px",
												padding: "8px 12px",
												borderRadius: isMyMessage
													? "16px 16px 4px 16px"
													: "16px 16px 16px 4px",
												backgroundColor: isDeleted
													? theme.surfaceLight
													: isMyMessage
													? theme.primary
													: theme.surface,
												color: isDeleted ? theme.textSecondary : theme.text,
												fontStyle: isDeleted ? "italic" : "normal",
												position: "relative",
												boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
												wordBreak: "break-word",
												overflowWrap: "break-word",
											}}
										>
											{!isMyMessage && (
												<div
													style={{
														fontSize: "11px",
														fontWeight: "600",
														marginBottom: "3px",
														color: theme.primaryLight,
													}}
												>
													{msg.senderName || "Unknown"}
												</div>
											)}
											{isStoryReply && !isDeleted && (
												<div
													style={{
														fontSize: "11px",
														marginBottom: "6px",
														padding: "6px 8px",
														borderRadius: "8px",
														backgroundColor: isMyMessage
															? "rgba(255,255,255,0.15)"
															: theme.surfaceLight,
													}}
												>
													<div
														style={{
															fontWeight: "600",
															marginBottom: "2px",
															color: theme.primaryLight,
														}}
													>
														📸 Replied to a story
													</div>
													{msg.storyMediaUrl && (
														<div style={{ marginBottom: "2px" }}>
															{msg.storyMediaType === "image" ? (
																<img
																	src={msg.storyMediaUrl}
																	alt="Story"
																	style={{
																		maxWidth: "100px",
																		borderRadius: "6px",
																	}}
																/>
															) : (
																<span>
																	🎬 {msg.storyMediaType || "story media"}
																</span>
															)}
														</div>
													)}
													{msg.storyCaption && (
														<div style={{ fontStyle: "italic", opacity: 0.8 }}>
															{msg.storyCaption}
														</div>
													)}
												</div>
											)}

											{/* Reply preview (if this message is a reply) */}
											{(msg.replyToId || msg.replyToContent) && !isDeleted && (
												<div
													style={{
														fontSize: "12px",
														marginBottom: "6px",
														padding: "6px 10px",
														borderRadius: "8px",
														backgroundColor: isMyMessage
															? "rgba(255,255,255,0.1)"
															: theme.surfaceLight,
														borderLeft: `3px solid ${theme.primaryLight}`,
													}}
												>
													<div
														style={{
															fontWeight: "600",
															marginBottom: "2px",
															color: theme.primaryLight,
															fontSize: "11px",
														}}
													>
														↩️ {msg.replyToSenderName || "Reply"}
													</div>
													<div style={{ opacity: 0.7, fontSize: "11px" }}>
														{msg.replyToContent || "..."}
													</div>
												</div>
											)}

											{/* Message content or edit form */}
											{isEditing ? (
												<div
													style={{
														display: "flex",
														flexDirection: "column",
														gap: "6px",
													}}
												>
													<input
														type="text"
														value={editingMessage.content}
														onChange={(e) =>
															setEditingMessage((prev) => ({
																...prev,
																content: e.target.value,
															}))
														}
														style={{
															padding: "8px 10px",
															borderRadius: "6px",
															border: "none",
															backgroundColor: theme.surfaceLight,
															color: theme.text,
														}}
														autoFocus
													/>
													<div style={{ display: "flex", gap: "6px" }}>
														<button
															onClick={() =>
																handleEditMessage(
																	msg.messageId,
																	editingMessage.content
																)
															}
															style={{
																padding: "4px 12px",
																fontSize: "12px",
																backgroundColor: theme.accent,
																color: theme.text,
																border: "none",
																borderRadius: "6px",
																cursor: "pointer",
																fontWeight: "500",
															}}
														>
															Save
														</button>
														<button
															onClick={cancelEdit}
															style={{
																padding: "4px 12px",
																fontSize: "12px",
																backgroundColor: theme.surfaceLight,
																color: theme.text,
																border: "none",
																borderRadius: "6px",
																cursor: "pointer",
															}}
														>
															Cancel
														</button>
													</div>
												</div>
											) : (
												<div style={{ fontSize: "14px", lineHeight: "1.4" }}>
													{msg.content}
												</div>
											)}

											{/* Edited indicator */}
											{msg.isEdited && !isDeleted && !isEditing && (
												<span
													style={{
														fontSize: "10px",
														opacity: 0.5,
														marginLeft: "4px",
														fontStyle: "italic",
													}}
												>
													(edited)
												</span>
											)}

											{/* Reactions display */}
											{!isDeleted &&
												msg.reactions &&
												Object.keys(msg.reactions).length > 0 && (
													<div
														style={{
															display: "flex",
															flexWrap: "wrap",
															gap: "4px",
															marginTop: "6px",
														}}
													>
														{Object.entries(msg.reactions).map(
															([emoji, users]) => (
																<span
																	key={emoji}
																	style={{
																		fontSize: "13px",
																		padding: "3px 8px",
																		borderRadius: "12px",
																		backgroundColor: isMyMessage
																			? "rgba(255,255,255,0.15)"
																			: theme.surfaceLight,
																		cursor: "pointer",
																		transition: "transform 0.1s ease",
																	}}
																	onClick={() =>
																		handleReactionClick(
																			msg.messageId,
																			emoji,
																			users
																		)
																	}
																	title={`${users.length} reaction(s)`}
																>
																	{emoji} {users.length}
																</span>
															)
														)}
													</div>
												)}

											{/* Message actions row */}
											{!isDeleted && !isEditing && (
												<div
													style={{
														display: "flex",
														gap: "8px",
														marginTop: "6px",
														fontSize: "14px",
													}}
												>
													<button
														onClick={() => toggleReactionPicker(msg.messageId)}
														style={{
															background: "none",
															border: "none",
															cursor: "pointer",
															padding: "2px 4px",
															opacity: 0.6,
															transition: "opacity 0.2s ease",
														}}
														title="Add reaction"
													>
														😊
													</button>
													<button
														onClick={() => handleReply(msg)}
														style={{
															background: "none",
															border: "none",
															cursor: "pointer",
															padding: "2px 4px",
															opacity: 0.6,
															transition: "opacity 0.2s ease",
														}}
														title="Reply"
													>
														↩️
													</button>
													{isMyMessage && (
														<>
															<button
																onClick={() => startEditMessage(msg)}
																style={{
																	background: "none",
																	border: "none",
																	cursor: "pointer",
																	padding: "2px 4px",
																	opacity: 0.6,
																	transition: "opacity 0.2s ease",
																}}
																title="Edit"
															>
																✏️
															</button>
															<button
																onClick={() =>
																	handleDeleteMessage(msg.messageId)
																}
																style={{
																	background: "none",
																	border: "none",
																	cursor: "pointer",
																	padding: "2px 4px",
																	opacity: 0.6,
																	transition: "opacity 0.2s ease",
																}}
																title="Delete"
															>
																🗑️
															</button>
														</>
													)}
												</div>
											)}

											{/* Quick reaction picker */}
											{showReactionPicker === msg.messageId && (
												<div
													style={{
														display: "flex",
														gap: "6px",
														marginTop: "6px",
														padding: "6px 8px",
														backgroundColor: isMyMessage
															? "rgba(255,255,255,0.15)"
															: theme.surfaceLight,
														borderRadius: "12px",
													}}
												>
													{quickReactions.map((emoji) => (
														<button
															key={emoji}
															onClick={() =>
																handleAddReaction(msg.messageId, emoji)
															}
															style={{
																background: "none",
																border: "none",
																cursor: "pointer",
																fontSize: "18px",
																padding: "2px 4px",
																transition: "transform 0.1s ease",
															}}
														>
															{emoji}
														</button>
													))}
												</div>
											)}

											{/* Timestamp and status */}
											<div
												style={{
													fontSize: "10px",
													marginTop: "6px",
													display: "flex",
													justifyContent: "flex-end",
													alignItems: "center",
													gap: "6px",
													opacity: 0.6,
												}}
											>
												<span>{formatTimestamp(msg.createdAt)}</span>
												{isMyMessage && (
													<span
														style={{
															fontSize: "12px",
															fontWeight: "600",
															color:
																msg.status === "seen" || msg.isRead
																	? "#60A5FA"
																	: msg.status === "failed"
																	? "#EF4444"
																	: msg.status === "pending"
																	? "#FBBF24"
																	: msg.status === "delivered"
																	? theme.accent
																	: "rgba(255,255,255,0.7)",
														}}
														title={`Status: ${msg.status || "sent"}`}
													>
														{getStatusIcon(msg.status, msg.isRead)}
													</span>
												)}
											</div>
										</div>
									</div>
								);
							})
						)}
						<div ref={messagesEndRef} />
					</div>

					{/* Typing indicator */}
					{typingUser && (
						<div
							style={{
								fontSize: "13px",
								color: theme.textSecondary,
								padding: "8px 16px",
								fontStyle: "italic",
							}}
						>
							{typingUser} is typing...
						</div>
					)}

					{/* Reply preview */}
					{replyingTo && (
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								padding: "10px 16px",
								backgroundColor: theme.surface,
								marginBottom: "0",
								borderLeft: `3px solid ${theme.primaryLight}`,
							}}
						>
							<div style={{ flex: 1 }}>
								<div
									style={{
										fontSize: "12px",
										fontWeight: "600",
										color: theme.primaryLight,
									}}
								>
									↩️ Replying to {replyingTo.senderName}
								</div>
								<div
									style={{
										fontSize: "12px",
										color: theme.textSecondary,
										marginTop: "2px",
									}}
								>
									{replyingTo.content}
								</div>
							</div>
							<button
								onClick={cancelReply}
								style={{
									background: "none",
									border: "none",
									cursor: "pointer",
									fontSize: "18px",
									padding: "4px 8px",
									color: theme.textSecondary,
								}}
							>
								✕
							</button>
						</div>
					)}

					{/* Message Input */}
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "6px",
							padding: "10px 12px",
							backgroundColor: theme.surface,
							borderTop: `1px solid ${theme.border}`,
							flexWrap: "nowrap",
						}}
					>
						{/* Plus button for attachments - hidden on very small screens */}
						<button
							style={{
								width: "36px",
								height: "36px",
								minWidth: "36px",
								borderRadius: "50%",
								border: "none",
								backgroundColor: theme.surfaceLight,
								color: theme.text,
								cursor: "pointer",
								fontSize: "18px",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								flexShrink: 0,
							}}
							title="Add attachment"
						>
							+
						</button>

						{/* Input container */}
						<div
							style={{
								flex: 1,
								minWidth: 0,
								display: "flex",
								alignItems: "center",
								backgroundColor: theme.surfaceLight,
								borderRadius: "24px",
								padding: "0 10px",
							}}
						>
							<input
								type="text"
								value={messageInput}
								onChange={handleMessageInputChange}
								onBlur={() => {
									if (typingActiveRef.current && selectedChannel) {
										typingActiveRef.current = false;
										if (typingTimeoutRef.current) {
											clearTimeout(typingTimeoutRef.current);
											typingTimeoutRef.current = null;
										}
										try {
											sendTypingIndicator(
												client,
												session,
												selectedChannel.channelId,
												false
											);
										} catch (error) {
											console.error(
												"Failed to clear typing indicator on blur",
												error
											);
										}
									}
								}}
								placeholder="Type your message..."
								style={{
									flex: 1,
									padding: "12px 8px",
									border: "none",
									backgroundColor: "transparent",
									color: theme.text,
									fontSize: "14px",
									outline: "none",
								}}
								onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
							/>

							{/* Input icons - hidden on small screens to save space */}
							<div
								style={{
									display: "flex",
									gap: "4px",
									alignItems: "center",
									flexShrink: 0,
								}}
							>
								<button
									style={{
										background: "none",
										border: "none",
										cursor: "pointer",
										fontSize: "16px",
										padding: "4px",
										opacity: 0.6,
									}}
									title="Camera"
								>
									📷
								</button>
								<button
									style={{
										background: "none",
										border: "none",
										cursor: "pointer",
										fontSize: "16px",
										padding: "4px",
										opacity: 0.6,
									}}
									title="Voice"
								>
									🎤
								</button>
							</div>
						</div>

						{/* Send button */}
						<button
							onClick={handleSendMessage}
							style={{
								width: "40px",
								height: "40px",
								minWidth: "40px",
								borderRadius: "50%",
								border: "none",
								backgroundColor: theme.accent,
								color: "#fff",
								cursor: "pointer",
								fontSize: "16px",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								flexShrink: 0,
							}}
							title="Send message"
						>
							➤
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

export default ChatSection;
