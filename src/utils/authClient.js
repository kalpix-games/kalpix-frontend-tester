/**
 * Authentication Client Utilities
 * Helper functions for authentication RPC calls
 */

/**
 * Call an unauthenticated RPC using HTTP key (POST method)
 * This is a workaround because client.rpcHttpKey() uses GET which doesn't work for our backend
 * @param {object} client - Nakama client
 * @param {string} rpcId - RPC function ID
 * @param {object} payload - Request payload
 * @returns {Promise<object>} RPC response
 */
async function callUnauthenticatedRpc(client, rpcId, payload) {
	// Determine protocol based on SSL setting
	const protocol = client.ssl ? "https" : "http";
	// Use port only if it's specified (for localhost) or if not using SSL
	const portPart = client.port ? `:${client.port}` : "";
	// Get HTTP key from environment or use default
	const httpKey = process.env.REACT_APP_NAKAMA_HTTP_KEY || "defaulthttpkey";

	const url = `${protocol}://${client.host}${portPart}/v2/rpc/${rpcId}?http_key=${httpKey}`;

	console.log("🔍 Calling unauthenticated RPC:", rpcId);
	console.log("🔍 URL:", url);
	console.log("🔍 Payload:", payload);

	// Nakama expects the payload to be a JSON string (double-encoded)
	// So we stringify the payload object to create a JSON string
	const payloadString = JSON.stringify(payload);

	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		// Send the stringified payload as a JSON string (wrapped in quotes)
		body: JSON.stringify(payloadString),
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error("❌ HTTP Error:", response.status, errorText);
		throw new Error(`HTTP ${response.status}: ${errorText}`);
	}

	const data = await response.json();
	console.log("✅ RPC Response:", data);

	return {
		id: rpcId,
		payload: data.payload ? JSON.parse(data.payload) : data,
	};
}

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
			console.error("Raw response:", response);
			throw new Error("Invalid response from server");
		}
	}

	// Handle standardized API error response: { success: false, error: { code, message } }
	if (data.success === false) {
		const errorMessage =
			data.error?.message ||
			data.error?.error ||
			data.error ||
			"Request failed";
		console.error("RPC Error:", errorMessage);
		throw new Error(errorMessage);
	}

	// Check for legacy error format
	if (data.error) {
		const errorMessage = data.error.message || data.error.error || data.error;
		console.error("RPC Error:", errorMessage);
		throw new Error(errorMessage);
	}

	// Return the data field if it exists, otherwise return the whole payload
	return data.data || data;
}

// ========================================
// GUEST LOGIN
// ========================================

/**
 * Login as guest with device ID
 * @param {object} client - Nakama client
 * @param {string} deviceId - Device ID
 * @returns {object} Session and user data
 */
export async function loginAsGuest(client, deviceId) {
	try {
		if (!client) {
			throw new Error("Nakama client is not initialized");
		}
		if (!deviceId) {
			throw new Error("Device ID is required");
		}

		// Use our custom RPC that generates themed usernames
		const response = await callUnauthenticatedRpc(client, "auth/device_login", {
			device_id: deviceId,
			username: "", // Let backend generate themed username
		});

		const data = parseRpcResponse(response);
		console.log("✅ Parsed data:", data);

		// The backend returns session data directly
		const sessionData = data.data || data;

		// Create a session object from the response
		// Backend SessionInfo has: userId, username, sessionToken, expiresAt
		const session = {
			token:
				sessionData.sessionToken ||
				sessionData.token ||
				sessionData.session_token,
			refresh_token: "", // Backend doesn't provide refresh tokens
			user_id: sessionData.userId || sessionData.user_id,
			username: sessionData.username,
			created_at: Date.now(),
			expires_at:
				sessionData.expiresAt || sessionData.expires_at || Date.now() + 3600000, // 1 hour default
		};

		return {
			session,
			data: sessionData,
		};
	} catch (error) {
		console.error("❌ Guest login failed:", error);
		console.error("❌ Error message:", error.message);
		console.error("❌ Error stack:", error.stack);
		if (error.response) {
			console.error("❌ Error response:", error.response);
		}
		throw new Error(error.message || "Failed to login as guest");
	}
}

// ========================================
// EMAIL REGISTRATION
// ========================================

/**
 * Check if username is available
 * @param {object} client - Nakama client
 * @param {string} username - Username to check
 * @returns {object} Availability result
 */
export async function checkUsernameAvailable(client, username) {
	try {
		if (!client) {
			throw new Error("Nakama client is not initialized");
		}
		if (!username) {
			throw new Error("Username is required");
		}

		const response = await callUnauthenticatedRpc(
			client,
			"auth/check_username_available",
			{
				username,
			}
		);
		const data = parseRpcResponse(response);
		return data.data || data;
	} catch (error) {
		console.error("Check username failed:", error);
		throw new Error(error.message || "Failed to check username availability");
	}
}

/**
 * Register with email
 * @param {object} client - Nakama client
 * @param {string} username - Username
 * @param {string} email - Email
 * @param {string} password - Password
 * @param {object} session - Optional session (for account upgrade)
 * @returns {object} Registration result
 */
export async function registerEmail(
	client,
	username,
	email,
	password,
	session = null
) {
	try {
		if (!client) {
			throw new Error("Nakama client is not initialized");
		}
		// Email and password are required, username is optional
		if (!email || !password) {
			throw new Error("Email and password are required");
		}

		const payload = {
			username: username || "", // Send empty string if username not provided
			email,
			password,
		};

		let response;
		if (session) {
			// Authenticated request (account upgrade)
			console.log(
				"🔄 Calling authenticated register_email RPC for account upgrade"
			);
			response = await client.rpc(session, "auth/register_email", payload);
		} else {
			// Unauthenticated request (new registration)
			console.log(
				"🆕 Calling unauthenticated register_email RPC for new registration"
			);
			response = await callUnauthenticatedRpc(
				client,
				"auth/register_email",
				payload
			);
		}

		const data = parseRpcResponse(response);
		return data.data || data;
	} catch (error) {
		console.error("Register email failed:", error);
		throw new Error(error.message || "Failed to register");
	}
}

/**
 * Verify registration OTP
 * @param {object} client - Nakama client
 * @param {string} email - Email
 * @param {string} otp - OTP code
 * @param {object} existingSession - Optional: existing session from skip_verification (to upgrade account)
 * @returns {object} Session and user data
 */
export async function verifyRegistrationOTP(
	client,
	email,
	otp,
	existingSession = null
) {
	try {
		if (!client) {
			throw new Error("Nakama client is not initialized");
		}
		if (!email || !otp) {
			throw new Error("Email and OTP are required");
		}

		let response;
		if (existingSession && existingSession.token) {
			// AUTHENTICATED request - user went through skip_verification and has a session
			// This allows backend to identify the caller and upgrade their existing account
			console.log(
				"🔄 Calling authenticated verify_registration_otp RPC (account upgrade)"
			);
			console.log("🔄 Existing UserID:", existingSession.user_id);
			response = await client.rpc(
				existingSession,
				"auth/verify_registration_otp",
				{
					email,
					otp,
				}
			);
		} else {
			// UNAUTHENTICATED request - direct verification without skip_verification
			// Backend will create a new account
			console.log(
				"🆕 Calling unauthenticated verify_registration_otp RPC (new account)"
			);
			response = await callUnauthenticatedRpc(
				client,
				"auth/verify_registration_otp",
				{
					email,
					otp,
				}
			);
		}
		const data = parseRpcResponse(response);

		// The backend returns session data directly
		const sessionData = data.data || data;

		// Create a session object from the response
		// Backend SessionInfo has: userId, username, sessionToken, expiresAt
		const session = {
			token:
				sessionData.sessionToken ||
				sessionData.token ||
				sessionData.session_token,
			refresh_token: "", // Backend doesn't provide refresh tokens
			user_id: sessionData.userId || sessionData.user_id,
			username: sessionData.username,
			created_at: Date.now(),
			expires_at:
				sessionData.expiresAt || sessionData.expires_at || Date.now() + 3600000, // 1 hour default
		};

		return {
			session,
			data: sessionData,
		};
	} catch (error) {
		console.error("Verify registration OTP failed:", error);
		throw new Error(error.message || "Failed to verify OTP");
	}
}

/**
 * Skip verification and create unverified account (deferred verification)
 * @param {object} client - Nakama client
 * @param {string} email - Email
 * @returns {object} Session and user data
 */
export async function skipVerification(client, email) {
	try {
		if (!client) {
			throw new Error("Nakama client is not initialized");
		}
		if (!email) {
			throw new Error("Email is required");
		}

		const response = await callUnauthenticatedRpc(
			client,
			"auth/skip_verification",
			{
				email,
			}
		);
		const data = parseRpcResponse(response);

		// The backend returns session data directly
		const sessionData = data.data || data;

		// Create a session object from the response
		const session = {
			token:
				sessionData.sessionToken ||
				sessionData.token ||
				sessionData.session_token,
			refresh_token: "",
			user_id: sessionData.userId || sessionData.user_id,
			username: sessionData.username,
			created_at: Date.now(),
			expires_at:
				sessionData.expiresAt || sessionData.expires_at || Date.now() + 3600000,
		};

		return {
			session,
			data: sessionData,
		};
	} catch (error) {
		console.error("Skip verification failed:", error);
		throw new Error(error.message || "Failed to skip verification");
	}
}

/**
 * Resend OTP for registration
 * @param {object} client - Nakama client
 * @param {string} email - Email
 * @returns {object} Result
 */
export async function resendOTP(client, email) {
	try {
		if (!client) {
			throw new Error("Nakama client is not initialized");
		}
		if (!email) {
			throw new Error("Email is required");
		}

		const response = await callUnauthenticatedRpc(client, "auth/resend_otp", {
			email,
		});
		const data = parseRpcResponse(response);
		return data.data || data;
	} catch (error) {
		console.error("Resend OTP failed:", error);
		throw new Error(error.message || "Failed to resend OTP");
	}
}

// ========================================
// EMAIL LOGIN
// ========================================

/**
 * Login with email (send OTP)
 * @param {object} client - Nakama client
 * @param {string} email - Email
 * @param {string} password - Password
 * @returns {object} Result
 */
export async function loginWithEmail(client, email, password) {
	try {
		if (!client) {
			throw new Error("Nakama client is not initialized");
		}
		if (!email || !password) {
			throw new Error("Email and password are required");
		}

		// Direct login with email and password (no OTP required)
		const response = await callUnauthenticatedRpc(client, "auth/login_email", {
			email,
			password,
		});
		const data = parseRpcResponse(response);

		// The backend returns session data directly
		const sessionData = data.data || data;

		// Create a session object from the response
		// Backend SessionInfo has: userId, username, sessionToken, expiresAt
		const session = {
			token:
				sessionData.sessionToken ||
				sessionData.token ||
				sessionData.session_token,
			refresh_token: "", // Backend doesn't provide refresh tokens
			user_id: sessionData.userId || sessionData.user_id,
			username: sessionData.username,
			created_at: Date.now(),
			expires_at:
				sessionData.expiresAt || sessionData.expires_at || Date.now() + 3600000, // 1 hour default
		};

		return {
			session,
			data: sessionData,
		};
	} catch (error) {
		console.error("Login with email failed:", error);
		throw new Error(error.message || "Failed to login with email");
	}
}

/**
 * Send OTP for email verification (legacy - for OTP-based flows if needed)
 * @param {object} client - Nakama client
 * @param {string} email - Email
 * @param {string} password - Password
 * @returns {object} Response data
 */
export async function sendLoginOTP(client, email, password) {
	try {
		if (!client) {
			throw new Error("Nakama client is not initialized");
		}
		if (!email || !password) {
			throw new Error("Email and password are required");
		}

		const response = await callUnauthenticatedRpc(client, "auth/send_otp", {
			email,
			password,
		});
		const data = parseRpcResponse(response);
		return data.data || data;
	} catch (error) {
		console.error("Send OTP failed:", error);
		throw new Error(error.message || "Failed to send OTP");
	}
}

/**
 * Request password reset OTP
 * @param {object} client - Nakama client
 * @param {string} email - Email address
 * @returns {object} Response data
 */
export async function forgotPassword(client, email) {
	try {
		if (!client) {
			throw new Error("Nakama client is not initialized");
		}
		if (!email) {
			throw new Error("Email is required");
		}

		const response = await callUnauthenticatedRpc(
			client,
			"auth/forgot_password",
			{
				email,
			}
		);
		const data = parseRpcResponse(response);
		return data.data || data;
	} catch (error) {
		console.error("Forgot password failed:", error);
		throw new Error(error.message || "Failed to send password reset code");
	}
}

/**
 * Reset password with OTP
 * @param {object} client - Nakama client
 * @param {string} email - Email address
 * @param {string} otp - OTP code
 * @param {string} newPassword - New password
 * @returns {object} Response data
 */
export async function resetPassword(client, email, otp, newPassword) {
	try {
		if (!client) {
			throw new Error("Nakama client is not initialized");
		}
		if (!email || !otp || !newPassword) {
			throw new Error("Email, OTP, and new password are required");
		}

		const response = await callUnauthenticatedRpc(
			client,
			"auth/reset_password",
			{
				email,
				otp,
				newPassword,
			}
		);
		const data = parseRpcResponse(response);
		return data.data || data;
	} catch (error) {
		console.error("Reset password failed:", error);
		throw new Error(error.message || "Failed to reset password");
	}
}

/**
 * Verify login OTP (legacy - for OTP-based flows if needed)
 * @param {object} client - Nakama client
 * @param {string} email - Email
 * @param {string} otp - OTP code
 * @returns {object} Session and user data
 */
export async function verifyLoginOTP(client, email, otp) {
	try {
		if (!client) {
			throw new Error("Nakama client is not initialized");
		}
		if (!email || !otp) {
			throw new Error("Email and OTP are required");
		}

		const response = await callUnauthenticatedRpc(client, "auth/verify_otp", {
			email,
			otp,
		});
		const data = parseRpcResponse(response);

		// The backend returns session data directly
		const sessionData = data.data || data;

		// Create a session object from the response
		// Backend SessionInfo has: userId, username, sessionToken, expiresAt
		const session = {
			token:
				sessionData.sessionToken ||
				sessionData.token ||
				sessionData.session_token,
			refresh_token: "", // Backend doesn't provide refresh tokens
			user_id: sessionData.userId || sessionData.user_id,
			username: sessionData.username,
			created_at: Date.now(),
			expires_at:
				sessionData.expiresAt || sessionData.expires_at || Date.now() + 3600000, // 1 hour default
		};

		return {
			session,
			data: sessionData,
		};
	} catch (error) {
		console.error("Verify login OTP failed:", error);
		throw new Error(error.message || "Failed to verify OTP");
	}
}

// ========================================
// GOOGLE LOGIN
// ========================================

/**
 * Login with Google OAuth
 * @param {object} client - Nakama client
 * @param {string} idToken - Google ID token
 * @param {object} existingSession - Optional: existing session for account upgrade
 * @returns {object} Session and user data
 */
export async function loginWithGoogle(
	client,
	idToken,
	existingSession = null,
	socket = null
) {
	let response;

	// Check if user is already logged in (account upgrade flow)
	if (existingSession && existingSession.token && socket) {
		console.log(
			"🔄 User already logged in - upgrading account with Google login"
		);
		console.log("🔄 Existing UserID:", existingSession.user_id);
		console.log("🔄 Existing Username:", existingSession.username);

		// Call as authenticated RPC via socket - backend will extract userID from session token
		// This triggers account upgrade flow (preserves username and all data)
		// Note: socket.rpc() expects payload as JSON string
		response = await socket.rpc(
			"auth/google_login",
			JSON.stringify({
				id_token: idToken,
			})
		);
	} else {
		console.log("🆕 New user or not logged in - creating/logging in account");

		// Call as unauthenticated RPC - backend will create new account or login
		response = await callUnauthenticatedRpc(client, "auth/google_login", {
			id_token: idToken,
		});
	}

	const data = parseRpcResponse(response);

	// The backend returns session data directly
	const sessionData = data.data || data;

	// Create a session object from the response
	// Backend SessionInfo has: userId, username, sessionToken, expiresAt
	const session = {
		token:
			sessionData.sessionToken ||
			sessionData.token ||
			sessionData.session_token,
		refresh_token: "", // Backend doesn't provide refresh tokens
		user_id: sessionData.userId || sessionData.user_id,
		username: sessionData.username,
		created_at: Date.now(),
		expires_at:
			sessionData.expiresAt || sessionData.expires_at || Date.now() + 3600000, // 1 hour default
	};

	// Log account upgrade success
	if (
		existingSession &&
		existingSession.user_id === session.user_id &&
		existingSession.username === session.username
	) {
		console.log("✅ Account upgraded successfully!");
		console.log("✅ Username preserved:", session.username);
		console.log("✅ UserID preserved:", session.user_id);
	} else if (existingSession) {
		console.warn(
			"⚠️ Warning: UserID or username changed during upgrade - this should not happen!"
		);
		console.warn("Old UserID:", existingSession.user_id);
		console.warn("New UserID:", session.user_id);
		console.warn("Old Username:", existingSession.username);
		console.warn("New Username:", session.username);
	}

	return {
		session,
		data: sessionData,
	};
}

// ========================================
// ACCOUNT LINKING
// ========================================

/**
 * Link email to guest account
 * @param {object} client - Nakama client
 * @param {object} session - Current session
 * @param {string} email - Email
 * @param {string} password - Password
 * @returns {object} Result
 */
export async function linkEmail(client, session, email, password) {
	const response = await client.rpc(session, "auth/link_email", {
		email,
		password,
	});
	const data = parseRpcResponse(response);
	return data.data || data;
}

/**
 * Verify email link OTP
 * @param {object} client - Nakama client
 * @param {object} session - Current session
 * @param {string} otp - OTP code
 * @returns {object} Result
 */
export async function verifyEmailLink(client, session, otp) {
	const response = await client.rpc(session, "auth/verify_email_link", {
		otp,
	});
	const data = parseRpcResponse(response);
	return data.data || data;
}

// ========================================
// PROFILE MANAGEMENT
// ========================================

/**
 * Get user profile
 * @param {object} client - Nakama client
 * @param {object} session - Current session
 * @returns {object} User profile
 */
export async function getUserProfile(client, session) {
	const response = await client.rpc(session, "auth/get_profile", {});
	const data = parseRpcResponse(response);
	return data.data || data;
}

/**
 * Update user profile
 * @param {object} client - Nakama client
 * @param {object} session - Current session
 * @param {string} displayName - Display name
 * @param {string} bio - Bio
 * @param {string} country - Country code
 * @returns {object} Result
 */
export async function updateUserProfile(
	client,
	session,
	displayName,
	bio,
	country
) {
	const response = await client.rpc(session, "auth/update_profile", {
		display_name: displayName,
		bio,
		country,
	});
	const data = parseRpcResponse(response);
	return data.data || data;
}

/**
 * Refresh session
 * @param {object} client - Nakama client
 * @param {object} session - Current session
 * @returns {object} New session
 */
export async function refreshSession(client, session) {
	const response = await client.rpc(session, "auth/refresh_session", {});
	const data = parseRpcResponse(response);

	// Return the current session (Nakama handles refresh automatically)
	return {
		session,
		data: data.data || data,
	};
}

// ========================================
// PRESENCE MANAGEMENT
// ========================================

/**
 * Get online status for user(s)
 * @param {object} client - Nakama client
 * @param {object} session - Current session
 * @param {string|array} userIds - User ID or array of user IDs
 * @returns {object} Online status
 */
export async function getOnlineStatus(client, session, userIds) {
	const response = await client.rpc(session, "presence/get_online_status", {
		user_ids: Array.isArray(userIds) ? userIds : [userIds],
	});
	const data = parseRpcResponse(response);
	return data.data || data;
}

/**
 * Get online friends
 * @param {object} client - Nakama client
 * @param {object} session - Current session
 * @returns {object} Online friends list
 */
export async function getOnlineFriends(client, session) {
	const response = await client.rpc(session, "presence/get_online_friends", {});
	const data = parseRpcResponse(response);
	return data.data || data;
}
