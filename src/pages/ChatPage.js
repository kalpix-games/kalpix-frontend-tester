import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
	getChannels,
	getRequestChannels,
	getUsersOnlineStatus,
	getFollowing,
	deleteAllDMRequests,
	getHiddenRequestChannels,
	muteChannel,
	unmuteChannel,
	archiveChannel,
	unarchiveChannel,
	clearChatHistory,
	getArchivedChannels,
} from "../utils/nakamaClient";
import {
	subscribeToEvent,
	useNotifications,
} from "../contexts/NotificationContext";
import "./ChatPage.css";

/**
 * Format date for display (DD/MM/YYYY)
 */
function formatDate(timestamp) {
	if (!timestamp) return "";
	let ts = timestamp;
	if (ts < 1e12) ts = ts * 1000;
	const date = new Date(ts);
	const day = String(date.getDate()).padStart(2, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const year = date.getFullYear();
	return `${day}/${month}/${year}`;
}

/**
 * Chat List Page - Instagram-style DM list
 */
function ChatPage({ client, session, onSelectChannel }) {
	const navigate = useNavigate();
	const { followRequestCount, dmRequestCount, initializeDmRequestCount } =
		useNotifications();
	const [activeTab, setActiveTab] = useState("all");
	const [channels, setChannels] = useState([]);
	const [requestChannels, setRequestChannels] = useState([]);
	const [hiddenRequestChannels, setHiddenRequestChannels] = useState([]);
	const [loading, setLoading] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [onlineStatuses, setOnlineStatuses] = useState({});
	const [showNewMessageModal, setShowNewMessageModal] = useState(false);
	const [deletingAll, setDeletingAll] = useState(false);

	// New Message Modal state
	const [contacts, setContacts] = useState([]);
	const [contactsLoading, setContactsLoading] = useState(false);
	const [contactSearchQuery, setContactSearchQuery] = useState("");
	const [filteredContacts, setFilteredContacts] = useState([]);

	// Chat management state
	const [contextMenuChannel, setContextMenuChannel] = useState(null);
	const [contextMenuPosition, setContextMenuPosition] = useState({
		x: 0,
		y: 0,
	});
	const [archivedChannels, setArchivedChannels] = useState([]);
	const [, setShowArchived] = useState(false);

	// Load channels based on active tab
	const loadChannels = useCallback(async () => {
		if (!client || !session) return;
		setLoading(true);
		try {
			if (activeTab === "requests") {
				const result = await getRequestChannels(client, session);
				setRequestChannels(result.channels || []);
				// Also load hidden requests
				try {
					const hiddenResult = await getHiddenRequestChannels(client, session);
					setHiddenRequestChannels(hiddenResult.channels || []);
				} catch (e) {
					console.log("Hidden requests not available:", e);
				}
			} else {
				const result = await getChannels(client, session);
				setChannels(result.channels || []);

				// Fetch online status for participants
				const allParticipants = new Set();
				(result.channels || []).forEach((channel) => {
					(channel.participantIds || []).forEach((id) => {
						if (id !== session.user_id) allParticipants.add(id);
					});
				});
				if (allParticipants.size > 0) {
					fetchOnlineStatuses(Array.from(allParticipants));
				}
			}
		} catch (error) {
			console.error("Failed to load channels:", error);
		} finally {
			setLoading(false);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [client, session, activeTab]);

	// Fetch online statuses
	const fetchOnlineStatuses = async (userIds) => {
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

	useEffect(() => {
		loadChannels();
	}, [loadChannels]);

	// Initialize message request count on mount
	useEffect(() => {
		const loadRequestCount = async () => {
			if (!client || !session) return;
			try {
				const result = await getRequestChannels(client, session);
				const count = (result.channels || []).length;
				initializeDmRequestCount(count);
			} catch (error) {
				console.error("Failed to load request count:", error);
			}
		};
		loadRequestCount();
	}, [client, session, initializeDmRequestCount]);

	// Subscribe to real-time events
	useEffect(() => {
		// When a DM request is received, always reload the request channels
		// This ensures the first message appears in the list
		const unsubDmRequest = subscribeToEvent("dm_request", async (data) => {
			console.log("📬 DM request received:", data);
			// Always reload request channels when a DM request comes in
			try {
				const result = await getRequestChannels(client, session);
				setRequestChannels(result.channels || []);
				// Update the request count in the notification context
				initializeDmRequestCount((result.channels || []).length);
			} catch (error) {
				console.error("Failed to reload request channels:", error);
			}
		});
		const unsubNewChannel = subscribeToEvent("new_channel", () => {
			loadChannels();
		});
		// When a new message arrives, update the corresponding channel so
		// userB sees it immediately in the chat list without needing to reload.
		const unsubNewMessage = subscribeToEvent("new_message", async (data) => {
			// Normalized message + channel id from NotificationContext
			const message = data?.message || data;
			const eventChannelId = data?.channelId || message?.channelId;
			if (!eventChannelId || !message) return;

			const isIncoming =
				!!message.senderId && session && message.senderId !== session.user_id;

			// Check if this channel exists in any of our lists
			const existsInChannels = channels.some(
				(ch) => ch.channelId === eventChannelId
			);
			const existsInRequests = requestChannels.some(
				(ch) => ch.channelId === eventChannelId
			);
			const existsInArchived = archivedChannels.some(
				(ch) => ch.channelId === eventChannelId
			);

			// If the channel doesn't exist in any list, this might be a new message request
			// Reload the appropriate lists
			if (!existsInChannels && !existsInRequests && !existsInArchived) {
				console.log(
					"📬 New message for unknown channel, reloading lists:",
					eventChannelId
				);
				try {
					// Reload both inbox and request channels
					const [inboxResult, requestResult] = await Promise.all([
						getChannels(client, session),
						getRequestChannels(client, session),
					]);
					setChannels(inboxResult.channels || []);
					setRequestChannels(requestResult.channels || []);
					initializeDmRequestCount((requestResult.channels || []).length);
				} catch (error) {
					console.error("Failed to reload channels:", error);
				}
				return;
			}

			const updateList = (setter) => {
				setter((prev) => {
					if (!prev || prev.length === 0) return prev;
					let touched = false;

					const updated = prev.map((ch) => {
						if (ch.channelId !== eventChannelId) return ch;
						touched = true;

						const next = {
							...ch,
							lastMessageText:
								message.content !== undefined
									? message.content
									: ch.lastMessageText,
							lastMessageTime:
								message.createdAt !== undefined
									? message.createdAt
									: ch.lastMessageTime,
						};

						// Increment unread count for incoming messages only
						if (isIncoming) {
							next.unreadCount = (ch.unreadCount || 0) + 1;
						}

						return next;
					});

					if (!touched) return prev;

					// Sort so most recent conversation stays on top, similar to WhatsApp
					const toMs = (time, fallback) => {
						const value = time ?? fallback ?? 0;
						if (value < 1e12) return value * 1000;
						return value;
					};

					return [...updated].sort(
						(a, b) =>
							toMs(b.lastMessageTime, b.createdAt) -
							toMs(a.lastMessageTime, a.createdAt)
					);
				});
			};

			// Update all lists that may contain this channel
			updateList(setChannels);
			updateList(setRequestChannels);
			updateList(setArchivedChannels);
		});
		const unsubPresence = subscribeToEvent("presence_update", (content) => {
			setOnlineStatuses((prev) => ({
				...prev,
				[content.userId]: {
					isOnline: content.isOnline,
					lastSeenAt: content.timestamp,
				},
			}));
		});

		// When messages in a channel are read, reset unread count for that channel
		const unsubMessagesRead = subscribeToEvent("messages_read", (data) => {
			const eventChannelId = data?.channelId;
			if (!eventChannelId) return;

			const resetUnreadCount = (setter) => {
				setter((prev) =>
					prev.map((ch) =>
						ch.channelId === eventChannelId ? { ...ch, unreadCount: 0 } : ch
					)
				);
			};

			resetUnreadCount(setChannels);
			resetUnreadCount(setRequestChannels);
			resetUnreadCount(setArchivedChannels);
		});

		return () => {
			unsubDmRequest();
			unsubNewChannel();
			unsubNewMessage();
			unsubPresence();
			unsubMessagesRead();
		};
	}, [
		activeTab,
		loadChannels,
		session,
		client,
		channels,
		requestChannels,
		archivedChannels,
		initializeDmRequestCount,
	]);

	// Load contacts (friends/following) when modal opens
	const loadContacts = useCallback(async () => {
		if (!client || !session) return;
		setContactsLoading(true);
		try {
			const result = await getFollowing(client, session);
			const followingList = result.following || [];
			setContacts(followingList);
			setFilteredContacts(followingList);
		} catch (error) {
			console.error("Failed to load contacts:", error);
		} finally {
			setContactsLoading(false);
		}
	}, [client, session]);

	// Filter contacts when search query changes
	useEffect(() => {
		if (!contactSearchQuery.trim()) {
			setFilteredContacts(contacts);
		} else {
			const query = contactSearchQuery.toLowerCase();
			const filtered = contacts.filter(
				(contact) =>
					contact.username?.toLowerCase().includes(query) ||
					contact.displayName?.toLowerCase().includes(query)
			);
			setFilteredContacts(filtered);
		}
	}, [contactSearchQuery, contacts]);

	// Load contacts when modal opens
	useEffect(() => {
		if (showNewMessageModal) {
			loadContacts();
		}
	}, [showNewMessageModal, loadContacts]);

	// Group contacts by first letter
	const groupContactsByLetter = (contactsList) => {
		const grouped = {};
		contactsList.forEach((contact) => {
			const firstLetter = (contact.username ||
				contact.displayName ||
				"?")[0].toUpperCase();
			if (!grouped[firstLetter]) {
				grouped[firstLetter] = [];
			}
			grouped[firstLetter].push(contact);
		});
		return grouped;
	};

	// Handle starting a DM with a contact
	const handleStartDM = (contact) => {
		// Check if a channel already exists with this user
		const existingChannel = channels.find((ch) => {
			if (ch.channelType !== "direct") return false;
			return (ch.participantIds || []).includes(contact.userId);
		});

		setShowNewMessageModal(false);
		setContactSearchQuery("");

		if (existingChannel) {
			// Navigate to existing channel
			navigate(`/chat/${existingChannel.channelId}`);
		} else {
			// Navigate to new conversation page - channel will be created on first message
			navigate(`/chat/new/${contact.userId}`);
		}
	};

	// Format last seen for contacts
	const formatLastSeen = (timestamp) => {
		if (!timestamp) return "";
		let ts = timestamp;
		if (ts < 1e12) ts = ts * 1000;
		const date = new Date(ts);
		const day = String(date.getDate()).padStart(2, "0");
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const year = String(date.getFullYear()).slice(-2);
		return `last seen ${day}/${month}/${year}`;
	};

	// Handle delete all DM requests
	const handleDeleteAll = async () => {
		if (deletingAll) return;
		if (!window.confirm("Delete all message requests?")) return;
		setDeletingAll(true);
		try {
			await deleteAllDMRequests(client, session);
			initializeDmRequestCount(0);
			setRequestChannels([]);
			setHiddenRequestChannels([]);
		} catch (error) {
			console.error("Failed to delete all requests:", error);
		} finally {
			setDeletingAll(false);
		}
	};

	// Handle channel click - navigate to conversation
	const handleChannelClick = (channel) => {
		if (onSelectChannel) {
			onSelectChannel(channel);
		}
		// For requests, navigate to the request view page
		if (activeTab === "requests") {
			navigate(`/chat/request/${channel.channelId}`);
		} else {
			navigate(`/chat/${channel.channelId}`);
		}
	};

	// Handle context menu (right-click or long-press)
	const handleContextMenu = (e, channel) => {
		e.preventDefault();
		e.stopPropagation();
		setContextMenuChannel(channel);

		// Position menu from the right edge so it doesn't overflow the screen
		const viewportWidth =
			window.innerWidth ||
			document.documentElement.clientWidth ||
			document.body.clientWidth ||
			0;

		const rightOffset = Math.max(8, viewportWidth - e.clientX);

		setContextMenuPosition({
			x: rightOffset,
			y: e.clientY,
		});
	};

	// Close context menu
	const closeContextMenu = () => {
		setContextMenuChannel(null);
	};

	// Handle mute/unmute channel
	const handleToggleMute = async (channel) => {
		try {
			if (channel.isMuted) {
				await unmuteChannel(client, session, channel.channelId);
			} else {
				await muteChannel(client, session, channel.channelId);
			}
			// Update local state
			setChannels((prev) =>
				prev.map((c) =>
					c.channelId === channel.channelId ? { ...c, isMuted: !c.isMuted } : c
				)
			);
		} catch (error) {
			console.error("Failed to toggle mute:", error);
		}
		closeContextMenu();
	};

	// Handle archive/unarchive channel
	const handleToggleArchive = async (channel) => {
		try {
			if (channel.isArchived) {
				await unarchiveChannel(client, session, channel.channelId);
				setArchivedChannels((prev) =>
					prev.filter((c) => c.channelId !== channel.channelId)
				);
				setChannels((prev) => [...prev, { ...channel, isArchived: false }]);
			} else {
				await archiveChannel(client, session, channel.channelId);
				setChannels((prev) =>
					prev.filter((c) => c.channelId !== channel.channelId)
				);
				setArchivedChannels((prev) => [
					...prev,
					{ ...channel, isArchived: true },
				]);
			}
		} catch (error) {
			console.error("Failed to toggle archive:", error);
		}
		closeContextMenu();
	};

	// Handle clear chat history
	const handleClearHistory = async (channel) => {
		if (!window.confirm("Clear all messages in this chat?")) return;
		try {
			await clearChatHistory(client, session, channel.channelId);
			// Update local state
			setChannels((prev) =>
				prev.map((c) =>
					c.channelId === channel.channelId
						? { ...c, lastMessageText: "", lastMessageTime: null }
						: c
				)
			);
		} catch (error) {
			console.error("Failed to clear history:", error);
		}
		closeContextMenu();
	};

	// Load archived channels
	const loadArchivedChannels = async () => {
		try {
			const result = await getArchivedChannels(client, session);
			setArchivedChannels(result.channels || []);
		} catch (error) {
			console.error("Failed to load archived channels:", error);
		}
	};

	// Load archived channels on mount
	useEffect(() => {
		if (client && session) {
			loadArchivedChannels();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [client, session]);

	// Close context menu when clicking outside
	useEffect(() => {
		const handleClickOutside = () => closeContextMenu();
		if (contextMenuChannel) {
			document.addEventListener("click", handleClickOutside);
			return () => document.removeEventListener("click", handleClickOutside);
		}
	}, [contextMenuChannel]);

	// Filter channels based on tab and search
	const getFilteredChannels = () => {
		let filtered = channels;

		// Filter by tab
		if (activeTab === "unread") {
			filtered = filtered.filter((c) => c.unreadCount > 0);
		} else if (activeTab === "groups") {
			filtered = filtered.filter((c) => c.channelType === "group");
		} else if (activeTab === "favourite") {
			// TODO: Implement favorites when backend supports it
			filtered = filtered.filter((c) => c.isFavourite);
		}

		// Filter by search query
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(c) =>
					c.name?.toLowerCase().includes(query) ||
					c.lastMessageText?.toLowerCase().includes(query)
			);
		}

		return filtered;
	};

	if (!session) {
		return (
			<div className="chat-page">
				<div className="empty-state">
					<div className="empty-icon">🔒</div>
					<h3>Please log in</h3>
					<p>You need to be logged in to access Direct Messages.</p>
				</div>
			</div>
		);
	}

	const filteredChannels = getFilteredChannels();
	const displayChannels =
		activeTab === "requests"
			? requestChannels
			: activeTab === "archived"
			? archivedChannels
			: filteredChannels;

	return (
		<div className="chat-page">
			{/* Header */}
			<div className="chat-header">
				<div className="chat-header-left">
					<button className="menu-btn" onClick={() => navigate(-1)}>
						☰
					</button>
					<h1>Chat</h1>
				</div>
				<div className="chat-header-right">
					<button
						className="header-icon-btn follow-requests-btn"
						title="Follow Requests"
						onClick={() => navigate("/follow-requests")}
					>
						👥
						{followRequestCount > 0 && (
							<span className="notification-badge">{followRequestCount}</span>
						)}
					</button>
					<button
						className="header-icon-btn"
						title="New Chat"
						onClick={() => setShowNewMessageModal(true)}
					>
						+
					</button>
				</div>
			</div>

			{/* Search Bar */}
			<div className="chat-search">
				<div className="search-input-wrapper">
					<span className="search-icon">🔍</span>
					<input
						type="text"
						className="search-input"
						placeholder="What's new?..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</div>
			</div>

			{/* Filter Tabs */}
			<div className="chat-tabs">
				<button
					className={`chat-tab ${activeTab === "all" ? "active" : ""}`}
					onClick={() => {
						setActiveTab("all");
						setShowArchived(false);
					}}
				>
					All
				</button>
				<button
					className={`chat-tab ${activeTab === "favourite" ? "active" : ""}`}
					onClick={() => {
						setActiveTab("favourite");
						setShowArchived(false);
					}}
				>
					Favourite
				</button>
				<button
					className={`chat-tab ${activeTab === "unread" ? "active" : ""}`}
					onClick={() => {
						setActiveTab("unread");
						setShowArchived(false);
					}}
				>
					Unread
					{channels.filter((c) => c.unreadCount > 0).length > 0 && (
						<span className="chat-tab-badge">
							{channels.filter((c) => c.unreadCount > 0).length}
						</span>
					)}
				</button>
				<button
					className={`chat-tab ${activeTab === "groups" ? "active" : ""}`}
					onClick={() => {
						setActiveTab("groups");
						setShowArchived(false);
					}}
				>
					Groups
				</button>
				<button
					className={`chat-tab ${activeTab === "requests" ? "active" : ""}`}
					onClick={() => {
						setActiveTab("requests");
						setShowArchived(false);
					}}
				>
					Message Requests
					{dmRequestCount > 0 && (
						<span className="chat-tab-badge">{dmRequestCount}</span>
					)}
				</button>
				<button
					className={`chat-tab ${activeTab === "archived" ? "active" : ""}`}
					onClick={() => {
						setActiveTab("archived");
						setShowArchived(true);
					}}
				>
					Archived
					{archivedChannels.length > 0 && (
						<span className="chat-tab-badge">{archivedChannels.length}</span>
					)}
				</button>
			</div>

			{/* Section Label */}
			{activeTab === "requests" ? (
				<div className="requests-header">
					<p className="requests-info-text">
						Open a request to get info about who's messaging you. They won't
						know you've seen it until you accept.
					</p>
				</div>
			) : activeTab === "archived" ? (
				<div className="section-label">Archived Chats</div>
			) : (
				<div className="section-label">Recent</div>
			)}

			{/* Chat List */}
			<div className="chat-list">
				{loading ? (
					<div className="chat-loading">
						<div className="chat-spinner"></div>
					</div>
				) : displayChannels.length === 0 ? (
					<div className="empty-state">
						<div className="empty-icon">
							{activeTab === "requests" ? "📭" : "💬"}
						</div>
						<h3>
							{activeTab === "requests"
								? "No message requests"
								: "No conversations yet"}
						</h3>
						<p>
							{activeTab === "requests"
								? "When someone sends you a message request, it will appear here."
								: "Start a conversation by tapping the + button."}
						</p>
					</div>
				) : (
					<>
						{displayChannels.map((channel) => {
							const otherParticipantId = (channel.participantIds || []).find(
								(id) => id !== session.user_id
							);
							const otherParticipant = (channel.participants || []).find(
								(p) => p.userId === otherParticipantId
							);
							const isOnline = otherParticipantId
								? onlineStatuses[otherParticipantId]?.isOnline
								: false;

							// For direct channels, use the other participant's info
							const displayName =
								channel.channelType === "direct" && otherParticipant
									? otherParticipant.username
									: channel.name || "Direct Message";
							const displayAvatar =
								channel.channelType === "direct" && otherParticipant
									? otherParticipant.avatarUrl
									: channel.avatarUrl;

							return (
								<div key={channel.channelId}>
									<div
										className={`chat-item ${
											channel.isMuted ? "chat-item-muted" : ""
										}`}
										onClick={() => handleChannelClick(channel)}
										onContextMenu={(e) => handleContextMenu(e, channel)}
									>
										{/* Avatar */}
										<div className="chat-avatar-wrapper">
											{displayAvatar ? (
												<img
													src={displayAvatar}
													alt={displayName}
													className="chat-avatar"
												/>
											) : (
												<div className="chat-avatar-placeholder">
													{channel.channelType === "group"
														? "👥"
														: channel.channelType === "bot"
														? "🤖"
														: "👤"}
												</div>
											)}
											{isOnline && channel.channelType === "direct" && (
												<span className="online-dot"></span>
											)}
										</div>

										{/* Info */}
										<div className="chat-info">
											<div className="chat-name">
												{displayName}
												{channel.isMuted && (
													<span className="muted-icon">🔇</span>
												)}
											</div>
											<div className="chat-last-message">
												{channel.lastMessageText || "No messages yet"}
											</div>
										</div>

										{/* Meta */}
										<div className="chat-meta">
											<span className="chat-date">
												{formatDate(
													channel.lastMessageTime || channel.createdAt
												)}
											</span>
											{channel.unreadCount > 0 && (
												<span className="unread-badge">
													{channel.unreadCount}
												</span>
											)}
										</div>

										{/* Options button */}
										<button
											className="chat-options-btn"
											onClick={(e) => {
												e.stopPropagation();
												handleContextMenu(e, channel);
											}}
										>
											⋮
										</button>
									</div>
								</div>
							);
						})}

						{/* Hidden Requests Section */}
						{activeTab === "requests" && hiddenRequestChannels.length > 0 && (
							<div
								className="hidden-requests-section"
								onClick={() => {
									/* TODO: Navigate to hidden requests */
								}}
							>
								<span className="hidden-requests-text">Hidden Requests</span>
								<span className="hidden-requests-count">
									{hiddenRequestChannels.length}
								</span>
								<span className="hidden-requests-arrow">›</span>
							</div>
						)}

						{/* Delete All Button */}
						{activeTab === "requests" && requestChannels.length > 0 && (
							<button
								className="delete-all-btn"
								onClick={handleDeleteAll}
								disabled={deletingAll}
							>
								{deletingAll ? "Deleting..." : "Delete all"}
							</button>
						)}
					</>
				)}
			</div>

			{/* New Message Modal */}
			{showNewMessageModal && (
				<div className="new-message-overlay">
					<div className="new-message-modal">
						{/* Modal Header */}
						<div className="new-message-header">
							<button
								className="new-message-close"
								onClick={() => {
									setShowNewMessageModal(false);
									setContactSearchQuery("");
								}}
							>
								×
							</button>
							<span className="new-message-title">New Message</span>
						</div>

						{/* Search Bar */}
						<div className="new-message-search">
							<span className="new-message-search-icon">🔍</span>
							<input
								type="text"
								className="new-message-search-input"
								placeholder="Find contacts by name"
								value={contactSearchQuery}
								onChange={(e) => setContactSearchQuery(e.target.value)}
							/>
						</div>

						{/* Action Buttons */}
						<div className="new-message-actions">
							<button className="new-message-action-btn" disabled>
								<span className="action-icon">👥</span>
								<span className="action-label">New Group</span>
							</button>
							<button
								className="new-message-action-btn"
								onClick={() => {
									setShowNewMessageModal(false);
									navigate("/find-people");
								}}
							>
								<span className="action-icon">🔎</span>
								<span className="action-label">Find People</span>
							</button>
							<button className="new-message-action-btn" disabled>
								<span className="action-icon">📢</span>
								<span className="action-label">New Channel</span>
							</button>
						</div>

						{/* Contacts List */}
						<div className="new-message-contacts">
							{contactsLoading ? (
								<div className="contacts-loading">
									<div className="chat-spinner"></div>
								</div>
							) : filteredContacts.length === 0 ? (
								<div className="contacts-empty">
									{contactSearchQuery
										? "No contacts found"
										: "No contacts yet. Find people to follow!"}
								</div>
							) : (
								Object.entries(groupContactsByLetter(filteredContacts)).map(
									([letter, letterContacts]) => (
										<div key={letter} className="contacts-group">
											<div className="contacts-letter">{letter}</div>
											{letterContacts.map((contact) => (
												<div
													key={contact.userId}
													className="contact-item"
													onClick={() => handleStartDM(contact)}
												>
													<div className="contact-avatar-wrapper">
														{contact.avatarUrl ? (
															<img
																src={contact.avatarUrl}
																alt={contact.username}
																className="contact-avatar"
															/>
														) : (
															<div className="contact-avatar-placeholder">
																{(contact.username || "U")[0].toUpperCase()}
															</div>
														)}
													</div>
													<div className="contact-info">
														<div className="contact-name">
															{contact.displayName || contact.username}
														</div>
														<div className="contact-last-seen">
															{formatLastSeen(contact.lastSeenAt)}
														</div>
													</div>
												</div>
											))}
										</div>
									)
								)
							)}
						</div>
					</div>
				</div>
			)}

			{/* Context Menu */}
			{contextMenuChannel && (
				<div
					className="chat-context-menu"
					style={{
						top: contextMenuPosition.y,
						right: contextMenuPosition.x,
					}}
					onClick={(e) => e.stopPropagation()}
				>
					<button
						className="context-menu-item"
						onClick={() => handleToggleMute(contextMenuChannel)}
					>
						{contextMenuChannel.isMuted ? "🔔 Unmute" : "🔇 Mute"}
					</button>
					<button
						className="context-menu-item"
						onClick={() => handleToggleArchive(contextMenuChannel)}
					>
						{contextMenuChannel.isArchived ? "📤 Unarchive" : "📥 Archive"}
					</button>
					<button
						className="context-menu-item"
						onClick={() => handleClearHistory(contextMenuChannel)}
					>
						🗑️ Clear History
					</button>
					<button
						className="context-menu-item context-menu-item-danger"
						onClick={closeContextMenu}
					>
						✕ Cancel
					</button>
				</div>
			)}
		</div>
	);
}

export default ChatPage;
