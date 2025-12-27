/**
 * Nakama Client Utilities
 * Helper functions for Nakama client operations
 */

/**
 * Timeout wrapper for promises - fails fast if network is slow/offline
 * @param {Promise} promise - The promise to wrap
 * @param {number} ms - Timeout in milliseconds
 * @param {string} operation - Name of the operation for error message
 * @returns {Promise} Promise that rejects if timeout is exceeded
 */
function withTimeout(promise, ms = 10000, operation = "Operation") {
	return Promise.race([
		promise,
		new Promise((_, reject) =>
			setTimeout(
				() => reject(new Error(`${operation} timed out after ${ms}ms`)),
				ms
			)
		),
	]);
}

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

				// Handle standardized API response format: { success: true/false, data/error: ... }
				if (data.success === false) {
					const errorMsg =
						data.error?.message || data.error || "Match creation failed";
					throw new Error(errorMsg);
				}

				// Extract the actual response data from standardized format
				const responseData = data.data || data;

				if (responseData.matchId) {
					console.log("Joining created match:", responseData.matchId);
					const match = await socket.joinMatch(responseData.matchId);
					return {
						matchId: responseData.matchId,
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

	let data = response.payload;

	// If payload is a string, try to parse it as JSON
	if (typeof data === "string") {
		try {
			data = JSON.parse(data);
		} catch (error) {
			console.error("Failed to parse bot response payload:", error);
			return { success: true, message: "Bot added" };
		}
	}

	// Handle standardized API response format: { success: true/false, data/error: ... }
	if (data.success === false) {
		const errorMsg = data.error?.message || data.error || "Failed to add bot";
		throw new Error(errorMsg);
	}

	// Extract the actual response data from standardized format
	return data.data || data;
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

	// Handle standardized API response format: { success: true/false, data/error: ... }
	if (data.success === false) {
		const errorMsg =
			data.error?.message || data.error || "Failed to find or create match";
		throw new Error(errorMsg);
	}

	// Extract the actual response data from standardized format
	const responseData = data.data || data;

	if (responseData.matchId) {
		// Join the match via socket
		const match = await socket.joinMatch(responseData.matchId);
		return {
			matchId: responseData.matchId,
			match: match,
			success: responseData.success, // true = created new, false = joined existing
			message: responseData.message,
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
 * @param {string} visibility - Post visibility: 'public', 'friends', or 'private'
 * @param {string} mediaURL - Optional media URL
 * @returns {object} Created post
 */
export async function createPost(
	client,
	session,
	content,
	visibility = "public",
	mediaURL = ""
) {
	const response = await client.rpc(session, "social/create_post", {
		content,
		visibility,
		media_url: mediaURL,
	});
	return parseRpcResponse(response);
}

/**
 * Get user feed (personalized feed from followed users)
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
 * Get public feed (all public posts from all users)
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session (optional)
 * @param {number} limit - Number of posts to fetch
 * @param {string} cursor - Pagination cursor
 * @returns {object} Feed data
 */
export async function getPublicFeed(client, session, limit = 20, cursor = "") {
	const response = await client.rpc(session, "social/get_public_feed", {
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
 * Add comment to post or reply to a comment
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} postId - Post ID
 * @param {string} content - Comment content
 * @param {string} parentCommentId - Parent comment ID (optional, for replies)
 * @returns {object} Created comment
 */
export async function addComment(
	client,
	session,
	postId,
	content,
	parentCommentId = null
) {
	const payload = {
		post_id: postId,
		content,
	};

	if (parentCommentId) {
		payload.parent_comment_id = parentCommentId;
	}

	const response = await client.rpc(session, "social/add_comment", payload);
	return parseRpcResponse(response);
}

/**
 * Get comments for a post with pagination
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} postId - Post ID
 * @param {number} limit - Number of comments to fetch
 * @param {number} offset - Offset for pagination
 * @returns {object} Comments data
 */
export async function getComments(client, session, postId, limit = 20, offset = 0) {
	const response = await client.rpc(session, "social/get_comments", {
		post_id: postId,
		limit,
		offset,
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
 * @param {string} requesterId - User ID who sent the request
 * @returns {object} Response
 */
export async function acceptFollowRequest(client, session, requesterId) {
	const response = await client.rpc(session, "social/accept_follow_request", {
		requester_id: requesterId,
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
 * Search users with pagination
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} query - Search query
 * @param {number} limit - Number of results
 * @param {string} cursor - Pagination cursor
 * @returns {object} Search results with pagination
 */
export async function searchUsers(client, session, query, limit = 20, cursor = "") {
	const response = await client.rpc(session, "social/search_users", {
		query,
		limit,
		cursor,
	});
	return parseRpcResponse(response);
}

/**
 * Reject follow request
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} requesterId - User ID who sent the request
 * @returns {object} Response
 */
export async function rejectFollowRequest(client, session, requesterId) {
	const response = await client.rpc(session, "social/reject_follow_request", {
		requester_id: requesterId,
	});
	return parseRpcResponse(response);
}

/**
 * Cancel follow request
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} targetUserId - User ID to whom the request was sent
 * @returns {object} Response
 */
export async function cancelFollowRequest(client, session, targetUserId) {
	const response = await client.rpc(session, "social/cancel_follow_request", {
		target_user_id: targetUserId,
	});
	return parseRpcResponse(response);
}

/**
 * Get sent follow requests
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @returns {object} Sent follow requests
 */
export async function getSentRequests(client, session) {
	const response = await client.rpc(session, "social/get_sent_requests", {});
	return parseRpcResponse(response);
}

/**
 * Unfollow a user
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} targetUserId - User ID to unfollow
 * @returns {object} Response
 */
export async function unfollow(client, session, targetUserId) {
	const response = await client.rpc(session, "social/unfollow", {
		target_user_id: targetUserId,
	});
	return parseRpcResponse(response);
}

/**
 * Get followers list with pagination
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} targetUserId - User ID (optional, defaults to current user)
 * @param {number} limit - Number of results
 * @param {string} cursor - Pagination cursor
 * @returns {object} Followers list with pagination
 */
export async function getFollowers(client, session, targetUserId = null, limit = 20, cursor = "") {
	const payload = { limit, cursor };
	if (targetUserId) {
		payload.target_user_id = targetUserId;
	}
	const response = await client.rpc(session, "social/get_followers", payload);
	return parseRpcResponse(response);
}

/**
 * Get following list with pagination
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} targetUserId - User ID (optional, defaults to current user)
 * @param {number} limit - Number of results
 * @param {string} cursor - Pagination cursor
 * @returns {object} Following list with pagination
 */
export async function getFollowing(client, session, targetUserId = null, limit = 20, cursor = "") {
	const payload = { limit, cursor };
	if (targetUserId) {
		payload.target_user_id = targetUserId;
	}
	const response = await client.rpc(session, "social/get_following", payload);
	return parseRpcResponse(response);
}

/**
 * Get user posts for profile page with pagination
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} targetUserId - User ID whose posts to fetch (optional, defaults to current user)
 * @param {number} limit - Number of posts to fetch
 * @param {string} cursor - Pagination cursor
 * @returns {object} Posts data with pagination
 */
export async function getUserPosts(client, session, targetUserId = null, limit = 20, cursor = "") {
	const payload = {
		limit,
		cursor,
	};
	if (targetUserId) {
		payload.target_user_id = targetUserId;
	}
	const response = await client.rpc(session, "social/get_profile_posts", payload);
	return parseRpcResponse(response);
}

/**
 * Get user profile with privacy controls
 * @param {Client} client - Nakama client
 * @param {Session} session - User session
 * @param {string} targetUserId - ID of the user whose profile to fetch
 * @returns {Promise<Object>} User profile data
 */
export async function getUserProfile(client, session, targetUserId) {
	const response = await client.rpc(session, "social/get_user_profile", {
		target_user_id: targetUserId,
	});
	return parseRpcResponse(response);
}

/**
 * Get online status for multiple users
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string[]} userIds - Array of user IDs
 * @returns {Promise<Object>} Online status data
 */
export async function getUsersOnlineStatus(client, session, userIds) {
	const response = await client.rpc(session, "social/get_users_online_status", {
		user_ids: userIds,
	});
	return parseRpcResponse(response);
}

// ========================================
// STORY RPC FUNCTIONS
// ========================================

/**
 * Create (post) a story
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} mediaUrl - Media URL (image/video)
 * @param {string} mediaType - Media type: 'image' or 'video'
 * @param {string} caption - Optional caption
 * @param {string} visibility - Visibility: 'public', 'followers', 'friends', 'private'
 * @returns {object} Created story
 */
export async function postStory(
	client,
	session,
	mediaUrl,
	mediaType = "image",
	caption = "",
	visibility = "followers"
) {
	const response = await client.rpc(session, "social/post_story", {
		mediaUrl,
		mediaType,
		caption,
		visibility,
	});
	return parseRpcResponse(response);
}

/**
 * Upload story media (image/video) to S3 and get a public URL.
 * This reuses the chat media upload pipeline on the backend.
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} mediaType - Media type: 'image' or 'video'
 * @param {string} fileName - Original file name
 * @param {string} fileData - Base64-encoded file contents (no data: prefix)
 * @returns {object} MediaUpload record containing fileUrl
 */
export async function uploadStoryMedia(
	client,
	session,
	mediaType,
	fileName,
	fileData
) {
	const response = await client.rpc(session, "social/upload_story_media", {
		mediaType,
		fileName,
		fileData,
	});
	return parseRpcResponse(response);
}

/**
 * Get the story tray for the current user (self + followed users).
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @returns {object} Story tray data
 */

/**
 * Get the user's inbox channels (direct + accepted requests).
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @returns {object} Channels list
 */
export async function getInboxChannels(client, session) {
	const response = await client.rpc(session, "chat/get_inbox_channels", {});
	return parseRpcResponse(response);
}

/**
 * Get the user's incoming message request channels.
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @returns {object} Channels list
 */
export async function getRequestChannels(client, session) {
	const response = await client.rpc(session, "chat/get_request_channels", {});
	return parseRpcResponse(response);
}

/**
 * Accept a pending DM request channel.
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} channelId - Channel ID to accept
 * @returns {object} Updated channel
 */
export async function acceptDMRequest(client, session, channelId) {
	const response = await client.rpc(session, "chat/accept_dm_request", {
		channel_id: channelId,
	});
	return parseRpcResponse(response);
}

/**
 * Decline a pending DM request channel.
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} channelId - Channel ID to decline
 * @returns {object} Updated channel
 */
export async function declineDMRequest(client, session, channelId) {
	const response = await client.rpc(session, "chat/decline_dm_request", {
		channel_id: channelId,
	});
	return parseRpcResponse(response);
}

/**
 * Block a DM sender and delete the request
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} channelId - Channel ID of the request
 * @returns {object} Response
 */
export async function blockDMSender(client, session, channelId) {
	const response = await client.rpc(session, "chat/block_dm_sender", {
		channel_id: channelId,
	});
	return parseRpcResponse(response);
}

/**
 * Delete a DM request (without blocking)
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} channelId - Channel ID of the request
 * @returns {object} Response
 */
export async function deleteDMRequest(client, session, channelId) {
	const response = await client.rpc(session, "chat/delete_dm_request", {
		channel_id: channelId,
	});
	return parseRpcResponse(response);
}

/**
 * Delete all DM requests
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @returns {object} Response
 */
export async function deleteAllDMRequests(client, session) {
	const response = await client.rpc(session, "chat/delete_all_dm_requests", {});
	return parseRpcResponse(response);
}

/**
 * Get hidden request channels
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @returns {object} Hidden channels
 */
export async function getHiddenRequestChannels(client, session) {
	const response = await client.rpc(
		session,
		"chat/get_hidden_request_channels",
		{}
	);
	return parseRpcResponse(response);
}

export async function getStoryTray(client, session) {
	const response = await client.rpc(session, "social/get_story_tray", {});
	return parseRpcResponse(response);
}

/**
 * Get active stories for a specific user, applying visibility rules.
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} targetUserId - User ID whose stories to fetch
 * @returns {object} Stories response
 */
export async function getUserStories(client, session, targetUserId) {
	const response = await client.rpc(session, "social/get_user_stories", {
		target_user_id: targetUserId,
	});
	return parseRpcResponse(response);
}

/**
 * Mark a story as viewed by the current user (idempotent).
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} storyId - Story ID
 * @param {string} ownerId - Story owner's user ID
 * @returns {object} Response message
 */
export async function viewStory(client, session, storyId, ownerId) {
	const response = await client.rpc(session, "social/view_story", {
		story_id: storyId,
		owner_id: ownerId,
	});
	return parseRpcResponse(response);
}

/**
 * Get viewers list for one of the current user's stories.
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} storyId - Story ID
 * @returns {object} Viewers response
 */
export async function getStoryViewers(client, session, storyId) {
	const response = await client.rpc(session, "social/get_story_viewers", {
		story_id: storyId,
	});
	return parseRpcResponse(response);
}

/**
 * Reply to a story via DM.
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} storyId - Story ID
 * @param {string} ownerId - Story owner's user ID
 * @param {string} text - Reply text content
 * @returns {object} Response containing channel and message
 */
export async function replyToStory(client, session, storyId, ownerId, text) {
	const response = await client.rpc(session, "social/reply_story", {
		storyId,
		ownerId,
		text,
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
 * Get user's inbox channels (excludes pending incoming requests)
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @returns {object} Channels list
 */
export async function getChannels(client, session) {
	const response = await client.rpc(session, "chat/get_inbox_channels", {});
	return parseRpcResponse(response);
}

/**
 * Get conversations list with pagination and priority sorting
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {number} limit - Number of conversations to fetch (default: 20)
 * @param {string} cursor - Cursor for pagination (optional)
 * @returns {object} Conversations list with pagination info
 */
export async function getConversations(
	client,
	session,
	limit = 20,
	cursor = null
) {
	const payload = { limit };
	if (cursor) {
		payload.cursor = cursor;
	}
	const response = await client.rpc(session, "chat/get_conversations", payload);
	return parseRpcResponse(response);
}

/**
 * Get a single channel by ID
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} channelId - Channel ID
 * @returns {object} Channel info
 */
export async function getChannelInfo(client, session, channelId) {
	const response = await client.rpc(session, "chat/get_channel", {
		channel_id: channelId,
	});
	return parseRpcResponse(response);
}

/**
 * Get messages for a channel
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} channelId - Channel ID
 * @param {number} limit - Number of messages to fetch
 * @param {string} cursor - Pagination cursor
 * @returns {object} Messages list
 */
export async function getChannelMessages(
	client,
	session,
	channelId,
	limit = 50,
	cursor = ""
) {
	const response = await client.rpc(session, "chat/get_messages", {
		channel_id: channelId,
		limit: limit,
		cursor: cursor,
	});
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
 * @param {string} replyToId - Optional message ID to reply to
 * @returns {object} Sent message
 */
export async function sendChatMessage(
	client,
	session,
	channelId,
	content,
	messageType = "text",
	mediaURL = "",
	replyToId = ""
) {
	// Check network status before sending
	if (!navigator.onLine) {
		throw new Error("Network offline - message queued for later");
	}

	const payload = {
		channel_id: channelId,
		content,
		message_type: messageType,
		media_url: mediaURL,
	};
	if (replyToId) {
		payload.reply_to_id = replyToId;
	}

	// Use timeout to fail fast if network is slow/unstable
	const response = await withTimeout(
		client.rpc(session, "chat/send_message", payload),
		10000, // 10 second timeout
		"Send message"
	);
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

/**
 * Send a typing indicator event for a channel.
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} channelId - Channel ID
 * @param {boolean} isTyping - Whether the user is currently typing
 * @returns {object} Response
 */
export async function sendTypingIndicator(
	client,
	session,
	channelId,
	isTyping
) {
	const response = await client.rpc(session, "chat/send_typing_indicator", {
		channel_id: channelId,
		is_typing: !!isTyping,
	});
	return parseRpcResponse(response);
}

/**
 * Mark a message as read in a channel.
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} channelId - Channel ID
 * @param {string} messageId - Message ID
 * @returns {object} Response
 */
export async function markMessageRead(client, session, channelId, messageId) {
	const response = await client.rpc(session, "chat/mark_read", {
		channel_id: channelId,
		message_id: messageId,
	});
	return parseRpcResponse(response);
}

/**
 * Mark multiple messages as read (bulk)
 * @param {Client} client - Nakama client
 * @param {Session} session - User session
 * @param {string} channelId - Channel ID
 * @param {string[]} messageIds - Array of message IDs
 * @returns {object} Response with marked_count
 */
export async function markMessagesRead(client, session, channelId, messageIds) {
	const response = await client.rpc(session, "chat/mark_messages_read", {
		channel_id: channelId,
		message_ids: messageIds,
	});
	return parseRpcResponse(response);
}

/**
 * Mark messages as delivered
 * @param {Client} client - Nakama client
 * @param {Session} session - User session
 * @param {string} channelId - Channel ID
 * @param {string[]} messageIds - Array of message IDs
 * @returns {object} Response
 */
export async function markMessagesDelivered(
	client,
	session,
	channelId,
	messageIds
) {
	const response = await client.rpc(session, "chat/mark_delivered", {
		channel_id: channelId,
		message_ids: messageIds,
	});
	return parseRpcResponse(response);
}

/**
 * Add reaction to a message
 * @param {Client} client - Nakama client
 * @param {Session} session - User session
 * @param {string} channelId - Channel ID
 * @param {string} messageId - Message ID
 * @param {string} emoji - Emoji reaction
 * @returns {object} Updated message
 */
export async function addReaction(
	client,
	session,
	channelId,
	messageId,
	emoji
) {
	const response = await client.rpc(session, "chat/add_reaction", {
		channel_id: channelId,
		message_id: messageId,
		emoji: emoji,
	});
	return parseRpcResponse(response);
}

/**
 * Remove reaction from a message
 * @param {Client} client - Nakama client
 * @param {Session} session - User session
 * @param {string} channelId - Channel ID
 * @param {string} messageId - Message ID
 * @param {string} emoji - Emoji reaction
 * @returns {object} Updated message
 */
export async function removeReaction(
	client,
	session,
	channelId,
	messageId,
	emoji
) {
	const response = await client.rpc(session, "chat/remove_reaction", {
		channel_id: channelId,
		message_id: messageId,
		emoji: emoji,
	});
	return parseRpcResponse(response);
}

/**
 * Edit a message
 * @param {Client} client - Nakama client
 * @param {Session} session - User session
 * @param {string} channelId - Channel ID
 * @param {string} messageId - Message ID
 * @param {string} newContent - New message content
 * @returns {object} Updated message
 */
export async function editMessage(
	client,
	session,
	channelId,
	messageId,
	newContent
) {
	const response = await client.rpc(session, "chat/edit_message", {
		channel_id: channelId,
		message_id: messageId,
		new_content: newContent,
	});
	return parseRpcResponse(response);
}

/**
 * Delete a message
 * @param {Client} client - Nakama client
 * @param {Session} session - User session
 * @param {string} channelId - Channel ID
 * @param {string} messageId - Message ID
 * @returns {object} Response
 */
export async function deleteMessage(client, session, channelId, messageId) {
	const response = await client.rpc(session, "chat/delete_message", {
		channel_id: channelId,
		message_id: messageId,
	});
	return parseRpcResponse(response);
}

// ========================================
// STREAM MANAGEMENT
// ========================================

/**
 * Join a chat channel's stream for real-time events (typing indicators, read receipts)
 * @param {Client} client - Nakama client
 * @param {Session} session - User session
 * @param {string} channelId - Channel ID
 * @returns {Promise<object>} Response
 */
export async function joinChannelStream(client, session, channelId) {
	console.log("🔗 joinChannelStream called with channelId:", channelId);
	try {
		const response = await client.rpc(session, "chat/join_stream", {
			channel_id: channelId,
		});
		console.log("🔗 joinChannelStream RPC response:", response);
		return parseRpcResponse(response);
	} catch (error) {
		console.error("🔗 joinChannelStream RPC error:", error);
		throw error;
	}
}

/**
 * Leave a chat channel's stream
 * @param {Client} client - Nakama client
 * @param {Session} session - User session
 * @param {string} channelId - Channel ID
 * @returns {object} Response
 */
export async function leaveChannelStream(client, session, channelId) {
	const response = await client.rpc(session, "chat/leave_stream", {
		channel_id: channelId,
	});
	return parseRpcResponse(response);
}

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Parse RPC response with standardized API response format support
 * Format: { success: true/false, data: {...} } or { success: false, error: { code: number, message: string } }
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

	// Handle standardized API error response: { success: false, error: { code, message } }
	if (data.success === false) {
		const errorMsg = data.error?.message || data.error || "Request failed";
		throw new Error(errorMsg);
	}

	// Check for legacy error format
	if (data.error) {
		throw new Error(data.error.message || data.error);
	}

	// Return the data field if it exists, otherwise return the whole payload
	return data.data || data;
}

// ========================================
// MEDIA UPLOAD
// ========================================

/**
 * Upload media file for chat (base64 encoded)
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} mediaType - Media type: 'image', 'video', 'audio', 'document'
 * @param {string} fileName - Original file name
 * @param {string} fileData - Base64-encoded file contents (no data: prefix)
 * @returns {object} MediaUpload record containing fileUrl
 */
export async function uploadChatMedia(
	client,
	session,
	mediaType,
	fileName,
	fileData
) {
	const response = await client.rpc(session, "chat/upload_media", {
		media_type: mediaType,
		file_name: fileName,
		file_data: fileData,
	});
	return parseRpcResponse(response);
}

/**
 * Get a presigned URL for direct upload to S3
 * @param {object} client - Nakama client
 * @param {object} session - Nakama session
 * @param {string} mediaType - Media type: 'image', 'video', 'audio', 'document'
 * @param {string} fileName - Original file name
 * @returns {object} Object containing upload_url, media_type, file_name
 */
export async function getPresignedUploadUrl(
	client,
	session,
	mediaType,
	fileName
) {
	const response = await client.rpc(session, "chat/get_presigned_url", {
		media_type: mediaType,
		file_name: fileName,
	});
	return parseRpcResponse(response);
}

// ========================================
// MESSAGE FEATURES (Forward, Search, Pin)
// ========================================

/**
 * Forward a message to another channel
 */
export async function forwardMessage(
	client,
	session,
	messageId,
	targetChannelId
) {
	const response = await client.rpc(session, "chat/forward_message", {
		messageId,
		targetChannelId,
	});
	return parseRpcResponse(response);
}

/**
 * Search messages in a channel
 */
export async function searchMessages(
	client,
	session,
	channelId,
	query,
	limit = 20
) {
	const response = await client.rpc(session, "chat/search_messages", {
		channelId,
		query,
		limit,
	});
	return parseRpcResponse(response);
}

/**
 * Pin a message in a channel
 */
export async function pinMessage(client, session, channelId, messageId) {
	const response = await client.rpc(session, "chat/pin_message", {
		channelId,
		messageId,
	});
	return parseRpcResponse(response);
}

/**
 * Unpin a message in a channel
 */
export async function unpinMessage(client, session, channelId, messageId) {
	const response = await client.rpc(session, "chat/unpin_message", {
		channelId,
		messageId,
	});
	return parseRpcResponse(response);
}

/**
 * Get all pinned messages in a channel
 */
export async function getPinnedMessages(client, session, channelId) {
	const response = await client.rpc(session, "chat/get_pinned_messages", {
		channelId,
	});
	return parseRpcResponse(response);
}

// ========================================
// CHAT MANAGEMENT (Mute, Archive, Clear, Report)
// ========================================

/**
 * Mute a channel
 */
export async function muteChannel(client, session, channelId, mutedUntil = 0) {
	const response = await client.rpc(session, "chat/mute_channel", {
		channelId,
		mutedUntil,
	});
	return parseRpcResponse(response);
}

/**
 * Unmute a channel
 */
export async function unmuteChannel(client, session, channelId) {
	const response = await client.rpc(session, "chat/unmute_channel", {
		channelId,
	});
	return parseRpcResponse(response);
}

/**
 * Archive a channel
 */
export async function archiveChannel(client, session, channelId) {
	const response = await client.rpc(session, "chat/archive_channel", {
		channelId,
	});
	return parseRpcResponse(response);
}

/**
 * Unarchive a channel
 */
export async function unarchiveChannel(client, session, channelId) {
	const response = await client.rpc(session, "chat/unarchive_channel", {
		channelId,
	});
	return parseRpcResponse(response);
}

/**
 * Get archived channels
 */
export async function getArchivedChannels(client, session) {
	const response = await client.rpc(session, "chat/get_archived_channels", {});
	return parseRpcResponse(response);
}

/**
 * Clear chat history
 */
export async function clearChatHistory(client, session, channelId) {
	const response = await client.rpc(session, "chat/clear_history", {
		channelId,
	});
	return parseRpcResponse(response);
}

/**
 * Report a message
 */
export async function reportMessage(
	client,
	session,
	channelId,
	messageId,
	reason,
	description = ""
) {
	const response = await client.rpc(session, "chat/report_message", {
		channelId,
		messageId,
		reason,
		description,
	});
	return parseRpcResponse(response);
}

/**
 * Get channel settings
 */
export async function getChannelSettings(client, session, channelId) {
	const response = await client.rpc(session, "chat/get_channel_settings", {
		channelId,
	});
	return parseRpcResponse(response);
}

// ========================================
// GROUP MANAGEMENT
// ========================================

/**
 * Create a group channel
 */
export async function createGroupChannel(
	client,
	session,
	name,
	description,
	iconUrl,
	participantIds
) {
	const response = await client.rpc(session, "chat/create_group", {
		name,
		description,
		iconUrl,
		participantIds,
	});
	return parseRpcResponse(response);
}

/**
 * Add a member to a group
 */
export async function addGroupMember(client, session, channelId, newMemberId) {
	const response = await client.rpc(session, "chat/add_group_member", {
		channelId,
		newMemberId,
	});
	return parseRpcResponse(response);
}

/**
 * Remove a member from a group
 */
export async function removeGroupMember(client, session, channelId, memberId) {
	const response = await client.rpc(session, "chat/remove_group_member", {
		channelId,
		memberId,
	});
	return parseRpcResponse(response);
}

/**
 * Promote a member to admin
 */
export async function promoteToAdmin(client, session, channelId, memberId) {
	const response = await client.rpc(session, "chat/promote_to_admin", {
		channelId,
		memberId,
	});
	return parseRpcResponse(response);
}

/**
 * Demote an admin to regular member
 */
export async function demoteFromAdmin(client, session, channelId, adminId) {
	const response = await client.rpc(session, "chat/demote_from_admin", {
		channelId,
		adminId,
	});
	return parseRpcResponse(response);
}

/**
 * Update group info
 */
export async function updateGroupInfo(
	client,
	session,
	channelId,
	name,
	description,
	iconUrl
) {
	const response = await client.rpc(session, "chat/update_group_info", {
		channelId,
		name,
		description,
		iconUrl,
	});
	return parseRpcResponse(response);
}

/**
 * Leave a group
 */
export async function leaveGroup(client, session, channelId) {
	const response = await client.rpc(session, "chat/leave_group", {
		channelId,
	});
	return parseRpcResponse(response);
}

// ========================================
// Message Status Sync Functions
// ========================================

/**
 * Get pending (undelivered) messages for the current user
 * Called when user comes online to retrieve missed messages
 */
export async function getPendingMessages(client, session) {
	const response = await client.rpc(session, "chat/get_pending_messages", {});
	return parseRpcResponse(response);
}

/**
 * Sync and deliver all pending messages
 * Marks all pending messages as delivered and notifies senders
 * Called when user comes online
 */
export async function syncAndDeliverPendingMessages(client, session) {
	const response = await client.rpc(session, "chat/sync_and_deliver", {});
	return parseRpcResponse(response);
}

/**
 * Sync the status of specific messages sent by the user
 * @param {string[]} messageIds - Array of message IDs to check
 */
export async function syncSentMessageStatus(client, session, messageIds) {
	const response = await client.rpc(session, "chat/sync_message_status", {
		message_ids: messageIds,
	});
	return parseRpcResponse(response);
}

/**
 * Sync all sent message status since a timestamp
 * Used for full sync after reconnection
 * @param {number} sinceTimestamp - Unix timestamp (0 for all recent)
 */
export async function syncAllSentMessageStatus(
	client,
	session,
	sinceTimestamp = 0
) {
	const response = await client.rpc(session, "chat/sync_all_message_status", {
		since_timestamp: sinceTimestamp,
	});
	return parseRpcResponse(response);
}
