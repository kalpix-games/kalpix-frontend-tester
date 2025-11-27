import React, {
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
	CHAT_MESSAGE: 20,
	DM_REQUEST: 21,
	NEW_CHANNEL: 22,
	TYPING_INDICATOR: 23,
	READ_RECEIPT: 24,
	MESSAGE_UPDATE: 25,
	MESSAGE_DELETE: 26,
	REACTION_UPDATE: 27,
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

const emitEvent = (eventName, data) => {
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

export const NotificationProvider = ({ children, socket }) => {
	const [notifications, setNotifications] = useState([]);
	const [unreadCount, setUnreadCount] = useState(0);
	const [followRequestCount, setFollowRequestCount] = useState(0);
	const [dmRequestCount, setDmRequestCount] = useState(0);
	const [onlineUsers, setOnlineUsers] = useState({}); // userId -> { isOnline, lastSeenAt }

	// Handle incoming notifications from Nakama
	useEffect(() => {
		if (!socket) return;

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
					emitEvent("follow_accepted", newNotification.content);
					break;

				case NOTIFICATION_CODES.CHAT_MESSAGE:
					emitEvent("chat_message", newNotification.content);
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
					break;
			}

			// Handle legacy subject-based notifications
			if (
				notification.subject === "follow_request_cancelled" ||
				notification.subject === "follow_request_accepted_self" ||
				notification.subject === "follow_request_rejected_self"
			) {
				setFollowRequestCount((prev) => Math.max(0, prev - 1));
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

		// Request browser notification permission
		if (Notification.permission === "default") {
			Notification.requestPermission();
		}

		return () => {
			socket.onnotification = null;
		};
	}, [socket]);

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
		updateUserOnlineStatus,
		getUserOnlineStatus,
	};

	return (
		<NotificationContext.Provider value={value}>
			{children}
		</NotificationContext.Provider>
	);
};
