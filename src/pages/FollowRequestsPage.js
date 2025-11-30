import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
	getFollowRequests,
	getSentRequests,
	acceptFollowRequest,
	rejectFollowRequest,
	cancelFollowRequest,
} from "../utils/nakamaClient";
import {
	subscribeToEvent,
	useNotifications,
} from "../contexts/NotificationContext";
import "./FollowRequestsPage.css";

/**
 * Follow Requests Page - Shows received and sent follow requests
 */
function FollowRequestsPage({ client, session }) {
	const navigate = useNavigate();
	const { decrementFollowRequestCount } = useNotifications();
	const [activeTab, setActiveTab] = useState("received");
	const [receivedRequests, setReceivedRequests] = useState([]);
	const [sentRequests, setSentRequests] = useState([]);
	const [loading, setLoading] = useState(false);
	const [actionLoading, setActionLoading] = useState(null); // Track which request is being acted on

	// Load requests based on active tab
	const loadRequests = useCallback(async () => {
		if (!client || !session) return;
		setLoading(true);
		try {
			if (activeTab === "received") {
				const result = await getFollowRequests(client, session);
				console.log("Received requests result:", result);
				// Backend returns { received: [...], sent: [] }
				setReceivedRequests(result.received || []);
			} else {
				const result = await getSentRequests(client, session);
				console.log("Sent requests result:", result);
				// Backend returns { received: [], sent: [...] }
				setSentRequests(result.sent || []);
			}
		} catch (error) {
			console.error("Failed to load follow requests:", error);
		} finally {
			setLoading(false);
		}
	}, [client, session, activeTab]);

	// Load on mount and tab change
	useEffect(() => {
		loadRequests();
	}, [loadRequests]);

	// Subscribe to real-time follow request events
	useEffect(() => {
		// New follow request received - add to received list
		const unsubFollowRequest = subscribeToEvent("follow_request", (data) => {
			console.log("🔔 New follow request received:", data);
			if (activeTab === "received") {
				// Add the new request to the list in real-time
				const newRequest = {
					requestId: data.requestId || Date.now().toString(),
					fromUserId: data.senderID,
					fromUsername: data.senderUsername,
					fromAvatarUrl: data.senderAvatarUrl || null,
					status: "pending",
					createdAt: Date.now(),
				};
				setReceivedRequests((prev) => {
					// Avoid duplicates
					if (prev.some((r) => r.fromUserId === newRequest.fromUserId)) {
						return prev;
					}
					return [newRequest, ...prev];
				});
			}
		});

		// Someone cancelled their follow request to you - remove from received
		const unsubCancelled = subscribeToEvent(
			"follow_request_cancelled",
			(data) => {
				console.log("🔔 Follow request cancelled:", data);
				if (activeTab === "received") {
					setReceivedRequests((prev) =>
						prev.filter((r) => r.fromUserId !== data.senderID)
					);
				}
			}
		);

		// Someone accepted your follow request - remove from sent
		const unsubAccepted = subscribeToEvent("follow_accepted", (data) => {
			console.log("🔔 Follow request accepted:", data);
			if (activeTab === "sent") {
				setSentRequests((prev) =>
					prev.filter((r) => r.toUserId !== data.accepterID)
				);
			}
		});

		return () => {
			unsubFollowRequest();
			unsubCancelled();
			unsubAccepted();
		};
	}, [activeTab]);

	// Handle confirm (accept) follow request
	const handleConfirm = async (requesterId) => {
		setActionLoading(requesterId);
		try {
			await acceptFollowRequest(client, session, requesterId);
			decrementFollowRequestCount();
			setReceivedRequests((prev) =>
				prev.filter((r) => r.fromUserId !== requesterId)
			);
		} catch (error) {
			console.error("Failed to accept follow request:", error);
		} finally {
			setActionLoading(null);
		}
	};

	// Handle delete (reject) follow request
	const handleDelete = async (requesterId) => {
		setActionLoading(requesterId);
		try {
			await rejectFollowRequest(client, session, requesterId);
			decrementFollowRequestCount();
			setReceivedRequests((prev) =>
				prev.filter((r) => r.fromUserId !== requesterId)
			);
		} catch (error) {
			console.error("Failed to reject follow request:", error);
		} finally {
			setActionLoading(null);
		}
	};

	// Handle cancel sent request
	const handleCancelSent = async (targetUserId) => {
		setActionLoading(targetUserId);
		try {
			await cancelFollowRequest(client, session, targetUserId);
			setSentRequests((prev) =>
				prev.filter((r) => r.toUserId !== targetUserId)
			);
		} catch (error) {
			console.error("Failed to cancel follow request:", error);
		} finally {
			setActionLoading(null);
		}
	};

	// Navigate to user profile
	const handleUserClick = (userId) => {
		navigate(`/user/${userId}`);
	};

	if (!session) {
		return (
			<div className="follow-requests-page">
				<div className="empty-state">
					<div className="empty-icon">🔒</div>
					<h3>Please log in</h3>
					<p>You need to be logged in to view follow requests.</p>
				</div>
			</div>
		);
	}

	const displayRequests =
		activeTab === "received" ? receivedRequests : sentRequests;

	return (
		<div className="follow-requests-page">
			{/* Header */}
			<div className="fr-header">
				<button className="back-btn" onClick={() => navigate(-1)}>
					←
				</button>
				<h1>Follow Requests</h1>
			</div>

			{/* Tabs */}
			<div className="fr-tabs">
				<button
					className={`fr-tab ${activeTab === "received" ? "active" : ""}`}
					onClick={() => setActiveTab("received")}
				>
					Received
				</button>
				<button
					className={`fr-tab ${activeTab === "sent" ? "active" : ""}`}
					onClick={() => setActiveTab("sent")}
				>
					Sent
				</button>
			</div>

			{/* Divider line */}
			<div className="fr-divider"></div>

			{/* Request List */}
			<div className="fr-list">
				{loading ? (
					<div className="loading-state">
						<div className="spinner"></div>
						<p>Loading...</p>
					</div>
				) : displayRequests.length === 0 ? (
					<div className="empty-list">
						<p>
							{activeTab === "received"
								? "No pending follow requests"
								: "No sent follow requests"}
						</p>
					</div>
				) : (
					displayRequests.map((request) => {
						// For received: use fromUserId/fromUsername/fromAvatarUrl
						// For sent: use toUserId/toUsername
						const userId =
							activeTab === "received" ? request.fromUserId : request.toUserId;
						const username =
							activeTab === "received"
								? request.fromUsername
								: request.toUsername;
						const avatarUrl =
							activeTab === "received" ? request.fromAvatarUrl : null;
						const subtitle =
							activeTab === "received" ? "Want to Follow" : "Pending";

						return (
							<div key={request.requestId || userId} className="fr-item">
								<div
									className="fr-user-info"
									onClick={() => handleUserClick(userId)}
								>
									<div className="fr-avatar">
										{avatarUrl ? (
											<img src={avatarUrl} alt={username} />
										) : (
											<div className="avatar-placeholder">
												{username?.charAt(0)?.toUpperCase() || "?"}
											</div>
										)}
									</div>
									<div className="fr-user-details">
										<span className="fr-username">{username}</span>
										<span className="fr-subtitle">{subtitle}</span>
									</div>
								</div>
								<div className="fr-actions">
									{activeTab === "received" ? (
										<>
											<button
												className="btn-confirm"
												onClick={() => handleConfirm(userId)}
												disabled={actionLoading === userId}
											>
												{actionLoading === userId ? "..." : "Confirm"}
											</button>
											<button
												className="btn-delete"
												onClick={() => handleDelete(userId)}
												disabled={actionLoading === userId}
											>
												{actionLoading === userId ? "..." : "Delete"}
											</button>
										</>
									) : (
										<button
											className="btn-cancel"
											onClick={() => handleCancelSent(userId)}
											disabled={actionLoading === userId}
										>
											{actionLoading === userId ? "..." : "Cancel"}
										</button>
									)}
								</div>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}

export default FollowRequestsPage;
