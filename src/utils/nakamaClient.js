/**
 * Nakama Client Utilities
 * Helper functions for Nakama client operations
 */

/**
 * Send game action to server
 * @param {object} socket - Nakama socket
 * @param {string} matchId - Match ID
 * @param {object} actionData - Action data
 */
export async function sendGameAction(socket, matchId, actionData) {
	if (!socket || !matchId) {
		throw new Error("Socket or matchId not available");
	}

	const message = {
		cid: `action_${Date.now()}`,
		...actionData,
	};

	await socket.sendMatchState(matchId, 1, JSON.stringify(message));
}

/**
 * Create or join a match
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {object} socket - Nakama socket
 * @param {string} gameMode - Game mode (2p, 3p, 4p, 2v2)
 * @param {string} matchType - Match type (private, random)
 * @param {string} matchId - Match ID (for joining existing match)
 * @returns {object} Match data
 */
export async function createOrJoinMatch(
	client,
	session,
	socket,
	gameMode,
	matchType,
	matchId = null
) {
	try {
		if (matchId) {
			// Join existing match
			console.log("Joining match:", matchId);
			const match = await socket.joinMatch(matchId);
			return {
				matchId: match.match_id,
				match: match,
			};
		} else {
			// Create new match (only private matches use RPC)
			if (matchType === "private") {
				const rpcId = "create_uno_match";
				console.log("Calling RPC:", rpcId, "with gameMode:", gameMode);

				const response = await client.rpc(session, rpcId, {
					gameMode,
					matchType: "private",
				});
				console.log("RPC response:", response);
				console.log("RPC response type:", typeof response);
				console.log("RPC response.payload:", response.payload);
				console.log("RPC response.payload type:", typeof response.payload);

				// The Nakama JS SDK automatically parses JSON responses
				// response.payload is already an object, not a string
				let data = response.payload || {};

				// If it's a string, parse it
				if (typeof data === "string") {
					try {
						data = JSON.parse(data);
					} catch (e) {
						console.error("Failed to parse response payload:", e);
						throw new Error(`Invalid response from server: ${data}`);
					}
				}
				console.log("Parsed data:", data);

				// Check if the response indicates success
				if (!data.success) {
					throw new Error(data.message || "Match creation failed");
				}

				if (data.matchId) {
					console.log("Joining created match:", data.matchId);
					const match = await socket.joinMatch(data.matchId);
					return {
						matchId: data.matchId,
						match: match,
					};
				}

				throw new Error(
					`No matchId in response. Response: ${JSON.stringify(data)}`
				);
			} else {
				// For random matches, use matchmaker (handled separately)
				throw new Error("Random matches should use startMatchmaking() instead");
			}
		}
	} catch (error) {
		console.error("createOrJoinMatch error:", error);
		throw error;
	}
}

/**
 * Add bot to match
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} matchId - Match ID
 * @returns {object} Response data
 */
export async function addBot(client, session, matchId) {
	const response = await client.rpc(session, "add_bot_to_match", { matchId });
	// 🔧 FIX: Handle both string and object payloads
	if (!response.payload) {
		return {};
	}

	// If payload is already an object, return it directly
	if (typeof response.payload === "object") {
		return response.payload;
	}

	// If payload is a string, try to parse it as JSON
	try {
		return JSON.parse(response.payload);
	} catch (error) {
		console.error("Failed to parse bot response payload:", error);
		return { success: true, message: "Bot added" };
	}
}

/**
 * Start matchmaking - Find or create a random match
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {object} socket - Nakama socket
 * @param {string} gameMode - Game mode (2p, 3p, 4p, 2v2)
 * @returns {object} Match info with matchId
 */
export async function startMatchmaking(client, session, socket, gameMode) {
	// Use custom RPC to find or create a random match
	// This allows players to join existing open matches within the 5-second window
	// After 5 seconds, remaining slots are filled with bots

	const payload = { gameMode: gameMode };
	console.log("Calling find_or_create_random_match with payload:", payload);
	console.log("Payload JSON:", JSON.stringify(payload));

	const response = await client.rpc(
		session,
		"find_or_create_random_match",
		payload
	);

	console.log("RPC response:", response);
	console.log("RPC response.payload:", response.payload);
	console.log("RPC response.payload type:", typeof response.payload);

	// Handle both string and object payloads
	let data = response.payload || {};
	if (typeof data === "string") {
		try {
			data = JSON.parse(data);
		} catch (e) {
			console.error("Failed to parse RPC response:", e);
			throw new Error("Invalid response from server");
		}
	}

	if (data.matchId) {
		// Join the match via socket
		const match = await socket.joinMatch(data.matchId);
		return {
			matchId: data.matchId,
			match: match,
			success: data.success, // true = created new, false = joined existing
			message: data.message,
		};
	}

	throw new Error("Failed to find or create random match");
}

/**
 * Cancel matchmaking
 * @param {object} socket - Nakama socket
 * @param {string} ticket - Matchmaker ticket
 */
export async function cancelMatchmaking(socket, ticket) {
	if (ticket) {
		await socket.removeMatchmaker(ticket);
	}
}

/**
 * Leave match
 * @param {object} socket - Nakama socket
 * @param {string} matchId - Match ID
 */
export async function leaveMatch(socket, matchId) {
	if (socket && matchId) {
		await socket.leaveMatch(matchId);
	}
}

/**
 * Parse match data message
 * @param {object} message - Match data message
 * @returns {object} Parsed data
 */
export function parseMatchData(message) {
	try {
		const data = JSON.parse(new TextDecoder().decode(message.data));
		return {
			event: data.event || data.Event,
			data: data.data || data.Data || data,
			raw: data,
		};
	} catch (error) {
		console.error("Error parsing match data:", error);
		return null;
	}
}

/**
 * Get player count for game mode
 * @param {string} gameMode - Game mode
 * @returns {number} Number of players
 */
export function getPlayerCount(gameMode) {
	switch (gameMode) {
		case "2p":
			return 2;
		case "3p":
			return 3;
		case "4p":
			return 4;
		case "2v2":
			return 4;
		default:
			return 2;
	}
}

/**
 * Get game mode display name
 * @param {string} gameMode - Game mode
 * @returns {string} Display name
 */
export function getGameModeDisplay(gameMode) {
	switch (gameMode) {
		case "2p":
			return "2 Players";
		case "3p":
			return "3 Players";
		case "4p":
			return "4 Players";
		case "2v2":
			return "2v2 Team";
		default:
			return gameMode;
	}
}

// ========================================
// SOCIAL RPC FUNCTIONS
// ========================================

/**
 * Create a social post
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} content - Post content
 * @param {string} mediaURL - Optional media URL
 * @returns {object} Created post
 */
export async function createPost(client, session, content, mediaURL = "") {
	const response = await client.rpc(session, "social/create_post", {
		content,
		media_url: mediaURL,
	});
	return parseRpcResponse(response);
}

/**
 * Get user feed
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {number} limit - Number of posts to fetch
 * @param {string} cursor - Pagination cursor
 * @returns {object} Feed data
 */
export async function getUserFeed(client, session, limit = 20, cursor = "") {
	const response = await client.rpc(session, "social/get_feed", {
		limit,
		cursor,
	});
	return parseRpcResponse(response);
}

/**
 * Like a post
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} postId - Post ID
 * @returns {object} Response
 */
export async function likePost(client, session, postId) {
	const response = await client.rpc(session, "social/like_post", {
		post_id: postId,
	});
	return parseRpcResponse(response);
}

/**
 * Unlike a post
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} postId - Post ID
 * @returns {object} Response
 */
export async function unlikePost(client, session, postId) {
	const response = await client.rpc(session, "social/unlike_post", {
		post_id: postId,
	});
	return parseRpcResponse(response);
}

/**
 * Add comment to post
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} postId - Post ID
 * @param {string} content - Comment content
 * @returns {object} Created comment
 */
export async function addComment(client, session, postId, content) {
	const response = await client.rpc(session, "social/add_comment", {
		post_id: postId,
		content,
	});
	return parseRpcResponse(response);
}

/**
 * Get comments for a post
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} postId - Post ID
 * @param {number} limit - Number of comments to fetch
 * @returns {object} Comments data
 */
export async function getComments(client, session, postId, limit = 20) {
	const response = await client.rpc(session, "social/get_comments", {
		post_id: postId,
		limit,
	});
	return parseRpcResponse(response);
}

/**
 * Send follow request
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} targetUserId - User ID to follow
 * @returns {object} Response
 */
export async function sendFollowRequest(client, session, targetUserId) {
	console.log("sendFollowRequest called with:", { targetUserId });

	if (!targetUserId) {
		throw new Error("Target user ID is required");
	}

	const payload = {
		target_user_id: targetUserId,
	};

	console.log("Sending RPC social/send_follow_request with payload:", payload);

	const response = await client.rpc(
		session,
		"social/send_follow_request",
		payload
	);
	console.log("Follow request response:", response);

	return parseRpcResponse(response);
}

/**
 * Accept follow request
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} fromUserId - User ID who sent the request
 * @returns {object} Response
 */
export async function acceptFollowRequest(client, session, fromUserId) {
	const response = await client.rpc(session, "social/accept_follow_request", {
		from_user_id: fromUserId,
	});
	return parseRpcResponse(response);
}

/**
 * Get follow requests
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @returns {object} Follow requests
 */
export async function getFollowRequests(client, session) {
	const response = await client.rpc(session, "social/get_follow_requests", {});
	return parseRpcResponse(response);
}

/**
 * Search users
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} query - Search query
 * @param {number} limit - Number of results
 * @returns {object} Search results
 */
export async function searchUsers(client, session, query, limit = 20) {
	const response = await client.rpc(session, "social/search_users", {
		query,
		limit,
	});
	return parseRpcResponse(response);
}

// ========================================
// CHAT RPC FUNCTIONS
// ========================================

/**
 * Create a chat channel
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} channelType - Channel type (direct, group, bot)
 * @param {string} name - Channel name
 * @param {array} participantIds - Array of participant user IDs
 * @returns {object} Created channel
 */
export async function createChannel(
	client,
	session,
	channelType,
	name,
	participantIds
) {
	const response = await client.rpc(session, "chat/create_channel", {
		channel_type: channelType,
		name,
		participant_ids: participantIds,
	});
	return parseRpcResponse(response);
}

/**
 * Get user's channels
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @returns {object} Channels list
 */
export async function getChannels(client, session) {
	const response = await client.rpc(session, "chat/get_channels", {});
	return parseRpcResponse(response);
}

/**
 * Send a chat message
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} channelId - Channel ID
 * @param {string} content - Message content
 * @param {string} messageType - Message type (text, image, etc.)
 * @param {string} mediaURL - Optional media URL
 * @returns {object} Sent message
 */
export async function sendChatMessage(
	client,
	session,
	channelId,
	content,
	messageType = "text",
	mediaURL = ""
) {
	const response = await client.rpc(session, "chat/send_message", {
		channel_id: channelId,
		content,
		message_type: messageType,
		media_url: mediaURL,
	});
	return parseRpcResponse(response);
}

/**
 * Get messages from a channel
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} channelId - Channel ID
 * @param {number} limit - Number of messages to fetch
 * @param {string} cursor - Pagination cursor
 * @returns {object} Messages data
 */
export async function getMessages(
	client,
	session,
	channelId,
	limit = 50,
	cursor = ""
) {
	const response = await client.rpc(session, "chat/get_messages", {
		channel_id: channelId,
		limit,
		cursor,
	});
	return parseRpcResponse(response);
}

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Parse RPC response
 * @param {object} response - RPC response
 * @returns {object} Parsed data
 */
function parseRpcResponse(response) {
	let data = response.payload || {};

	// If payload is a string, parse it
	if (typeof data === "string") {
		try {
			data = JSON.parse(data);
		} catch (e) {
			console.error("Failed to parse RPC response:", e);
			throw new Error("Invalid response from server");
		}
	}

	// Check for error in response
	if (data.error) {
		throw new Error(data.error.message || data.error);
	}

	// Return the data field if it exists, otherwise return the whole payload
	return data.data || data;
}
