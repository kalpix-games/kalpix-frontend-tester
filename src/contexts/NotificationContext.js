import React, {
	createContext,
	useContext,
	useState,
	useEffect,
	useCallback,
} from "react";

const NotificationContext = createContext();

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

			setNotifications((prev) => [newNotification, ...prev]);
			setUnreadCount((prev) => prev + 1);

			// Track follow request notifications separately
			if (notification.subject === "follow_request") {
				setFollowRequestCount((prev) => prev + 1);
			} else if (
				notification.subject === "follow_request_cancelled" ||
				notification.subject === "follow_request_accepted_self" ||
				notification.subject === "follow_request_rejected_self"
			) {
				// Decrement follow request count when a request is cancelled, accepted, or rejected
				setFollowRequestCount((prev) => Math.max(0, prev - 1));
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
	}, []);

	const decrementFollowRequestCount = useCallback(() => {
		setFollowRequestCount((prev) => Math.max(0, prev - 1));
	}, []);

	const value = {
		notifications,
		unreadCount,
		followRequestCount,
		markAsRead,
		markAllAsRead,
		clearNotification,
		clearAllNotifications,
		decrementFollowRequestCount,
	};

	return (
		<NotificationContext.Provider value={value}>
			{children}
		</NotificationContext.Provider>
	);
};
