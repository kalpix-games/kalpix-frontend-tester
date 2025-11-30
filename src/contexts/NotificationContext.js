import {
	createContext,
	useContext,
	useState,
	useEffect,
	useCallback,
} from "react";

const NotificationContext = createContext();

// Notification codes (must match backend config/constants.go)
export const NOTIFICATION_CODES = {
	FOLLOW_REQUEST: 10,
	FOLLOW_ACCEPTED: 11,
	FOLLOW_REQUEST_CANCELLED: 12,
	FOLLOW_REQUEST_ACCEPTED_SELF: 13,
	FOLLOW_REQUEST_REJECTED_SELF: 14,
	FOLLOW_REJECTED: 15, // Notify requester that their request was rejected
	CHAT_MESSAGE: 20,
	DM_REQUEST: 21,
	NEW_CHANNEL: 22,
	TYPING_INDICATOR: 23,
	READ_RECEIPT: 24,
	MESSAGE_UPDATE: 25,
	MESSAGE_DELETE: 26,
	REACTION_UPDATE: 27,
	DELIVERY_RECEIPT: 28,
	MESSAGE_STATUS_UPDATE: 29,
	NEW_POST: 30,
	NEW_STORY: 31,
	POST_LIKE: 32,
	POST_COMMENT: 33,
	COMMENT_REPLY: 34,
	GAME_INVITE: 40,
	GAME_START: 41,
	PRESENCE_UPDATE: 50,
};

// Custom event emitter for real-time updates
const eventListeners = {};

export const subscribeToEvent = (eventName, callback) => {
	if (!eventListeners[eventName]) {
		eventListeners[eventName] = [];
	}
	eventListeners[eventName].push(callback);

	// Return unsubscribe function
	return () => {
		eventListeners[eventName] = eventListeners[eventName].filter(
			(cb) => cb !== callback
		);
	};
};

export const emitEvent = (eventName, data) => {
	if (eventListeners[eventName]) {
		eventListeners[eventName].forEach((callback) => callback(data));
	}
};

export const useNotifications = () => {
	const context = useContext(NotificationContext);
	if (!context) {
		throw new Error(
			"useNotifications must be used within NotificationProvider"
		);
	}
	return context;
};

export const NotificationProvider = ({ children, socket, client, session }) => {
	const [notifications, setNotifications] = useState([]);
	const [unreadCount, setUnreadCount] = useState(0);
	const [followRequestCount, setFollowRequestCount] = useState(0);
	const [dmRequestCount, setDmRequestCount] = useState(0);
	const [onlineUsers, setOnlineUsers] = useState({}); // userId -> { isOnline, lastSeenAt }

	// Helper function to mark messages as delivered
	const markMessageAsDelivered = useCallback(
		async (channelId, messageId) => {
			if (!client || !session) {
				console.log(
					"📬 markMessageAsDelivered skipped - no client or session",
					{ hasClient: !!client, hasSession: !!session }
				);
				return;
			}
			console.log("📬 Calling mark_delivered RPC:", { channelId, messageId });
			try {
				const response = await client.rpc(session, "chat/mark_delivered", {
					channel_id: channelId,
					message_ids: [messageId],
				});
				console.log(
					"📬 Marked message as delivered - RPC response:",
					messageId,
					response
				);
			} catch (err) {
				console.error("📬 Failed to mark message as delivered:", err);
			}
		},
		[client, session]
	);

	// Sync pending messages when user comes online (socket connects)
	useEffect(() => {
		const syncPendingMessages = async () => {
			if (!client || !session) {
				console.log("📬 syncPendingMessages skipped - no client or session");
				return;
			}

			try {
				console.log("📬 Syncing pending messages on connect...");
				const response = await client.rpc(session, "chat/sync_and_deliver", {});
				const result = JSON.parse(response.payload || "{}");
				console.log("📬 Synced pending messages:", result);
				if (result.delivered > 0) {
					console.log(`📬 Marked ${result.delivered} messages as delivered`);
				}
			} catch (err) {
				console.error("📬 Failed to sync pending messages:", err);
			}
		};

		if (socket && client && session) {
			// Sync pending messages when socket connects
			syncPendingMessages();
		}
	}, [socket, client, session]);

	// Handle incoming notifications from Nakama
	useEffect(() => {
		if (!socket) {
			console.log("🔌 NotificationContext: socket not available yet");
			return;
		}

		console.log("🔌 NotificationContext: Setting up socket handlers");

		const handleNotification = (notification) => {
			console.log("📬 Received notification:", notification);

			const newNotification = {
				id: notification.id,
				subject: notification.subject,
				content:
					typeof notification.content === "string"
						? JSON.parse(notification.content)
						: notification.content,
				code: notification.code,
				sender_id: notification.sender_id,
				create_time: notification.create_time,
				persistent: notification.persistent,
				read: false,
			};

			// Handle different notification types and emit events
			switch (notification.code) {
				case NOTIFICATION_CODES.FOLLOW_REQUEST:
					setFollowRequestCount((prev) => prev + 1);
					emitEvent("follow_request", newNotification.content);
					break;

				case NOTIFICATION_CODES.FOLLOW_ACCEPTED:
					// Someone accepted your follow request - remove from sent requests
					emitEvent("follow_accepted", newNotification.content);
					break;

				case NOTIFICATION_CODES.FOLLOW_REQUEST_CANCELLED:
					// Someone cancelled their follow request to you - remove from received
					setFollowRequestCount((prev) => Math.max(0, prev - 1));
					emitEvent("follow_request_cancelled", newNotification.content);
					break;

				case NOTIFICATION_CODES.FOLLOW_REQUEST_ACCEPTED_SELF:
					// You accepted a follow request - remove from received
					setFollowRequestCount((prev) => Math.max(0, prev - 1));
					emitEvent("follow_request_accepted_self", newNotification.content);
					break;

				case NOTIFICATION_CODES.FOLLOW_REQUEST_REJECTED_SELF:
					// You rejected a follow request - remove from received
					setFollowRequestCount((prev) => Math.max(0, prev - 1));
					emitEvent("follow_request_rejected_self", newNotification.content);
					break;

				case NOTIFICATION_CODES.FOLLOW_REJECTED:
					// Someone rejected your follow request - update UI
					emitEvent("follow_rejected", newNotification.content);
					break;

				case NOTIFICATION_CODES.CHAT_MESSAGE:
					emitEvent("chat_message", newNotification.content);
					// Also emit as new_message for ChatConversationPage compatibility
					// The content has: channel_id, content, message_id, sender_id, sender_name, etc.
					emitEvent("new_message", {
						message: {
							channelId: newNotification.content.channel_id,
							messageId: newNotification.content.message_id,
							senderId: newNotification.content.sender_id,
							senderName: newNotification.content.sender_name,
							content: newNotification.content.content,
							messageType: newNotification.content.message_type,
							status: newNotification.content.status || "sent",
							createdAt: newNotification.content.created_at,
							updatedAt: newNotification.content.updated_at,
							// Reply context (if this message is a reply)
							replyToId: newNotification.content.reply_to_id,
							replyToSenderName: newNotification.content.reply_to_sender_name,
							replyToContent: newNotification.content.reply_to_content,
						},
						channelId: newNotification.content.channel_id,
					});
					// Mark message as delivered when received (even if not viewing the chat)
					// This triggers the double tick on sender's side
					markMessageAsDelivered(
						newNotification.content.channel_id,
						newNotification.content.message_id
					);
					break;

				case NOTIFICATION_CODES.DM_REQUEST:
					setDmRequestCount((prev) => prev + 1);
					emitEvent("dm_request", newNotification.content);
					break;

				case NOTIFICATION_CODES.NEW_CHANNEL:
					emitEvent("new_channel", newNotification.content);
					break;

				case NOTIFICATION_CODES.TYPING_INDICATOR:
					console.log("📝 Typing indicator received:", newNotification.content);
					emitEvent("typing_indicator", newNotification.content);
					break;

				case NOTIFICATION_CODES.READ_RECEIPT:
					console.log("✓ Read receipt received:", newNotification.content);
					emitEvent("read_receipt", newNotification.content);
					// Also emit as message_status for ChatConversationPage
					emitEvent("message_status", {
						channelId: newNotification.content.channel_id,
						messageId: newNotification.content.message_id,
						status: "seen",
					});
					break;

				case NOTIFICATION_CODES.MESSAGE_UPDATE:
					console.log("✏️ Message update received:", newNotification.content);
					emitEvent("message_update", newNotification.content);
					break;

				case NOTIFICATION_CODES.MESSAGE_DELETE:
					console.log("🗑️ Message delete received:", newNotification.content);
					emitEvent("message_delete", newNotification.content);
					break;

				case NOTIFICATION_CODES.REACTION_UPDATE:
					console.log("😀 Reaction update received:", newNotification.content);
					emitEvent("reaction_update", newNotification.content);
					break;

				case NOTIFICATION_CODES.DELIVERY_RECEIPT:
					console.log("📬 Delivery receipt received:", newNotification.content);
					emitEvent("delivery_receipt", newNotification.content);
					// Also emit as message_status for ChatConversationPage
					emitEvent("message_status", {
						channelId: newNotification.content.channel_id,
						messageId: newNotification.content.message_id,
						status: "delivered",
					});
					break;

				case NOTIFICATION_CODES.MESSAGE_STATUS_UPDATE:
					console.log(
						"📊 Message status update received:",
						newNotification.content
					);
					emitEvent("message_status_update", newNotification.content);
					break;

				case NOTIFICATION_CODES.NEW_POST:
					emitEvent("new_post", newNotification.content);
					break;

				case NOTIFICATION_CODES.NEW_STORY:
					emitEvent("new_story", newNotification.content);
					break;

				case NOTIFICATION_CODES.POST_LIKE:
					emitEvent("post_like", newNotification.content);
					break;

				case NOTIFICATION_CODES.POST_COMMENT:
					emitEvent("post_comment", newNotification.content);
					break;

				case NOTIFICATION_CODES.COMMENT_REPLY:
					emitEvent("comment_reply", newNotification.content);
					break;

				case NOTIFICATION_CODES.PRESENCE_UPDATE:
					// Update online status in state
					const { userId, isOnline, timestamp } = newNotification.content;
					setOnlineUsers((prev) => ({
						...prev,
						[userId]: { isOnline, lastSeenAt: timestamp },
					}));
					emitEvent("presence_update", newNotification.content);
					break;

				default:
					// Handle any other subject-based notifications
					console.log(
						"Unhandled notification code:",
						notification.code,
						notification.subject
					);
					break;
			}

			// Add to notifications list (for persistent notifications)
			if (notification.persistent !== false) {
				setNotifications((prev) => [newNotification, ...prev]);
				setUnreadCount((prev) => prev + 1);
			}

			// Show browser notification if permitted
			if (Notification.permission === "granted") {
				new Notification("Kalpix Games", {
					body: newNotification.content.message || "New notification",
					icon: "/logo192.png",
				});
			}
		};

		// Listen for notifications
		socket.onnotification = handleNotification;

		// Listen for stream data (real-time chat messages, typing indicators, etc.)
		const handleStreamData = (streamData) => {
			console.log("📡 NotificationContext: onstreamdata triggered", streamData);
			try {
				// Stream mode 1 = chat channel
				const mode = streamData.stream?.mode || streamData.mode;
				console.log("📡 Stream mode:", mode);
				if (parseInt(mode) !== 1) {
					console.log("📡 Skipping non-chat stream (mode != 1)");
					return; // Not a chat stream
				}

				let payload;
				try {
					payload = JSON.parse(streamData.data);
				} catch (e) {
					console.warn("Failed to parse stream data", e);
					return;
				}

				if (!payload || !payload.type) {
					return;
				}

				const channelId = streamData.stream?.subject || streamData.subject;
				console.log(
					"📡 Stream data received:",
					payload.type,
					"for channel:",
					channelId
				);

				// Emit events based on stream data type
				switch (payload.type) {
					case "new_message":
						// Include channelId in the emitted data
						emitEvent("new_message", { ...payload, channelId });
						// Also mark as delivered when receiving via stream
						// (ChatConversationPage does this too, but this covers edge cases)
						if (
							payload.message?.messageId &&
							payload.message?.senderId !== session?.user_id
						) {
							markMessageAsDelivered(channelId, payload.message.messageId);
						} else if (
							payload.messageId &&
							payload.senderId !== session?.user_id
						) {
							markMessageAsDelivered(channelId, payload.messageId);
						}
						break;
					case "typing_indicator":
						emitEvent("typing_indicator", { ...payload.data, channelId });
						break;
					case "read_receipt":
						// Backend sends message_id directly in payload, not in payload.data
						emitEvent("read_receipt", { ...payload, channelId });
						// Also emit as message_status for ChatConversationPage
						emitEvent("message_status", {
							channelId: payload.channel_id || channelId,
							messageId: payload.message_id,
							status: "seen",
						});
						console.log("📗 Read receipt: message", payload.message_id, "seen");
						break;
					case "delivery_receipt":
						// Backend sends message_id directly in payload, not in payload.data
						emitEvent("delivery_receipt", { ...payload, channelId });
						// Also emit as message_status for ChatConversationPage
						emitEvent("message_status", {
							channelId: payload.channel_id || channelId,
							messageId: payload.message_id,
							status: "delivered",
						});
						console.log(
							"📬 Delivery receipt: message",
							payload.message_id,
							"delivered"
						);
						break;
					case "message_update":
						emitEvent("message_update", { ...payload.data, channelId });
						break;
					case "message_delete":
						// Support both payload.data and flat payload shapes
						const deleteData = payload.data || payload;
						emitEvent("message_delete", { ...deleteData, channelId });
						break;
					case "reaction_update":
						// Support both payload.data and flat payload shapes
						const reactionData = payload.data || payload;
						emitEvent("reaction_update", { ...reactionData, channelId });
						break;
					default:
						console.log("Unhandled stream data type:", payload.type);
				}
			} catch (e) {
				console.error("Error handling stream data:", e);
			}
		};

		socket.onstreamdata = handleStreamData;
		console.log("🔌 NotificationContext: onstreamdata handler set");

		// Request browser notification permission
		if (Notification.permission === "default") {
			Notification.requestPermission();
		}

		return () => {
			console.log("🔌 NotificationContext: Cleaning up socket handlers");
			socket.onnotification = null;
			socket.onstreamdata = null;
		};
	}, [socket, client, session, markMessageAsDelivered]);

	const markAsRead = useCallback((notificationId) => {
		setNotifications((prev) =>
			prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
		);
		setUnreadCount((prev) => Math.max(0, prev - 1));
	}, []);

	const markAllAsRead = useCallback(() => {
		setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
		setUnreadCount(0);
	}, []);

	const clearNotification = useCallback((notificationId) => {
		setNotifications((prev) => {
			const notification = prev.find((n) => n.id === notificationId);
			if (notification && !notification.read) {
				setUnreadCount((count) => Math.max(0, count - 1));
			}
			return prev.filter((n) => n.id !== notificationId);
		});
	}, []);

	const clearAllNotifications = useCallback(() => {
		setNotifications([]);
		setUnreadCount(0);
		setFollowRequestCount(0);
		setDmRequestCount(0);
	}, []);

	const decrementFollowRequestCount = useCallback(() => {
		setFollowRequestCount((prev) => Math.max(0, prev - 1));
	}, []);

	const decrementDmRequestCount = useCallback(() => {
		setDmRequestCount((prev) => Math.max(0, prev - 1));
	}, []);

	const initializeDmRequestCount = useCallback((count) => {
		setDmRequestCount(count);
	}, []);

	const updateUserOnlineStatus = useCallback((userId, isOnline, lastSeenAt) => {
		setOnlineUsers((prev) => ({
			...prev,
			[userId]: { isOnline, lastSeenAt },
		}));
	}, []);

	const getUserOnlineStatus = useCallback(
		(userId) => {
			return onlineUsers[userId] || { isOnline: false, lastSeenAt: 0 };
		},
		[onlineUsers]
	);

	const value = {
		notifications,
		unreadCount,
		followRequestCount,
		dmRequestCount,
		onlineUsers,
		markAsRead,
		markAllAsRead,
		clearNotification,
		clearAllNotifications,
		decrementFollowRequestCount,
		decrementDmRequestCount,
		initializeDmRequestCount,
		updateUserOnlineStatus,
		getUserOnlineStatus,
	};

	return (
		<NotificationContext.Provider value={value}>
			{children}
		</NotificationContext.Provider>
	);
};
