import React, { useState } from "react";
import "./AuthTester.css";
import GoogleLoginButton from "./GoogleLoginButton";
import {
	registerEmail,
	verifyRegistrationOTP,
	skipVerification,
	resendOTP,
	checkUsernameAvailable,
	loginWithEmail,
	loginWithGoogle,
	loginAsGuest,
	linkEmail,
	verifyEmailLink,
	getUserProfile,
	updateUserProfile,
	refreshSession,
} from "../utils/authClient";

/**
 * Authentication Tester Component
 * Comprehensive UI for testing all authentication endpoints
 */
function AuthTester({ client, session, setSession, onAuthSuccess }) {
	// Tab state
	const [activeTab, setActiveTab] = useState("guest");

	// Guest login state
	const [guestForm, setGuestForm] = useState({
		deviceId: `device_${Math.random().toString(36).substr(2, 9)}`,
	});

	// Email registration state
	const [registerForm, setRegisterForm] = useState({
		username: "",
		email: "",
		password: "",
		otp: "",
	});
	const [registrationStep, setRegistrationStep] = useState("form"); // 'form' | 'otp'
	const [usernameAvailable, setUsernameAvailable] = useState(null);
	const [remainingAttempts, setRemainingAttempts] = useState(null);
	const [resendCooldown, setResendCooldown] = useState(0);

	// Email login state
	const [loginForm, setLoginForm] = useState({
		email: "",
		password: "",
	});

	// Google login state
	const [googleForm, setGoogleForm] = useState({
		idToken: "",
	});

	// Account linking state
	const [linkForm, setLinkForm] = useState({
		email: "",
		password: "",
		otp: "",
	});
	const [linkStep, setLinkStep] = useState("form"); // 'form' | 'otp'

	// Profile state
	const [profile, setProfile] = useState(null);
	const [profileForm, setProfileForm] = useState({
		displayName: "",
		bio: "",
		country: "",
	});

	// Status messages
	const [status, setStatus] = useState({ type: "", message: "" });
	const [loading, setLoading] = useState(false);

	// Helper to show status
	const showStatus = (type, message) => {
		setStatus({ type, message });
		setTimeout(() => setStatus({ type: "", message: "" }), 5000);
	};

	// Helper to extract remaining attempts from error message
	const extractRemainingAttempts = (errorMessage) => {
		const match = errorMessage.match(/(\d+) attempt\(s\) remaining/);
		if (match) {
			return parseInt(match[1], 10);
		}
		return null;
	};

	// Helper to extract rate limit cooldown from error message
	const extractRateLimitCooldown = (errorMessage) => {
		const match = errorMessage.match(/Try again after (\d+) seconds/);
		if (match) {
			return parseInt(match[1], 10);
		}
		return null;
	};

	// Start cooldown timer
	const startCooldownTimer = (seconds) => {
		setResendCooldown(seconds);
		const interval = setInterval(() => {
			setResendCooldown((prev) => {
				if (prev <= 1) {
					clearInterval(interval);
					return 0;
				}
				return prev - 1;
			});
		}, 1000);
	};

	// ========================================
	// GUEST LOGIN
	// ========================================
	const handleGuestLogin = async () => {
		if (!client) {
			showStatus("error", "Client not initialized. Please refresh the page.");
			return;
		}
		setLoading(true);
		try {
			const result = await loginAsGuest(client, guestForm.deviceId);
			setSession(result.session);
			showStatus("success", `Logged in as ${result.data.username}`);
			if (onAuthSuccess) onAuthSuccess(result.session);
		} catch (error) {
			console.error("Guest login error:", error);
			showStatus("error", error.message || "Failed to login as guest");
		} finally {
			setLoading(false);
		}
	};

	// ========================================
	// EMAIL REGISTRATION
	// ========================================
	const handleCheckUsername = async () => {
		if (!client) {
			showStatus("error", "Client not initialized. Please refresh the page.");
			return;
		}
		if (!registerForm.username) return;
		try {
			const result = await checkUsernameAvailable(
				client,
				registerForm.username
			);
			setUsernameAvailable(result.available);
			showStatus(result.available ? "success" : "error", result.message);
		} catch (error) {
			console.error("Check username error:", error);
			showStatus("error", error.message || "Failed to check username");
		}
	};

	const handleRegisterEmail = async () => {
		if (!client) {
			showStatus("error", "Client not initialized. Please refresh the page.");
			return;
		}
		setLoading(true);
		try {
			const result = await registerEmail(
				client,
				registerForm.username,
				registerForm.email,
				registerForm.password
			);
			setRegistrationStep("otp");
			setRemainingAttempts(null);
			setResendCooldown(0);
			showStatus("success", result.message);
		} catch (error) {
			console.error("Register email error:", error);
			const errorMessage = error.message || "Failed to register";

			// Provide user-friendly error messages with actionable suggestions
			if (
				errorMessage.includes("already registered") ||
				errorMessage.includes("Email already exists")
			) {
				showStatus(
					"error",
					"This email is already registered. Please log in instead or use a different email."
				);
			} else if (errorMessage.includes("Username already exists")) {
				showStatus(
					"error",
					"This username is already taken. Please choose a different username."
				);
			} else if (errorMessage.includes("Registration already in progress")) {
				showStatus(
					"error",
					"Registration already in progress. Please verify your email or resend OTP."
				);
				// Automatically move to OTP step if registration is pending
				setRegistrationStep("otp");
			} else {
				showStatus("error", errorMessage);
			}
		} finally {
			setLoading(false);
		}
	};

	const handleVerifyRegistration = async () => {
		if (!client) {
			showStatus("error", "Client not initialized. Please refresh the page.");
			return;
		}
		setLoading(true);
		try {
			const result = await verifyRegistrationOTP(
				client,
				registerForm.email,
				registerForm.otp
			);
			setSession(result.session);
			setRegistrationStep("form");
			setRemainingAttempts(null);
			showStatus("success", `Account created! Welcome ${result.data.username}`);
			if (onAuthSuccess) onAuthSuccess(result.session);
		} catch (error) {
			console.error("Verify registration error:", error);
			const errorMessage = error.message || "Failed to verify OTP";

			// Extract remaining attempts from error message
			const attempts = extractRemainingAttempts(errorMessage);
			if (attempts !== null) {
				setRemainingAttempts(attempts);
			}

			// Provide user-friendly error messages
			if (errorMessage.includes("Maximum OTP attempts exceeded")) {
				showStatus(
					"error",
					"Too many incorrect attempts. Please request a new OTP by clicking 'Resend OTP'."
				);
				setRemainingAttempts(0);
			} else if (errorMessage.includes("OTP has expired")) {
				showStatus(
					"error",
					"This OTP has expired. Please click 'Resend OTP' to get a new code."
				);
			} else if (errorMessage.includes("No verification pending")) {
				showStatus(
					"error",
					"No verification pending for this email. Please register again."
				);
				setRegistrationStep("form");
			} else {
				showStatus("error", errorMessage);
			}
		} finally {
			setLoading(false);
		}
	};

	const handleSkipVerification = async () => {
		if (!client) {
			showStatus("error", "Client not initialized. Please refresh the page.");
			return;
		}
		setLoading(true);
		try {
			const result = await skipVerification(client, registerForm.email);
			setSession(result.session);
			setRegistrationStep("form");
			setRemainingAttempts(null);
			showStatus(
				"success",
				`Welcome ${result.data.username}! You can verify your email later.`
			);
			if (onAuthSuccess) onAuthSuccess(result.session);
		} catch (error) {
			console.error("Skip verification error:", error);
			showStatus("error", error.message || "Failed to skip verification");
		} finally {
			setLoading(false);
		}
	};

	const handleResendOTP = async () => {
		if (!client) {
			showStatus("error", "Client not initialized. Please refresh the page.");
			return;
		}
		setLoading(true);
		try {
			const result = await resendOTP(client, registerForm.email);
			setRemainingAttempts(null); // Reset attempts on new OTP
			showStatus("success", result.message || "OTP sent successfully!");
		} catch (error) {
			console.error("Resend OTP error:", error);
			const errorMessage = error.message || "Failed to resend OTP";

			// Extract rate limit cooldown from error message
			const cooldown = extractRateLimitCooldown(errorMessage);
			if (cooldown !== null) {
				startCooldownTimer(cooldown);
			}

			showStatus("error", errorMessage);
		} finally {
			setLoading(false);
		}
	};

	// ========================================
	// EMAIL LOGIN
	// ========================================
	const handleLoginEmail = async () => {
		if (!client) {
			showStatus("error", "Client not initialized. Please refresh the page.");
			return;
		}

		// Validate inputs
		if (!loginForm.email || !loginForm.password) {
			showStatus("error", "Please enter both email and password");
			return;
		}

		setLoading(true);
		try {
			const result = await loginWithEmail(
				client,
				loginForm.email,
				loginForm.password
			);
			setSession(result.session);
			showStatus("success", `Welcome back ${result.data.username}!`);
			if (onAuthSuccess) onAuthSuccess(result.session);
		} catch (error) {
			console.error("Login email error:", error);

			// Check if it's an authentication error (email not registered)
			if (
				error.message &&
				(error.message.includes("Email not registered") ||
					error.message.includes("incorrect password"))
			) {
				showStatus(
					"error",
					"Email not registered or incorrect password. Please check your credentials or register a new account."
				);
			} else {
				showStatus("error", error.message || "Failed to login");
			}
		} finally {
			setLoading(false);
		}
	};

	// ========================================
	// GOOGLE LOGIN
	// ========================================
	const handleGoogleLogin = async (idToken) => {
		if (!client) {
			showStatus("error", "Client not initialized. Please refresh the page.");
			return;
		}
		setLoading(true);
		try {
			const result = await loginWithGoogle(client, idToken);
			setSession(result.session);
			showStatus("success", `Logged in as ${result.session.username}`);
			if (onAuthSuccess) onAuthSuccess(result.session);
		} catch (error) {
			console.error("Google login error:", error);
			showStatus("error", error.message || "Failed to login with Google");
		} finally {
			setLoading(false);
		}
	};

	const handleGoogleError = (error) => {
		showStatus("error", `Google login failed: ${error.message}`);
	};

	// ========================================
	// ACCOUNT LINKING
	// ========================================
	const handleLinkEmail = async () => {
		setLoading(true);
		try {
			const result = await linkEmail(
				client,
				session,
				linkForm.email,
				linkForm.password
			);
			setLinkStep("otp");
			showStatus("success", result.message);
		} catch (error) {
			showStatus("error", error.message);
		} finally {
			setLoading(false);
		}
	};

	const handleVerifyLink = async () => {
		setLoading(true);
		try {
			const result = await verifyEmailLink(client, session, linkForm.otp);
			setLinkStep("form");
			showStatus("success", result.message);
			// Refresh profile to show updated security status
			await handleGetProfile();
		} catch (error) {
			showStatus("error", error.message);
		} finally {
			setLoading(false);
		}
	};

	// ========================================
	// PROFILE MANAGEMENT
	// ========================================
	const handleGetProfile = async () => {
		setLoading(true);
		try {
			const result = await getUserProfile(client, session);
			setProfile(result);
			setProfileForm({
				displayName: result.displayName || "",
				bio: result.bio || "",
				country: result.country || "",
			});
			showStatus("success", "Profile loaded");
		} catch (error) {
			showStatus("error", error.message);
		} finally {
			setLoading(false);
		}
	};

	const handleUpdateProfile = async () => {
		setLoading(true);
		try {
			const result = await updateUserProfile(
				client,
				session,
				profileForm.displayName,
				profileForm.bio,
				profileForm.country
			);
			showStatus("success", result.message);
			await handleGetProfile();
		} catch (error) {
			showStatus("error", error.message);
		} finally {
			setLoading(false);
		}
	};

	const handleRefreshSession = async () => {
		setLoading(true);
		try {
			const result = await refreshSession(client, session);
			setSession(result.session);
			showStatus("success", "Session refreshed");
		} catch (error) {
			showStatus("error", error.message);
		} finally {
			setLoading(false);
		}
	};

	// If already authenticated, show profile management
	if (session) {
		return (
			<div className="auth-tester">
				<h2>🔐 Authenticated User Dashboard</h2>

				{/* Status Message */}
				{status.message && (
					<div className={`status-message ${status.type}`}>
						{status.message}
					</div>
				)}

				{/* Session Info */}
				<div className="card">
					<h3>📱 Current Session</h3>
					<div className="info-grid">
						<div>
							<strong>User ID:</strong> {session.user_id}
						</div>
						<div>
							<strong>Username:</strong> {session.username}
						</div>
					</div>
					<button
						onClick={handleRefreshSession}
						disabled={loading}
						className="btn-primary"
					>
						🔄 Refresh Session
					</button>
				</div>

				{/* Profile Section */}
				<div className="card">
					<h3>👤 User Profile</h3>
					{!profile ? (
						<button
							onClick={handleGetProfile}
							disabled={loading}
							className="btn-primary"
						>
							📥 Load Profile
						</button>
					) : (
						<div>
							<div className="profile-display">
								<div className="info-grid">
									<div>
										<strong>Username:</strong> {profile.username}
									</div>
									<div>
										<strong>Email:</strong> {profile.email || "N/A"}
									</div>
									<div>
										<strong>Account Type:</strong> {profile.accountType}
									</div>
									<div>
										<strong>Is Secure:</strong>{" "}
										{profile.isSecure ? "✅ Yes" : "❌ No"}
									</div>
									<div>
										<strong>Is Verified:</strong>{" "}
										{profile.isVerified ? "✅ Yes" : "❌ No"}
									</div>
									<div>
										<strong>Is Online:</strong>{" "}
										{profile.isOnline ? "🟢 Online" : "⚫ Offline"}
									</div>
									<div>
										<strong>Followers:</strong> {profile.followersCount}
									</div>
									<div>
										<strong>Following:</strong> {profile.followingCount}
									</div>
									<div>
										<strong>Friends:</strong> {profile.friendsCount}
									</div>
									<div>
										<strong>Bio:</strong> {profile.bio || "N/A"}
									</div>
									<div>
										<strong>Country:</strong> {profile.country || "N/A"}
									</div>
								</div>
							</div>

							<h4>Update Profile</h4>
							<div className="form-group">
								<label>Display Name:</label>
								<input
									type="text"
									value={profileForm.displayName}
									onChange={(e) =>
										setProfileForm({
											...profileForm,
											displayName: e.target.value,
										})
									}
									placeholder="Your display name"
								/>
							</div>
							<div className="form-group">
								<label>Bio:</label>
								<textarea
									value={profileForm.bio}
									onChange={(e) =>
										setProfileForm({ ...profileForm, bio: e.target.value })
									}
									placeholder="Tell us about yourself"
									rows="3"
								/>
							</div>
							<div className="form-group">
								<label>Country:</label>
								<input
									type="text"
									value={profileForm.country}
									onChange={(e) =>
										setProfileForm({ ...profileForm, country: e.target.value })
									}
									placeholder="US"
									maxLength="2"
								/>
							</div>
							<button
								onClick={handleUpdateProfile}
								disabled={loading}
								className="btn-primary"
							>
								💾 Update Profile
							</button>
						</div>
					)}
				</div>

				{/* Account Linking (only for guest accounts) */}
				{profile && !profile.isSecure && (
					<div className="card warning">
						<h3>⚠️ Unsecured Account</h3>
						<p>
							Your account is not secure. Link an email to prevent data loss!
						</p>

						{linkStep === "form" ? (
							<div>
								<div className="form-group">
									<label>Email:</label>
									<input
										type="email"
										value={linkForm.email}
										onChange={(e) =>
											setLinkForm({ ...linkForm, email: e.target.value })
										}
										placeholder="your@email.com"
									/>
								</div>
								<div className="form-group">
									<label>Password:</label>
									<input
										type="password"
										value={linkForm.password}
										onChange={(e) =>
											setLinkForm({ ...linkForm, password: e.target.value })
										}
										placeholder="Secure password"
									/>
								</div>
								<button
									onClick={handleLinkEmail}
									disabled={loading}
									className="btn-success"
								>
									🔗 Link Email
								</button>
							</div>
						) : (
							<div>
								<p>✅ OTP sent to {linkForm.email}</p>
								<div className="form-group">
									<label>Enter OTP:</label>
									<input
										type="text"
										value={linkForm.otp}
										onChange={(e) =>
											setLinkForm({ ...linkForm, otp: e.target.value })
										}
										placeholder="123456"
										maxLength="6"
									/>
								</div>
								<button
									onClick={handleVerifyLink}
									disabled={loading}
									className="btn-success"
								>
									✅ Verify OTP
								</button>
								<button
									onClick={() => setLinkStep("form")}
									className="btn-secondary"
								>
									← Back
								</button>
							</div>
						)}
					</div>
				)}
			</div>
		);
	}

	// Not authenticated - show login/register options
	return (
		<div className="auth-tester">
			<h2>🔐 Authentication Tester</h2>

			{/* Status Message */}
			{status.message && (
				<div className={`status-message ${status.type}`}>{status.message}</div>
			)}

			{/* Tabs */}
			<div className="tabs">
				<button
					className={activeTab === "guest" ? "active" : ""}
					onClick={() => setActiveTab("guest")}
				>
					👤 Guest Login
				</button>
				<button
					className={activeTab === "register" ? "active" : ""}
					onClick={() => setActiveTab("register")}
				>
					📝 Register
				</button>
				<button
					className={activeTab === "login" ? "active" : ""}
					onClick={() => setActiveTab("login")}
				>
					🔑 Email Login
				</button>
				<button
					className={activeTab === "google" ? "active" : ""}
					onClick={() => setActiveTab("google")}
				>
					🔵 Google
				</button>
			</div>

			{/* Tab Content */}
			<div className="tab-content">
				{/* Guest Login Tab */}
				{activeTab === "guest" && (
					<div className="card">
						<h3>👤 Login as Guest</h3>
						<p>
							Quick login with device ID. Your data will be lost if you logout
							without linking an email.
						</p>
						<div className="form-group">
							<label>Device ID:</label>
							<input
								type="text"
								value={guestForm.deviceId}
								onChange={(e) =>
									setGuestForm({ ...guestForm, deviceId: e.target.value })
								}
								placeholder="device_abc123"
							/>
						</div>
						<button
							onClick={handleGuestLogin}
							disabled={loading}
							className="btn-primary"
						>
							🚀 Login as Guest
						</button>
					</div>
				)}

				{/* Email Registration Tab */}
				{activeTab === "register" && (
					<div className="card">
						<h3>📝 Register with Email</h3>
						{registrationStep === "form" ? (
							<div>
								<div className="form-group">
									<label>Username:</label>
									<input
										type="text"
										value={registerForm.username}
										onChange={(e) =>
											setRegisterForm({
												...registerForm,
												username: e.target.value,
											})
										}
										onBlur={handleCheckUsername}
										placeholder="cool-username"
									/>
									{usernameAvailable !== null && (
										<small
											className={
												usernameAvailable ? "text-success" : "text-error"
											}
										>
											{usernameAvailable ? "✅ Available" : "❌ Taken"}
										</small>
									)}
								</div>
								<div className="form-group">
									<label>Email:</label>
									<input
										type="email"
										value={registerForm.email}
										onChange={(e) =>
											setRegisterForm({
												...registerForm,
												email: e.target.value,
											})
										}
										placeholder="your@email.com"
									/>
								</div>
								<div className="form-group">
									<label>Password:</label>
									<input
										type="password"
										value={registerForm.password}
										onChange={(e) =>
											setRegisterForm({
												...registerForm,
												password: e.target.value,
											})
										}
										placeholder="Min 8 chars, 1 letter, 1 number"
									/>
								</div>
								<button
									onClick={handleRegisterEmail}
									disabled={loading}
									className="btn-success"
								>
									📧 Send OTP
								</button>
							</div>
						) : (
							<div>
								<p>✅ OTP sent to {registerForm.email}</p>
								<p style={{ fontSize: "14px", color: "#666" }}>
									Check your email for the 6-digit verification code.
								</p>

								<div className="form-group">
									<label>Enter OTP:</label>
									<input
										type="text"
										value={registerForm.otp}
										onChange={(e) =>
											setRegisterForm({ ...registerForm, otp: e.target.value })
										}
										placeholder="123456"
										maxLength="6"
									/>
									{remainingAttempts !== null && (
										<small
											style={{
												color: "#ff9800",
												marginTop: "5px",
												display: "block",
											}}
										>
											⚠️ {remainingAttempts} attempt(s) remaining
										</small>
									)}
								</div>

								<div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
									<button
										onClick={handleVerifyRegistration}
										disabled={loading}
										className="btn-success"
									>
										✅ Verify & Register
									</button>
									<button
										onClick={handleSkipVerification}
										disabled={loading}
										className="btn-secondary"
										style={{ backgroundColor: "#6c757d" }}
									>
										⏭️ Verify Later
									</button>
								</div>

								<div
									style={{
										marginTop: "15px",
										display: "flex",
										gap: "10px",
										flexWrap: "wrap",
									}}
								>
									<button
										onClick={handleResendOTP}
										disabled={loading || resendCooldown > 0}
										className="btn-secondary"
									>
										{resendCooldown > 0
											? `🔄 Resend in ${resendCooldown}s`
											: "🔄 Resend OTP"}
									</button>
									<button
										onClick={() => {
											setRegistrationStep("form");
											setRemainingAttempts(null);
											setResendCooldown(0);
										}}
										className="btn-secondary"
									>
										← Back
									</button>
								</div>

								<div
									style={{
										marginTop: "20px",
										padding: "15px",
										background: "#f8f9fa",
										borderRadius: "6px",
										fontSize: "14px",
									}}
								>
									<strong>ℹ️ Didn't receive the code?</strong>
									<ul style={{ marginTop: "10px", paddingLeft: "20px" }}>
										<li>Check your spam/junk folder</li>
										<li>Wait a few moments and click "Resend OTP"</li>
										<li>
											Or click "Verify Later" to continue without verification
										</li>
									</ul>
								</div>
							</div>
						)}
					</div>
				)}

				{/* Email Login Tab */}
				{activeTab === "login" && (
					<div className="card">
						<h3>🔑 Login with Email</h3>
						<p className="info-text">
							🔒 Enter your email and password to login
						</p>
						<div>
							<div className="form-group">
								<label>Email:</label>
								<input
									type="email"
									value={loginForm.email}
									onChange={(e) =>
										setLoginForm({ ...loginForm, email: e.target.value })
									}
									placeholder="your@email.com"
								/>
							</div>
							<div className="form-group">
								<label>Password:</label>
								<input
									type="password"
									value={loginForm.password}
									onChange={(e) =>
										setLoginForm({ ...loginForm, password: e.target.value })
									}
									placeholder="Your password"
								/>
							</div>
							<button
								onClick={handleLoginEmail}
								disabled={loading}
								className="btn-primary"
							>
								{loading ? "Logging in..." : "🔑 Login"}
							</button>
							<p className="help-text">
								Login directly with your email and password
							</p>
						</div>
					</div>
				)}

				{/* Google Login Tab */}
				{activeTab === "google" && (
					<div className="card">
						<h3>🔵 Login with Google</h3>
						<p>
							Click the button below to sign in with your Google account via
							Firebase
						</p>
						<GoogleLoginButton
							onSuccess={handleGoogleLogin}
							onError={handleGoogleError}
						/>
						<div
							style={{
								marginTop: "20px",
								padding: "15px",
								background: "#f8f9fa",
								borderRadius: "6px",
							}}
						>
							<strong>ℹ️ How it works:</strong>
							<ol
								style={{
									marginTop: "10px",
									paddingLeft: "20px",
									fontSize: "14px",
								}}
							>
								<li>Click the "Sign in with Google" button above</li>
								<li>A Google popup will appear</li>
								<li>Select your Google account</li>
								<li>You'll be logged in automatically!</li>
							</ol>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export default AuthTester;
