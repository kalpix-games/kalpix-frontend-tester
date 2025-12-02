import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
	getChannels,
	getMessages,
	sendChatMessage,
	sendTypingIndicator,
	markMessageRead,
	markMessagesRead,
	markMessagesDelivered,
	getUsersOnlineStatus,
	joinChannelStream,
	leaveChannelStream,
	addReaction,
	removeReaction,
	editMessage,
	deleteMessage,
	pinMessage,
	unpinMessage,
	forwardMessage,
	searchMessages,
	getPinnedMessages,
	uploadChatMedia,
	syncAllSentMessageStatus,
} from "../utils/nakamaClient";
import { subscribeToEvent, emitEvent } from "../contexts/NotificationContext";
import "./ChatConversationPage.css";

// Offline message queue - stored in localStorage
const OFFLINE_QUEUE_KEY = "kalpix_offline_messages";

function getOfflineQueue() {
	try {
		const queue = localStorage.getItem(OFFLINE_QUEUE_KEY);
		return queue ? JSON.parse(queue) : [];
	} catch {
		return [];
	}
}

function saveOfflineQueue(queue) {
	try {
		localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
	} catch (e) {
		console.error("Failed to save offline queue:", e);
	}
}

function addToOfflineQueue(message) {
	const queue = getOfflineQueue();
	queue.push(message);
	saveOfflineQueue(queue);
}

function removeFromOfflineQueue(tempId) {
	const queue = getOfflineQueue();
	const filtered = queue.filter((m) => m.tempId !== tempId);
	saveOfflineQueue(filtered);
}

// eslint-disable-next-line no-unused-vars
function clearOfflineQueueForChannel(channelId) {
	const queue = getOfflineQueue();
	const filtered = queue.filter((m) => m.channelId !== channelId);
	saveOfflineQueue(filtered);
}

// Available reactions
const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

// Supported media types
const MEDIA_TYPES = {
	image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
	video: ["video/mp4", "video/webm", "video/quicktime"],
	audio: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp3"],
	document: [
		"application/pdf",
		"application/msword",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	],
};

// Max file sizes in bytes
const MAX_FILE_SIZES = {
	image: 10 * 1024 * 1024, // 10 MB
	video: 100 * 1024 * 1024, // 100 MB
	audio: 20 * 1024 * 1024, // 20 MB
	document: 25 * 1024 * 1024, // 25 MB
};

/**
 * Format timestamp for display
 */
function formatTime(timestamp) {
	if (!timestamp) return "";
	let ts = timestamp;
	if (ts < 1e12) ts = ts * 1000;
	const date = new Date(ts);
	return date.toLocaleTimeString([], {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
}

/**
 * Format date label (Today, Yesterday, or date)
 */
function formatDateLabel(timestamp) {
	if (!timestamp) return "";
	let ts = timestamp;
	if (ts < 1e12) ts = ts * 1000;
	const date = new Date(ts);
	const now = new Date();
	const isToday = date.toDateString() === now.toDateString();
	const yesterday = new Date(now);
	yesterday.setDate(yesterday.getDate() - 1);
	const isYesterday = date.toDateString() === yesterday.toDateString();

	if (isToday) return "Today";
	if (isYesterday) return "Yesterday";
	return date.toLocaleDateString([], {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

/**
 * Format last seen time
 */
function formatLastSeen(timestamp) {
	if (!timestamp) return "";
	let ts = timestamp;
	if (ts < 1e12) ts = ts * 1000;
	const date = new Date(ts);
	return `Last seen at ${date.toLocaleTimeString([], {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	})}`;
}

/**
 * Get message status icon
 */
function getStatusIcon(status, isRead) {
	if (status === "seen" || isRead) return { icon: "✓✓", color: "#60a5fa" }; // Blue double check
	if (status === "delivered") return { icon: "✓✓", color: "#a0a0b0" }; // Gray double check
	if (status === "sent") return { icon: "✓", color: "#a0a0b0" }; // Single check
	if (status === "pending") return { icon: "⏱", color: "#a0a0b0" }; // Clock
	if (status === "failed") return { icon: "⚠️", color: "#ef4444" }; // Warning
	return { icon: "✓", color: "#a0a0b0" };
}

/**
 * Chat Conversation Page
 * Modern DM interface matching the design screenshot
 */
function ChatConversationPage({ client, session, socket }) {
	const { channelId } = useParams();
	const navigate = useNavigate();

	const [channel, setChannel] = useState(null);
	const [messages, setMessages] = useState([]);
	const [messageInput, setMessageInput] = useState("");
	const [loading, setLoading] = useState(true);
	const [sending, setSending] = useState(false);
	const [otherUser, setOtherUser] = useState(null);
	const [isOnline, setIsOnline] = useState(false);
	const [lastSeen, setLastSeen] = useState(null);
	const [typingUser, setTypingUser] = useState(null);

	// Message action states
	const [, setSelectedMessage] = useState(null);
	const [showReactionPicker, setShowReactionPicker] = useState(null);
	const [editingMessage, setEditingMessage] = useState(null);
	const [editContent, setEditContent] = useState("");
	const [replyingTo, setReplyingTo] = useState(null);
	const [showSearch, setShowSearch] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState([]);
	const [pinnedMessages, setPinnedMessages] = useState([]);
	const [showPinnedMessages, setShowPinnedMessages] = useState(false);

	// Media upload states
	const [, setShowMediaPicker] = useState(false);
	const [selectedMedia, setSelectedMedia] = useState(null);
	const [mediaPreview, setMediaPreview] = useState(null);
	const [uploadingMedia, setUploadingMedia] = useState(false);
	const [isOffline, setIsOffline] = useState(!navigator.onLine);

	const messagesEndRef = useRef(null);
	const fileInputRef = useRef(null);
	const typingTimeoutRef = useRef(null);
	const typingActiveRef = useRef(false);
	const remoteTypingTimeoutRef = useRef(null);
	const retryingRef = useRef(false);
	const lastSyncTimestampRef = useRef(0);
	const messageRefs = useRef({}); // Store refs for each message by messageId

	// State for highlighted message (when scrolling to pinned message)
	const [highlightedMessageId, setHighlightedMessageId] = useState(null);

	// Scroll to bottom of messages
	const scrollToBottom = useCallback(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	// Scroll to a specific message by ID
	const scrollToMessage = useCallback((messageId) => {
		const messageElement = messageRefs.current[messageId];
		if (messageElement) {
			messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
			// Highlight the message briefly
			setHighlightedMessageId(messageId);
			setTimeout(() => setHighlightedMessageId(null), 2000);
		}
	}, []);

	// Retry failed messages from offline queue
	const retryFailedMessages = useCallback(async () => {
		if (!client || !session || retryingRef.current) return;

		const queue = getOfflineQueue().filter((m) => m.channelId === channelId);
		if (queue.length === 0) return;

		retryingRef.current = true;
		console.log(`🔄 Retrying ${queue.length} failed messages...`);

		for (const queuedMsg of queue) {
			try {
				const result = await sendChatMessage(
					client,
					session,
					queuedMsg.channelId,
					queuedMsg.content,
					queuedMsg.messageType || "text",
					queuedMsg.mediaUrl || "",
					queuedMsg.replyToId || ""
				);

				// Normalise result: backend currently returns the ChatMessage
				// object directly (not wrapped in { message: ... }), but support
				// both shapes just in case.
				const sentMessage = result?.message || result;

				// Update message in state from failed/pending to sent, ensuring we
				// end up with exactly one entry using the real server messageId.
				setMessages((prev) => {
					// Remove any placeholder with the temporary ID
					let withoutTemp = prev.filter(
						(msg) => msg.messageId !== queuedMsg.tempId
					);

					if (!sentMessage || !sentMessage.messageId) {
						// Fallback: we couldn't get a proper message back; keep the
						// existing message but mark it as sent.
						return prev.map((msg) =>
							msg.messageId === queuedMsg.tempId
								? { ...msg, status: "sent" }
								: msg
						);
					}

					// If a message with this real ID already exists (e.g. from a
					// real-time "new_message" event), just update it.
					const exists = withoutTemp.some(
						(msg) => msg.messageId === sentMessage.messageId
					);
					if (exists) {
						return withoutTemp.map((msg) =>
							msg.messageId === sentMessage.messageId
								? { ...msg, ...sentMessage, status: "sent" }
								: msg
						);
					}

					// Otherwise append the sent message.
					return [
						...withoutTemp,
						{ ...sentMessage, status: sentMessage.status || "sent" },
					];
				});

				// Remove from offline queue
				removeFromOfflineQueue(queuedMsg.tempId);
				console.log(`✅ Retried message ${queuedMsg.tempId} successfully`);
			} catch (error) {
				console.error(`❌ Failed to retry message ${queuedMsg.tempId}:`, error);
				// Keep in queue for next retry
			}
		}

		retryingRef.current = false;
	}, [client, session, channelId]);

	// Sync message statuses after reconnection
	const syncMessageStatuses = useCallback(async () => {
		if (!client || !session) return;

		try {
			console.log("🔄 Syncing message statuses...");
			const result = await syncAllSentMessageStatus(
				client,
				session,
				lastSyncTimestampRef.current
			);

			if (result.statuses && result.statuses.length > 0) {
				setMessages((prev) =>
					prev.map((msg) => {
						const statusInfo = result.statuses.find(
							(s) => s.messageId === msg.messageId
						);
						if (statusInfo) {
							return { ...msg, status: statusInfo.status };
						}
						return msg;
					})
				);
				console.log(`✅ Synced ${result.statuses.length} message statuses`);
			}

			lastSyncTimestampRef.current = Date.now();
		} catch (error) {
			console.error("Failed to sync message statuses:", error);
		}
	}, [client, session]);

	// Network status detection
	useEffect(() => {
		const handleOnline = () => {
			console.log("🌐 Network: Back online");
			setIsOffline(false);
			// Retry failed messages and sync statuses when coming back online
			retryFailedMessages();
			syncMessageStatuses();
		};

		const handleOffline = () => {
			console.log("🌐 Network: Went offline");
			setIsOffline(true);
		};

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, [retryFailedMessages, syncMessageStatuses]);

	// Load channel info
	const loadChannel = useCallback(async () => {
		if (!client || !session || !channelId) return;

		try {
			const result = await getChannels(client, session);
			const foundChannel = (result.channels || []).find(
				(ch) => ch.channelId === channelId
			);
			if (foundChannel) {
				setChannel(foundChannel);

				// Get other participant info
				const otherUserId = (foundChannel.participantIds || []).find(
					(id) => id !== session.user_id
				);
				if (otherUserId) {
					// Find participant info
					const participant = (foundChannel.participants || []).find(
						(p) => p.userId === otherUserId
					);
					setOtherUser({
						userId: otherUserId,
						username: participant?.username || foundChannel.name || "Unknown",
						avatarUrl: participant?.avatarUrl || null,
					});

					// Get online status
					try {
						const statusResult = await getUsersOnlineStatus(client, session, [
							otherUserId,
						]);
						// statuses is an array of { userId, isOnline, lastSeenAt }
						const userStatus = (statusResult.statuses || []).find(
							(s) => s.userId === otherUserId
						);
						if (userStatus) {
							setIsOnline(userStatus.isOnline);
							setLastSeen(userStatus.lastSeenAt);
						}
					} catch (e) {
						console.log("Could not get online status:", e);
					}
				}
			}
		} catch (error) {
			console.error("Failed to load channel:", error);
		}
	}, [client, session, channelId]);

	// Load messages
	const loadMessages = useCallback(async () => {
		if (!client || !session || !channelId) return;

		try {
			setLoading(true);
			const result = await getMessages(client, session, channelId, 100);
			const loadedMessages = result.messages || [];

			// Sort by createdAt ascending
			loadedMessages.sort((a, b) => {
				const aTime = a.createdAt < 1e12 ? a.createdAt * 1000 : a.createdAt;
				const bTime = b.createdAt < 1e12 ? b.createdAt * 1000 : b.createdAt;
				return aTime - bTime;
			});

			setMessages(loadedMessages);

			// Mark messages from other users as delivered and then as read (since we're viewing)
			const otherUserMessages = loadedMessages.filter(
				(msg) => msg.senderId !== session.user_id
			);

			if (otherUserMessages.length > 0) {
				const messageIds = otherUserMessages.map((msg) => msg.messageId);

				// First mark as delivered
				try {
					await markMessagesDelivered(client, session, channelId, messageIds);
					console.log("📬 Marked", messageIds.length, "messages as delivered");
				} catch (e) {
					console.log("Could not mark messages as delivered:", e);
				}

				// Then mark ALL messages as read (bulk) - this sends read receipts for each
				try {
					const result = await markMessagesRead(
						client,
						session,
						channelId,
						messageIds
					);
					console.log(
						"📗 Marked",
						result.marked_count || messageIds.length,
						"messages as read"
					);
					// Emit event so ChatPage can reset unread count for this channel
					emitEvent("messages_read", { channelId });
				} catch (e) {
					console.log("Could not mark messages as read:", e);
				}
			}

			setTimeout(scrollToBottom, 100);
		} catch (error) {
			console.error("Failed to load messages:", error);
		} finally {
			setLoading(false);
		}
	}, [client, session, channelId, scrollToBottom]);

	// Initial load
	useEffect(() => {
		loadChannel();
		loadMessages();
	}, [loadChannel, loadMessages]);

	// Retry failed messages and sync statuses on mount/reconnection
	useEffect(() => {
		if (!client || !session || !channelId) return;

		// Load any failed messages from offline queue into state
		const queue = getOfflineQueue().filter((m) => m.channelId === channelId);
		if (queue.length > 0) {
			setMessages((prev) => {
				const existingIds = new Set(prev.map((m) => m.messageId));
				const newMsgs = queue
					.filter((m) => !existingIds.has(m.tempId))
					.map((m) => ({
						messageId: m.tempId,
						channelId: m.channelId,
						senderId: session.user_id,
						senderName: session.username || "You",
						content: m.content,
						messageType: m.messageType || "text",
						createdAt: m.createdAt,
						status: "failed",
						replyToId: m.replyToId || null,
					}));
				return [...prev, ...newMsgs].sort((a, b) => a.createdAt - b.createdAt);
			});
		}

		// Retry failed messages
		retryFailedMessages();

		// Sync message statuses
		syncMessageStatuses();
	}, [client, session, channelId, retryFailedMessages, syncMessageStatuses]);

	// Join channel stream for real-time updates
	useEffect(() => {
		if (!client || !session || !channelId) return;

		const joinStream = async () => {
			try {
				console.log("🔗 Joining channel stream:", channelId);
				await joinChannelStream(client, session, channelId);
				console.log("✅ Joined channel stream:", channelId);
			} catch (error) {
				console.error("❌ Failed to join channel stream:", error);
			}
		};

		joinStream();

		return () => {
			// Leave stream when unmounting
			leaveChannelStream(client, session, channelId).catch((error) => {
				console.warn("Failed to leave channel stream:", error);
			});
		};
	}, [client, session, channelId]);

	// Subscribe to real-time events
	useEffect(() => {
		// Subscribe to new_message (backend sends "new_message" type)
		const unsubMessage = subscribeToEvent("new_message", (data) => {
			// The message data is wrapped in data.message by the backend
			// The channelId can be in data.channelId (from stream) or data.message.channelId
			const messageData = data.message || data;
			const eventChannelId = data.channelId || messageData.channelId;
			if (eventChannelId === channelId) {
				setMessages((prev) => {
					// Avoid duplicates
					if (prev.some((m) => m.messageId === messageData.messageId))
						return prev;
					return [...prev, messageData];
				});
				scrollToBottom();

				// Mark as delivered and read if from other user
				if (messageData.senderId !== session?.user_id) {
					// First mark as delivered
					markMessagesDelivered(client, session, channelId, [
						messageData.messageId,
					]).catch(() => {});
					// Then mark as read (seen) since user is viewing the chat
					markMessageRead(client, session, channelId, messageData.messageId)
						.then(() => {
							// Emit event so ChatPage can reset unread count for this channel
							emitEvent("messages_read", { channelId });
						})
						.catch(() => {});
				}
			}
		});

		// Subscribe to message_status updates (when other user reads/delivers our messages)
		const unsubStatus = subscribeToEvent("message_status", (data) => {
			const eventChannelId = data.channelId || data.channel_id;
			const eventMessageId = data.messageId || data.message_id;
			console.log("📊 message_status received:", {
				eventChannelId,
				eventMessageId,
				status: data.status,
				currentChannelId: channelId,
			});

			if (eventChannelId === channelId && eventMessageId) {
				setMessages((prev) =>
					prev.map((msg) =>
						msg.messageId === eventMessageId
							? { ...msg, status: data.status }
							: msg
					)
				);
			}
		});

		// Subscribe to message updates (edits) so both users see changes in real time
		const unsubUpdate = subscribeToEvent("message_update", (data) => {
			// Data can come from notifications (snake_case + full message)
			// or from stream payloads (already normalized with channelId)
			const eventChannelId =
				data.channelId || data.channel_id || data.message?.channelId;
			if (eventChannelId !== channelId) return;

			// Prefer full message object when available
			const updated = data.message || {
				messageId: data.message_id,
				content: data.content,
				isEdited: data.is_edited,
				updatedAt: data.updated_at,
			};

			if (!updated || !updated.messageId) return;

			setMessages((prev) =>
				prev.map((msg) =>
					msg.messageId === updated.messageId
						? {
								...msg,
								content:
									updated.content !== undefined ? updated.content : msg.content,
								isEdited:
									updated.isEdited !== undefined ? updated.isEdited : true,
								updatedAt: updated.updatedAt || Date.now(),
						  }
						: msg
				)
			);
		});

		// Subscribe to message deletions so both users see deleted marker in real time
		const unsubDelete = subscribeToEvent("message_delete", (data) => {
			const eventChannelId = data.channelId || data.channel_id;
			if (eventChannelId !== channelId) return;

			const messageId = data.messageId || data.message_id;
			if (!messageId) return;

			setMessages((prev) =>
				prev.map((msg) =>
					msg.messageId === messageId
						? {
								...msg,
								content: "[Message deleted]",
								isDeleted: true,
						  }
						: msg
				)
			);
		});

		const unsubTyping = subscribeToEvent("typing_indicator", (data) => {
			// Backend sends userId and userName (not senderId/senderUsername)
			const senderId = data.userId || data.senderId;
			const senderName = data.userName || data.senderUsername;
			if (data.channelId === channelId && senderId !== session?.user_id) {
				if (data.isTyping) {
					setTypingUser(senderName || "Someone");
					clearTimeout(remoteTypingTimeoutRef.current);
					remoteTypingTimeoutRef.current = setTimeout(() => {
						setTypingUser(null);
					}, 3000);
				} else {
					setTypingUser(null);
				}
			}
		});

		const unsubPresence = subscribeToEvent("presence_update", (data) => {
			if (otherUser && data.userId === otherUser.userId) {
				setIsOnline(data.isOnline);
				if (!data.isOnline) {
					setLastSeen(data.timestamp);
				}
			}
		});

		// Subscribe to reaction updates so both users see emoji reactions in real time
		const unsubReaction = subscribeToEvent("reaction_update", (data) => {
			const eventChannelId = data.channelId || data.channel_id;
			if (eventChannelId !== channelId) return;

			const messageId = data.messageId || data.message_id;
			const emoji = data.emoji;
			const action = data.action; // "added" or "removed"
			const reactorUserId = data.userId || data.user_id;

			if (!messageId || !emoji) return;

			setMessages((prev) =>
				prev.map((msg) => {
					if (msg.messageId !== messageId) return msg;

					// Clone reactions object
					const reactions = { ...(msg.reactions || {}) };

					if (action === "added") {
						// Add user to this emoji's reactor list
						if (!reactions[emoji]) {
							reactions[emoji] = [];
						}
						if (!reactions[emoji].includes(reactorUserId)) {
							reactions[emoji] = [...reactions[emoji], reactorUserId];
						}
					} else if (action === "removed") {
						// Remove user from this emoji's reactor list
						if (reactions[emoji]) {
							reactions[emoji] = reactions[emoji].filter(
								(uid) => uid !== reactorUserId
							);
							// Remove emoji key if no users left
							if (reactions[emoji].length === 0) {
								delete reactions[emoji];
							}
						}
					}

					return { ...msg, reactions };
				})
			);
		});

		return () => {
			unsubMessage();
			unsubStatus();
			unsubUpdate();
			unsubDelete();
			unsubTyping();
			unsubPresence();
			unsubReaction();
		};
	}, [channelId, client, session, scrollToBottom, otherUser]);

	// Handle typing indicator
	const handleTyping = useCallback(() => {
		if (!client || !session || !channelId) return;

		if (!typingActiveRef.current) {
			typingActiveRef.current = true;
			sendTypingIndicator(client, session, channelId, true).catch(() => {});
		}

		clearTimeout(typingTimeoutRef.current);
		typingTimeoutRef.current = setTimeout(() => {
			typingActiveRef.current = false;
			sendTypingIndicator(client, session, channelId, false).catch(() => {});
		}, 2000);
	}, [client, session, channelId]);

	// Send message
	const handleSendMessage = async () => {
		if (!messageInput.trim() || !client || !session || !channelId) return;

		const content = messageInput.trim();
		const replyTo = replyingTo;
		setMessageInput("");
		setReplyingTo(null);
		setSending(true);

		// Stop typing indicator
		clearTimeout(typingTimeoutRef.current);
		typingActiveRef.current = false;
		sendTypingIndicator(client, session, channelId, false).catch(() => {});

		// Create temp message with pending status
		const tempId = `temp-${Date.now()}`;
		const tempMessage = {
			messageId: tempId,
			channelId,
			senderId: session.user_id,
			senderName: session.username || "You",
			content,
			messageType: "text",
			createdAt: Date.now(),
			status: "pending",
			replyToId: replyTo?.messageId || null,
			replyToContent: replyTo?.content || null,
			replyToSenderName: replyTo?.senderName || null,
		};
		setMessages((prev) => [...prev, tempMessage]);
		scrollToBottom();

		// Check if offline BEFORE trying to send
		if (!navigator.onLine) {
			console.log("📴 Offline: Queuing message for later");
			setMessages((prev) =>
				prev.map((msg) =>
					msg.messageId === tempId ? { ...msg, status: "failed" } : msg
				)
			);
			addToOfflineQueue({
				tempId,
				channelId,
				content,
				messageType: "text",
				mediaUrl: "",
				replyToId: replyTo?.messageId || "",
				createdAt: Date.now(),
			});
			setSending(false);
			return;
		}

		try {
			const result = await sendChatMessage(
				client,
				session,
				channelId,
				content,
				"text",
				"",
				replyTo?.messageId || ""
			);
			// Normalise result: backend currently returns the ChatMessage
			// object directly (not wrapped in { message: ... }), but support
			// both shapes just in case.
			const sentMessage = result?.message || result;

			// Reconcile optimistic message with the real one. We want exactly
			// one message in state using the server-assigned messageId, and we
			// must avoid leaving the temporary ID around (otherwise edits,
			// deletes and reactions will reference a non-existent message).
			setMessages((prev) => {
				// First drop any optimistic entry that still uses the temp ID.
				let withoutTemp = prev.filter((msg) => msg.messageId !== tempId);

				if (!sentMessage || !sentMessage.messageId) {
					// Fallback: no proper message came back; keep the optimistic
					// one but mark it as sent.
					return prev.map((msg) =>
						msg.messageId === tempId ? { ...msg, status: "sent" } : msg
					);
				}

				// If a message with this real ID already exists (e.g. from a
				// real-time "new_message" event), update that entry.
				const exists = withoutTemp.some(
					(msg) => msg.messageId === sentMessage.messageId
				);
				if (exists) {
					return withoutTemp.map((msg) =>
						msg.messageId === sentMessage.messageId
							? { ...msg, ...sentMessage, status: "sent" }
							: msg
					);
				}

				// Otherwise append the sent message as a new entry.
				return [
					...withoutTemp,
					{ ...sentMessage, status: sentMessage.status || "sent" },
				];
			});
		} catch (error) {
			console.error("Failed to send message:", error);
			setMessages((prev) =>
				prev.map((msg) =>
					msg.messageId === tempId ? { ...msg, status: "failed" } : msg
				)
			);
			// Add to offline queue for retry
			addToOfflineQueue({
				tempId,
				channelId,
				content,
				messageType: "text",
				mediaUrl: "",
				replyToId: replyTo?.messageId || "",
				createdAt: Date.now(),
			});
		} finally {
			setSending(false);
		}
	};

	// Retry a single failed message
	const handleRetryMessage = async (message) => {
		if (message.status !== "failed") return;

		// Update status to pending
		setMessages((prev) =>
			prev.map((msg) =>
				msg.messageId === message.messageId
					? { ...msg, status: "pending" }
					: msg
			)
		);

		try {
			const result = await sendChatMessage(
				client,
				session,
				channelId,
				message.content,
				message.messageType || "text",
				message.mediaUrl || "",
				message.replyToId || ""
			);

			// Update to sent
			setMessages((prev) =>
				prev.map((msg) =>
					msg.messageId === message.messageId
						? {
								...msg,
								messageId: result.message?.messageId || message.messageId,
								status: "sent",
								createdAt: result.message?.createdAt || msg.createdAt,
						  }
						: msg
				)
			);

			// Remove from offline queue
			removeFromOfflineQueue(message.messageId);
		} catch (error) {
			console.error("Failed to retry message:", error);
			setMessages((prev) =>
				prev.map((msg) =>
					msg.messageId === message.messageId
						? { ...msg, status: "failed" }
						: msg
				)
			);
		}
	};

	// Handle adding a reaction
	const handleAddReaction = async (messageId, emoji) => {
		try {
			await addReaction(client, session, channelId, messageId, emoji);
			setMessages((prev) =>
				prev.map((msg) => {
					if (msg.messageId === messageId) {
						const reactions = { ...(msg.reactions || {}) };
						if (!reactions[emoji]) reactions[emoji] = [];
						if (!reactions[emoji].includes(session.user_id)) {
							reactions[emoji] = [...reactions[emoji], session.user_id];
						}
						return { ...msg, reactions };
					}
					return msg;
				})
			);
		} catch (error) {
			console.error("Failed to add reaction:", error);
		}
		setShowReactionPicker(null);
	};

	// Handle removing a reaction
	const handleRemoveReaction = async (messageId, emoji) => {
		try {
			await removeReaction(client, session, channelId, messageId, emoji);
			setMessages((prev) =>
				prev.map((msg) => {
					if (msg.messageId === messageId) {
						const reactions = { ...(msg.reactions || {}) };
						if (reactions[emoji]) {
							reactions[emoji] = reactions[emoji].filter(
								(id) => id !== session.user_id
							);
							if (reactions[emoji].length === 0) delete reactions[emoji];
						}
						return { ...msg, reactions };
					}
					return msg;
				})
			);
		} catch (error) {
			console.error("Failed to remove reaction:", error);
		}
	};

	// Handle editing a message
	const handleEditMessage = async () => {
		if (!editingMessage || !editContent.trim()) return;
		try {
			// Pass channelId and messageId so backend can locate the message
			await editMessage(
				client,
				session,
				channelId,
				editingMessage.messageId,
				editContent
			);
			setMessages((prev) =>
				prev.map((msg) =>
					msg.messageId === editingMessage.messageId
						? { ...msg, content: editContent, isEdited: true }
						: msg
				)
			);
		} catch (error) {
			console.error("Failed to edit message:", error);
		}
		setEditingMessage(null);
		setEditContent("");
	};

	// Handle deleting a message
	const handleDeleteMessage = async (messageId) => {
		if (!window.confirm("Delete this message?")) return;
		try {
			// Backend needs both channelId and messageId
			await deleteMessage(client, session, channelId, messageId);
			setMessages((prev) =>
				prev.map((msg) =>
					msg.messageId === messageId
						? { ...msg, content: "[Message deleted]", isDeleted: true }
						: msg
				)
			);
		} catch (error) {
			console.error("Failed to delete message:", error);
		}
		setSelectedMessage(null);
	};

	// Handle pinning a message
	const handlePinMessage = async (messageId) => {
		try {
			await pinMessage(client, session, channelId, messageId);
			setMessages((prev) =>
				prev.map((msg) =>
					msg.messageId === messageId ? { ...msg, isPinned: true } : msg
				)
			);
			// Refresh pinned messages
			loadPinnedMessages();
		} catch (error) {
			console.error("Failed to pin message:", error);
		}
		setSelectedMessage(null);
	};

	// Handle unpinning a message
	const handleUnpinMessage = async (messageId) => {
		try {
			await unpinMessage(client, session, channelId, messageId);
			setMessages((prev) =>
				prev.map((msg) =>
					msg.messageId === messageId ? { ...msg, isPinned: false } : msg
				)
			);
			// Refresh pinned messages
			loadPinnedMessages();
		} catch (error) {
			console.error("Failed to unpin message:", error);
		}
		setSelectedMessage(null);
	};

	// Load pinned messages
	const loadPinnedMessages = async () => {
		try {
			const result = await getPinnedMessages(client, session, channelId);
			setPinnedMessages(result.messages || []);
		} catch (error) {
			console.error("Failed to load pinned messages:", error);
		}
	};

	// Handle search
	const handleSearch = async () => {
		if (!searchQuery.trim()) return;
		try {
			const result = await searchMessages(
				client,
				session,
				channelId,
				searchQuery
			);
			setSearchResults(result.messages || []);
		} catch (error) {
			console.error("Failed to search messages:", error);
		}
	};

	// Handle forwarding a message
	// eslint-disable-next-line no-unused-vars
	const handleForwardMessage = async (messageId, targetChannelId) => {
		try {
			await forwardMessage(client, session, messageId, targetChannelId);
			alert("Message forwarded!");
		} catch (error) {
			console.error("Failed to forward message:", error);
		}
		setSelectedMessage(null);
	};

	// Set reply context
	const handleReply = (message) => {
		setReplyingTo(message);
		setSelectedMessage(null);
	};

	// Cancel reply
	const cancelReply = () => {
		setReplyingTo(null);
	};

	// Get media type from file
	const getMediaType = (file) => {
		const mimeType = file.type;
		for (const [type, mimes] of Object.entries(MEDIA_TYPES)) {
			if (mimes.includes(mimeType)) return type;
		}
		return null;
	};

	// Handle file selection
	const handleFileSelect = (e) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const mediaType = getMediaType(file);
		if (!mediaType) {
			alert(
				"Unsupported file type. Please select an image, video, audio, or document file."
			);
			return;
		}

		const maxSize = MAX_FILE_SIZES[mediaType];
		if (file.size > maxSize) {
			alert(
				`File too large. Maximum size for ${mediaType} is ${
					maxSize / (1024 * 1024)
				} MB.`
			);
			return;
		}

		setSelectedMedia({ file, mediaType });

		// Create preview for images and videos
		if (mediaType === "image" || mediaType === "video") {
			const reader = new FileReader();
			reader.onload = (e) => setMediaPreview(e.target.result);
			reader.readAsDataURL(file);
		} else {
			setMediaPreview(null);
		}
		setShowMediaPicker(false);
	};

	// Cancel media selection
	const cancelMediaSelection = () => {
		setSelectedMedia(null);
		setMediaPreview(null);
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	// Upload and send media message
	const handleSendMedia = async () => {
		if (!selectedMedia || uploadingMedia) return;

		setUploadingMedia(true);
		try {
			// Read file as base64
			const reader = new FileReader();
			const base64Data = await new Promise((resolve, reject) => {
				reader.onload = () => {
					const base64 = reader.result.split(",")[1]; // Remove data:... prefix
					resolve(base64);
				};
				reader.onerror = reject;
				reader.readAsDataURL(selectedMedia.file);
			});

			// Upload to server
			const upload = await uploadChatMedia(
				client,
				session,
				selectedMedia.mediaType,
				selectedMedia.file.name,
				base64Data
			);

			// Send message with media URL
			await sendChatMessage(
				client,
				session,
				channelId,
				messageInput || selectedMedia.file.name,
				selectedMedia.mediaType,
				upload.fileUrl,
				replyingTo?.messageId
			);

			// Clear states
			setMessageInput("");
			cancelMediaSelection();
			cancelReply();
			loadMessages();
		} catch (error) {
			console.error("Failed to upload media:", error);
			alert("Failed to upload media. Please try again.");
		} finally {
			setUploadingMedia(false);
		}
	};

	// Load pinned messages on mount
	useEffect(() => {
		if (client && session && channelId) {
			loadPinnedMessages();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [client, session, channelId]);

	// Group messages by date
	const groupMessagesByDate = (messages) => {
		const groups = [];
		let currentDate = null;

		messages.forEach((msg) => {
			const msgDate = formatDateLabel(msg.createdAt);
			if (msgDate !== currentDate) {
				groups.push({ type: "date", label: msgDate });
				currentDate = msgDate;
			}
			groups.push({ type: "message", data: msg });
		});

		return groups;
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

	const groupedMessages = groupMessagesByDate(messages);

	return (
		<div className="dm-page">
			{/* Header */}
			<div className="dm-header">
				<button className="dm-back-btn" onClick={() => navigate("/chat")}>
					<span className="back-icon">‹</span>
				</button>

				<div className="dm-user-info">
					<div className="dm-avatar-container">
						{otherUser?.avatarUrl ? (
							<img src={otherUser.avatarUrl} alt="" className="dm-avatar" />
						) : (
							<div className="dm-avatar-placeholder">
								{(otherUser?.username || "?")[0].toUpperCase()}
							</div>
						)}
						{isOnline && <div className="dm-online-dot" />}
					</div>
					<div className="dm-user-details">
						<h2 className="dm-username">
							{otherUser?.username || channel?.name || "Chat"}
						</h2>
						<p className="dm-status">
							{isOnline
								? "Online"
								: lastSeen
								? formatLastSeen(lastSeen)
								: "Offline"}
						</p>
					</div>
				</div>

				<div className="dm-header-actions">
					<button
						className="dm-action-btn"
						onClick={() => setShowSearch(!showSearch)}
					>
						<span>🔍</span>
					</button>
					<button
						className="dm-action-btn"
						onClick={() => setShowPinnedMessages(!showPinnedMessages)}
					>
						<span>📌</span>
					</button>
					<button className="dm-action-btn">
						<span>📹</span>
					</button>
					<button className="dm-action-btn">
						<span>📞</span>
					</button>
				</div>
			</div>

			{/* Search Bar */}
			{showSearch && (
				<div className="dm-search-bar">
					<input
						type="text"
						placeholder="Search messages..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						onKeyPress={(e) => e.key === "Enter" && handleSearch()}
					/>
					<button onClick={handleSearch}>Search</button>
					<button
						onClick={() => {
							setShowSearch(false);
							setSearchResults([]);
						}}
					>
						✕
					</button>
				</div>
			)}

			{/* Search Results */}
			{searchResults.length > 0 && (
				<div className="dm-search-results">
					<h4>Search Results ({searchResults.length})</h4>
					{searchResults.map((msg) => (
						<div
							key={msg.messageId}
							className="dm-search-result-item"
							onClick={() => {
								scrollToMessage(msg.messageId);
								setShowSearch(false);
								setSearchResults([]);
							}}
							style={{ cursor: "pointer" }}
							title="Click to scroll to message"
						>
							<span className="dm-search-result-sender">{msg.senderName}</span>
							<span className="dm-search-result-content">{msg.content}</span>
							<span className="dm-search-result-time">
								{formatTime(msg.createdAt)}
							</span>
						</div>
					))}
				</div>
			)}

			{/* Pinned Messages */}
			{showPinnedMessages && pinnedMessages.length > 0 && (
				<div className="dm-pinned-messages">
					<h4>📌 Pinned Messages</h4>
					{pinnedMessages.map((msg) => (
						<div
							key={msg.messageId}
							className="dm-pinned-item"
							onClick={() => {
								scrollToMessage(msg.messageId);
								setShowPinnedMessages(false); // Close panel after clicking
							}}
							style={{ cursor: "pointer" }}
							title="Click to scroll to message"
						>
							<span className="dm-pinned-content">{msg.content}</span>
							<button
								onClick={(e) => {
									e.stopPropagation(); // Prevent triggering scroll
									handleUnpinMessage(msg.messageId);
								}}
							>
								Unpin
							</button>
						</div>
					))}
				</div>
			)}

			{/* Messages */}
			<div className="dm-messages">
				{loading ? (
					<div className="dm-loading">Loading messages...</div>
				) : messages.length === 0 ? (
					<div className="dm-no-messages">
						<p>No messages yet. Say hi! 👋</p>
					</div>
				) : (
					<>
						{groupedMessages.map((item, index) => {
							if (item.type === "date") {
								return (
									<div key={`date-${index}`} className="dm-date-separator">
										<span className="dm-date-label">{item.label}</span>
									</div>
								);
							}

							const msg = item.data;
							const isOwn = msg.senderId === session.user_id;
							const status = getStatusIcon(msg.status, msg.isRead);
							const hasReactions =
								msg.reactions && Object.keys(msg.reactions).length > 0;
							const isHighlighted = highlightedMessageId === msg.messageId;

							return (
								<div
									key={msg.messageId}
									ref={(el) => (messageRefs.current[msg.messageId] = el)}
									className={`dm-message ${
										isOwn ? "dm-message-own" : "dm-message-other"
									} ${msg.isPinned ? "dm-message-pinned" : ""} ${
										isHighlighted ? "dm-message-highlighted" : ""
									}`}
								>
									{/* Reply preview if this is a reply */}
									{msg.replyToId && (
										<div className="dm-reply-preview">
											<span className="dm-reply-icon">↩</span>
											<span className="dm-reply-sender">
												{msg.replyToSenderName}
											</span>
											<span className="dm-reply-content">
												{msg.replyToContent}
											</span>
										</div>
									)}

									{/* Forwarded indicator */}
									{msg.forwardedFrom && (
										<div className="dm-forwarded-indicator">
											<span>↗ Forwarded from {msg.forwardedSenderName}</span>
										</div>
									)}

									<div className="dm-message-bubble">
										{/* Pin indicator */}
										{msg.isPinned && <span className="dm-pin-badge">📌</span>}

										{/* Media content */}
										{msg.mediaUrl && (
											<div className="dm-media-content">
												{msg.messageType === "image" && (
													<img
														src={msg.mediaUrl}
														alt="Shared media"
														className="dm-media-image"
														onClick={() => window.open(msg.mediaUrl, "_blank")}
													/>
												)}
												{msg.messageType === "video" && (
													<video
														src={msg.mediaUrl}
														controls
														className="dm-media-video"
													/>
												)}
												{msg.messageType === "audio" && (
													<audio
														src={msg.mediaUrl}
														controls
														className="dm-media-audio"
													/>
												)}
												{msg.messageType === "document" && (
													<a
														href={msg.mediaUrl}
														target="_blank"
														rel="noopener noreferrer"
														className="dm-media-document"
													>
														📄 {msg.content || "Document"}
													</a>
												)}
											</div>
										)}

										{/* Message content */}
										{editingMessage?.messageId === msg.messageId ? (
											<div className="dm-edit-input">
												<input
													type="text"
													value={editContent}
													onChange={(e) => setEditContent(e.target.value)}
													onKeyPress={(e) =>
														e.key === "Enter" && handleEditMessage()
													}
												/>
												<button onClick={handleEditMessage}>Save</button>
												<button onClick={() => setEditingMessage(null)}>
													Cancel
												</button>
											</div>
										) : msg.messageType !== "image" &&
										  msg.messageType !== "video" &&
										  msg.messageType !== "audio" &&
										  msg.messageType !== "document" ? (
											<p
												className={`dm-message-content ${
													msg.isDeleted ? "dm-deleted" : ""
												}`}
											>
												{msg.content}
											</p>
										) : msg.content && msg.messageType !== "document" ? (
											<p className="dm-message-caption">{msg.content}</p>
										) : null}

										{/* Message meta */}
										<div className="dm-message-meta">
											{msg.isEdited && (
												<span className="dm-edited-label">edited</span>
											)}
											{msg.status === "pending" && (
												<span className="dm-message-pending">⏱ sending...</span>
											)}
											{msg.status === "failed" && (
												<button
													className="dm-message-retry"
													onClick={() => handleRetryMessage(msg)}
													title="Tap to retry"
												>
													⚠️ Failed - Tap to retry
												</button>
											)}
											<span className="dm-message-time">
												{formatTime(msg.createdAt)}
											</span>
											{isOwn &&
												msg.status !== "pending" &&
												msg.status !== "failed" && (
													<span
														className="dm-message-status"
														style={{ color: status.color }}
													>
														{status.icon}
													</span>
												)}
										</div>

										{/* Reactions display */}
										{hasReactions && (
											<div className="dm-reactions">
												{Object.entries(msg.reactions).map(([emoji, users]) => (
													<button
														key={emoji}
														className={`dm-reaction ${
															users.includes(session.user_id)
																? "dm-reaction-own"
																: ""
														}`}
														onClick={() =>
															users.includes(session.user_id)
																? handleRemoveReaction(msg.messageId, emoji)
																: handleAddReaction(msg.messageId, emoji)
														}
													>
														{emoji} {users.length}
													</button>
												))}
											</div>
										)}
									</div>

									{/* Message actions */}
									<div className="dm-message-actions">
										<button
											className="dm-action-btn-small"
											onClick={() =>
												setShowReactionPicker(
													showReactionPicker === msg.messageId
														? null
														: msg.messageId
												)
											}
										>
											😊
										</button>
										<button
											className="dm-action-btn-small"
											onClick={() => handleReply(msg)}
										>
											↩
										</button>
										{isOwn && !msg.isDeleted && (
											<>
												<button
													className="dm-action-btn-small"
													onClick={() => {
														setEditingMessage(msg);
														setEditContent(msg.content);
													}}
												>
													✏️
												</button>
												<button
													className="dm-action-btn-small"
													onClick={() => handleDeleteMessage(msg.messageId)}
												>
													🗑️
												</button>
											</>
										)}
										<button
											className="dm-action-btn-small"
											onClick={() =>
												msg.isPinned
													? handleUnpinMessage(msg.messageId)
													: handlePinMessage(msg.messageId)
											}
										>
											{msg.isPinned ? "📌" : "📍"}
										</button>
									</div>

									{/* Reaction picker */}
									{showReactionPicker === msg.messageId && (
										<div className="dm-reaction-picker">
											{REACTIONS.map((emoji) => (
												<button
													key={emoji}
													onClick={() =>
														handleAddReaction(msg.messageId, emoji)
													}
												>
													{emoji}
												</button>
											))}
										</div>
									)}
								</div>
							);
						})}
						<div ref={messagesEndRef} />
					</>
				)}

				{typingUser && (
					<div className="dm-typing-indicator">
						<span>{typingUser} is typing...</span>
					</div>
				)}
			</div>

			{/* Offline Indicator */}
			{isOffline && (
				<div className="dm-offline-indicator">
					<span>
						⚠️ You're offline. Messages will be sent when you reconnect.
					</span>
				</div>
			)}

			{/* Reply Preview */}
			{replyingTo && (
				<div className="dm-reply-bar">
					<div className="dm-reply-bar-content">
						<span className="dm-reply-bar-icon">↩</span>
						<span className="dm-reply-bar-text">
							Replying to <strong>{replyingTo.senderName || "message"}</strong>:{" "}
							{replyingTo.content?.substring(0, 50)}...
						</span>
					</div>
					<button className="dm-reply-bar-close" onClick={cancelReply}>
						✕
					</button>
				</div>
			)}

			{/* Media Preview */}
			{selectedMedia && (
				<div className="dm-media-preview-bar">
					<div className="dm-media-preview-content">
						{mediaPreview && selectedMedia.mediaType === "image" && (
							<img
								src={mediaPreview}
								alt="Preview"
								className="dm-media-preview-thumb"
							/>
						)}
						{mediaPreview && selectedMedia.mediaType === "video" && (
							<video src={mediaPreview} className="dm-media-preview-thumb" />
						)}
						{selectedMedia.mediaType === "audio" && (
							<span className="dm-media-preview-icon">🎵</span>
						)}
						{selectedMedia.mediaType === "document" && (
							<span className="dm-media-preview-icon">📄</span>
						)}
						<span className="dm-media-preview-name">
							{selectedMedia.file.name}
						</span>
					</div>
					<button
						className="dm-media-preview-close"
						onClick={cancelMediaSelection}
					>
						✕
					</button>
				</div>
			)}

			{/* Hidden file input */}
			<input
				type="file"
				ref={fileInputRef}
				style={{ display: "none" }}
				accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
				onChange={handleFileSelect}
			/>

			{/* Input */}
			<div className="dm-input-container">
				<button
					className="dm-attach-btn"
					onClick={() => fileInputRef.current?.click()}
					title="Attach file"
				>
					<span>+</span>
				</button>
				<div className="dm-input-wrapper">
					<input
						type="text"
						className="dm-input"
						placeholder={
							selectedMedia
								? "Add a caption..."
								: replyingTo
								? "Type your reply..."
								: "Type your message..."
						}
						value={messageInput}
						onChange={(e) => {
							setMessageInput(e.target.value);
							handleTyping();
						}}
						onKeyPress={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								if (selectedMedia) {
									handleSendMedia();
								} else {
									handleSendMessage();
								}
							}
						}}
						disabled={sending || uploadingMedia}
					/>
					<div className="dm-input-actions">
						<button
							className="dm-media-btn"
							onClick={() => {
								fileInputRef.current.accept = "image/*";
								fileInputRef.current?.click();
							}}
							title="Send image"
						>
							📷
						</button>
						<button
							className="dm-media-btn"
							onClick={() => {
								fileInputRef.current.accept = "audio/*";
								fileInputRef.current?.click();
							}}
							title="Send audio"
						>
							🎤
						</button>
						<button
							className="dm-media-btn"
							onClick={() => {
								fileInputRef.current.accept = ".pdf,.doc,.docx";
								fileInputRef.current?.click();
							}}
							title="Send document"
						>
							📎
						</button>
					</div>
				</div>
				<button
					className={`dm-send-btn ${
						messageInput.trim() || selectedMedia ? "active" : ""
					}`}
					onClick={selectedMedia ? handleSendMedia : handleSendMessage}
					disabled={
						(!messageInput.trim() && !selectedMedia) ||
						sending ||
						uploadingMedia
					}
				>
					<span>{uploadingMedia ? "⏳" : "➤"}</span>
				</button>
			</div>
		</div>
	);
}

export default ChatConversationPage;
