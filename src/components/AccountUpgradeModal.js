import React, { useState } from "react";
import GoogleLoginButton from "./GoogleLoginButton";
import {
	registerEmail,
	verifyRegistrationOTP,
	skipVerification,
	resendOTP,
	checkUsernameAvailable,
} from "../utils/authClient";
import "./AccountUpgradeModal.css";

/**
 * Account Upgrade Modal Component
 * Allows guest users to upgrade their account via Google or Email
 */
function AccountUpgradeModal({ client, onClose, onUpgraded }) {
	const [method, setMethod] = useState(null); // null | 'google' | 'email'
	const [step, setStep] = useState("form"); // 'form' | 'otp'
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	// Email registration state
	const [formData, setFormData] = useState({
		username: "",
		email: "",
		password: "",
		otp: "",
	});
	const [usernameAvailable, setUsernameAvailable] = useState(null);
	const [remainingAttempts, setRemainingAttempts] = useState(null);
	const [resendCooldown, setResendCooldown] = useState(0);

	// Helper functions
	const extractRemainingAttempts = (errorMessage) => {
		const match = errorMessage.match(/(\d+) attempt\(s\) remaining/);
		return match ? parseInt(match[1], 10) : null;
	};

	const extractRateLimitCooldown = (errorMessage) => {
		const match = errorMessage.match(/Try again after (\d+) seconds/);
		return match ? parseInt(match[1], 10) : null;
	};

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

	// Check username availability
	const handleCheckUsername = async () => {
		if (!formData.username) return;

		try {
			const result = await checkUsernameAvailable(client, formData.username);
			setUsernameAvailable(result.available);
			if (!result.available) {
				setError("This username is already taken");
			} else {
				setError("");
			}
		} catch (err) {
			console.error("Check username error:", err);
		}
	};

	// Handle email registration
	const handleRegisterEmail = async () => {
		if (!formData.username || !formData.email || !formData.password) {
			setError("Please fill in all fields");
			return;
		}

		if (!usernameAvailable) {
			setError("Please choose an available username");
			return;
		}

		setLoading(true);
		setError("");

		try {
			const result = await registerEmail(
				client,
				formData.username,
				formData.email,
				formData.password
			);
			setStep("otp");
			setSuccess(result.message || "OTP sent to your email!");
			setTimeout(() => setSuccess(""), 3000);
		} catch (err) {
			console.error("Register email error:", err);
			const errorMessage = err.message || "Failed to register";

			if (
				errorMessage.includes("already registered") ||
				errorMessage.includes("Email already exists")
			) {
				setError(
					"This email is already registered. Please use a different email."
				);
			} else if (errorMessage.includes("Username already exists")) {
				setError(
					"This username is already taken. Please choose a different one."
				);
				setUsernameAvailable(false);
			} else if (errorMessage.includes("Registration already in progress")) {
				setError("Registration already in progress. Moving to verification...");
				setStep("otp");
			} else {
				setError(errorMessage);
			}
		} finally {
			setLoading(false);
		}
	};

	// Handle OTP verification
	const handleVerifyOTP = async () => {
		if (!formData.otp || formData.otp.length !== 6) {
			setError("Please enter a valid 6-digit OTP");
			return;
		}

		setLoading(true);
		setError("");

		try {
			const result = await verifyRegistrationOTP(
				client,
				formData.email,
				formData.otp
			);
			setSuccess("Account upgraded successfully!");
			setTimeout(() => {
				if (onUpgraded) {
					onUpgraded(result.session);
				}
				onClose();
			}, 1500);
		} catch (err) {
			console.error("Verify OTP error:", err);
			const errorMessage = err.message || "Failed to verify OTP";

			const attempts = extractRemainingAttempts(errorMessage);
			if (attempts !== null) {
				setRemainingAttempts(attempts);
			}

			if (errorMessage.includes("Maximum OTP attempts exceeded")) {
				setError(
					"Too many incorrect attempts. Please request a new OTP by clicking 'Resend OTP'."
				);
				setRemainingAttempts(0);
			} else if (errorMessage.includes("OTP has expired")) {
				setError(
					"This OTP has expired. Please click 'Resend OTP' to get a new code."
				);
			} else {
				setError(errorMessage);
			}
		} finally {
			setLoading(false);
		}
	};

	// Handle skip verification
	const handleSkipVerification = async () => {
		setLoading(true);
		setError("");

		try {
			const result = await skipVerification(client, formData.email);
			setSuccess("Account created! You can verify your email later.");
			setTimeout(() => {
				if (onUpgraded) {
					onUpgraded(result.session);
				}
				onClose();
			}, 1500);
		} catch (err) {
			console.error("Skip verification error:", err);
			setError(err.message || "Failed to skip verification");
		} finally {
			setLoading(false);
		}
	};

	// Handle resend OTP
	const handleResendOTP = async () => {
		setLoading(true);
		setError("");

		try {
			const result = await resendOTP(client, formData.email);
			setRemainingAttempts(null);
			setSuccess(result.message || "OTP sent successfully!");
			setTimeout(() => setSuccess(""), 3000);
		} catch (err) {
			console.error("Resend OTP error:", err);
			const errorMessage = err.message || "Failed to resend OTP";

			const cooldown = extractRateLimitCooldown(errorMessage);
			if (cooldown !== null) {
				startCooldownTimer(cooldown);
			}

			setError(errorMessage);
		} finally {
			setLoading(false);
		}
	};

	// Handle Google login
	const handleGoogleLogin = async (idToken) => {
		setLoading(true);
		setError("");

		try {
			// Import loginWithGoogle dynamically to avoid circular dependency
			const { loginWithGoogle } = await import("../utils/authClient");
			const result = await loginWithGoogle(client, idToken);
			setSuccess("Account upgraded with Google!");
			setTimeout(() => {
				if (onUpgraded) {
					onUpgraded(result.session);
				}
				onClose();
			}, 1500);
		} catch (err) {
			console.error("Google login error:", err);
			setError(err.message || "Failed to login with Google");
		} finally {
			setLoading(false);
		}
	};

	const handleGoogleError = (err) => {
		setError(`Google login failed: ${err.message}`);
	};

	// Render method selection
	if (!method) {
		return (
			<div className="modal-overlay" onClick={onClose}>
				<div
					className="modal-content upgrade-modal"
					onClick={(e) => e.stopPropagation()}
				>
					<div className="modal-header">
						<h2>Secure Your Account</h2>
						<button className="modal-close" onClick={onClose}>
							×
						</button>
					</div>

					<div className="modal-body">
						<p className="modal-description">
							Choose how you'd like to secure your account and save your
							progress:
						</p>

						<div className="method-selection">
							<button
								className="method-card google"
								onClick={() => setMethod("google")}
							>
								<div className="method-icon">🔵</div>
								<h3>Continue with Google</h3>
								<p>Quick and secure sign-in with your Google account</p>
							</button>

							<button
								className="method-card email"
								onClick={() => setMethod("email")}
							>
								<div className="method-icon">📧</div>
								<h3>Register with Email</h3>
								<p>Create an account with your email and password</p>
							</button>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Render Google login
	if (method === "google") {
		return (
			<div className="modal-overlay" onClick={onClose}>
				<div
					className="modal-content upgrade-modal"
					onClick={(e) => e.stopPropagation()}
				>
					<div className="modal-header">
						<h2>Sign in with Google</h2>
						<button className="modal-close" onClick={onClose}>
							×
						</button>
					</div>

					<div className="modal-body">
						{error && <div className="alert alert-error">{error}</div>}
						{success && <div className="alert alert-success">{success}</div>}

						<div className="google-login-container">
							<GoogleLoginButton
								onSuccess={handleGoogleLogin}
								onError={handleGoogleError}
							/>
						</div>

						<button
							className="btn-secondary back-btn"
							onClick={() => setMethod(null)}
						>
							← Back to options
						</button>
					</div>
				</div>
			</div>
		);
	}

	// Render email registration - OTP step
	if (method === "email" && step === "otp") {
		return (
			<div className="modal-overlay" onClick={onClose}>
				<div
					className="modal-content upgrade-modal"
					onClick={(e) => e.stopPropagation()}
				>
					<div className="modal-header">
						<h2>Verify Your Email</h2>
						<button className="modal-close" onClick={onClose}>
							×
						</button>
					</div>

					<div className="modal-body">
						<p className="modal-description">
							Enter the 6-digit code sent to <strong>{formData.email}</strong>
						</p>

						{error && <div className="alert alert-error">{error}</div>}
						{success && <div className="alert alert-success">{success}</div>}

						<div className="form-group">
							<label>Verification Code:</label>
							<input
								type="text"
								value={formData.otp}
								onChange={(e) =>
									setFormData({
										...formData,
										otp: e.target.value.replace(/\D/g, ""),
									})
								}
								placeholder="123456"
								maxLength="6"
								className="otp-input"
								autoFocus
							/>
							{remainingAttempts !== null && (
								<small className="attempts-warning">
									⚠️ {remainingAttempts} attempt(s) remaining
								</small>
							)}
						</div>

						<div className="modal-actions">
							<button
								onClick={handleVerifyOTP}
								disabled={loading || !formData.otp || formData.otp.length !== 6}
								className="btn-primary"
							>
								{loading ? "Verifying..." : "✅ Verify & Upgrade"}
							</button>
							<button
								onClick={handleSkipVerification}
								disabled={loading}
								className="btn-secondary"
							>
								⏭️ Verify Later
							</button>
						</div>

						<div className="modal-actions">
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
									setStep("form");
									setRemainingAttempts(null);
									setResendCooldown(0);
								}}
								className="btn-secondary"
							>
								← Back
							</button>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Render email registration - Form step
	return (
		<div className="modal-overlay" onClick={onClose}>
			<div
				className="modal-content upgrade-modal"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="modal-header">
					<h2>Register with Email</h2>
					<button className="modal-close" onClick={onClose}>
						×
					</button>
				</div>

				<div className="modal-body">
					{error && <div className="alert alert-error">{error}</div>}
					{success && <div className="alert alert-success">{success}</div>}

					<div className="form-group">
						<label>Username:</label>
						<input
							type="text"
							value={formData.username}
							onChange={(e) =>
								setFormData({ ...formData, username: e.target.value })
							}
							onBlur={handleCheckUsername}
							placeholder="cool-username"
							className="form-input"
						/>
						{usernameAvailable !== null && (
							<small
								className={usernameAvailable ? "text-success" : "text-error"}
							>
								{usernameAvailable ? "✅ Available" : "❌ Taken"}
							</small>
						)}
					</div>

					<div className="form-group">
						<label>Email:</label>
						<input
							type="email"
							value={formData.email}
							onChange={(e) =>
								setFormData({ ...formData, email: e.target.value })
							}
							placeholder="your@email.com"
							className="form-input"
						/>
					</div>

					<div className="form-group">
						<label>Password:</label>
						<input
							type="password"
							value={formData.password}
							onChange={(e) =>
								setFormData({ ...formData, password: e.target.value })
							}
							placeholder="Min 8 chars, 1 letter, 1 number"
							className="form-input"
						/>
					</div>

					<div className="modal-actions">
						<button
							onClick={handleRegisterEmail}
							disabled={loading || !usernameAvailable}
							className="btn-primary"
						>
							{loading ? "Sending..." : "📧 Send OTP"}
						</button>
						<button onClick={() => setMethod(null)} className="btn-secondary">
							← Back to options
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

export default AccountUpgradeModal;
