import React, { useState } from "react";
import GoogleLoginButton from "./GoogleLoginButton";
import {
	registerEmail,
	loginWithGoogle,
	verifyRegistrationOTP,
	resendOTP,
} from "../utils/authClient";
import "./AccountChangeModal.css";

/**
 * Account Change Modal Component
 * Allows verified users to change their linked account (email or Google)
 */
function AccountChangeModal({ client, session, socket, onClose, onChanged }) {
	const [method, setMethod] = useState(null); // null | 'google' | 'email'
	const [step, setStep] = useState("form"); // 'form' | 'otp'
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	// Email change state
	const [formData, setFormData] = useState({
		email: "",
		password: "",
		otp: "",
		registrationId: "",
	});
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

	// Handle email change initiation
	// Uses unified auth/register_email endpoint (authenticated flow for account change)
	const handleChangeEmail = async () => {
		if (!formData.email || !formData.password) {
			setError("Please fill in email and password");
			return;
		}

		setLoading(true);
		setError("");

		try {
			// Use unified registerEmail endpoint - backend automatically detects verified account and handles account change
			const result = await registerEmail(
				client,
				"", // username not needed for account change
				formData.email,
				formData.password,
				session // Pass session for authenticated account change
			);

			// For account change, we use the authenticated flow which doesn't require registrationId
			// The email is stored in account metadata and OTP verification uses session
			setStep("otp");
			setSuccess(result.message || "OTP sent to your email!");
			setTimeout(() => setSuccess(""), 3000);
		} catch (err) {
			console.error("Change email error:", err);
			const errorMessage = err.message || "Failed to change account";

			if (
				errorMessage.includes("already registered") ||
				errorMessage.includes("Email already exists")
			) {
				setError(
					"This email is already registered by another account. Please use a different email."
				);
			} else {
				setError(errorMessage);
			}
		} finally {
			setLoading(false);
		}
	};

	// Handle OTP verification for email change
	const handleVerifyOTP = async () => {
		if (!formData.otp || formData.otp.length !== 6) {
			setError("Please enter a valid 6-digit OTP");
			return;
		}

		setLoading(true);
		setError("");

		try {
			// For account change (authenticated flow), registrationId is not needed
			// The backend uses the session token to identify the user
			// Verify OTP - pass session for authenticated account change
			const result = await verifyRegistrationOTP(
				client,
				formData.email,
				formData.otp,
				"", // registrationId not needed for authenticated account change
				session
			);

			setSuccess("Account changed successfully!");
			setTimeout(() => {
				if (onChanged) {
					onChanged(result.session || session);
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

	// Handle resend OTP
	const handleResendOTP = async () => {
		setLoading(true);
		setError("");

		try {
			// For account change (authenticated flow), registrationId is not needed
			const result = await resendOTP(
				client,
				formData.email,
				"", // registrationId not needed for authenticated account change
				session
			);
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

	// Handle Google account change
	// Uses unified auth/firebase_login endpoint (authenticated flow for account change)
	const handleGoogleChange = async (idToken) => {
		setLoading(true);
		setError("");

		try {
			// Use unified loginWithGoogle endpoint - backend automatically detects verified account and handles account change
			const result = await loginWithGoogle(
				client,
				idToken,
				session // Pass session for authenticated account change
			);

			setSuccess("Account changed to Google successfully!");
			setTimeout(() => {
				if (onChanged) {
					onChanged(result.session || session);
				}
				onClose();
			}, 1500);
		} catch (err) {
			console.error("Google change error:", err);
			const errorMessage = err.message || "Failed to change account";

			if (
				errorMessage.includes("already registered") ||
				errorMessage.includes("already linked")
			) {
				setError(
					"This Google account is already registered by another account. Please use a different Google account."
				);
			} else {
				setError(errorMessage);
			}
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
					className="modal-content change-account-modal"
					onClick={(e) => e.stopPropagation()}
				>
					<div className="modal-header">
						<h2>Change Account</h2>
						<button className="modal-close" onClick={onClose}>
							×
						</button>
					</div>

					<div className="modal-body">
						<p className="modal-description">
							Change your linked account. Your old account will be unlinked and
							can be used by others.
						</p>

						<div className="method-selection">
							<button
								className="method-card google"
								onClick={() => setMethod("google")}
							>
								<div className="method-icon">🔵</div>
								<h3>Change to Google</h3>
								<p>Link your account with a Google account</p>
							</button>

							<button
								className="method-card email"
								onClick={() => setMethod("email")}
							>
								<div className="method-icon">📧</div>
								<h3>Change to Email</h3>
								<p>Link your account with an email and password</p>
							</button>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Render Google change
	if (method === "google") {
		return (
			<div className="modal-overlay" onClick={onClose}>
				<div
					className="modal-content change-account-modal"
					onClick={(e) => e.stopPropagation()}
				>
					<div className="modal-header">
						<h2>Change to Google Account</h2>
						<button className="modal-close" onClick={onClose}>
							×
						</button>
					</div>

					<div className="modal-body">
						{error && <div className="alert alert-error">{error}</div>}
						{success && <div className="alert alert-success">{success}</div>}

						<div className="google-login-container">
							<GoogleLoginButton
								onSuccess={handleGoogleChange}
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

	// Render email change - OTP step
	if (method === "email" && step === "otp") {
		return (
			<div className="modal-overlay" onClick={onClose}>
				<div
					className="modal-content change-account-modal"
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
								{loading ? "Verifying..." : "✅ Verify & Change"}
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

	// Render email change - Form step
	return (
		<div className="modal-overlay" onClick={onClose}>
			<div
				className="modal-content change-account-modal"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="modal-header">
					<h2>Change to Email Account</h2>
					<button className="modal-close" onClick={onClose}>
						×
					</button>
				</div>

				<div className="modal-body">
					{error && <div className="alert alert-error">{error}</div>}
					{success && <div className="alert alert-success">{success}</div>}

					<div className="form-group">
						<label>
							Email: <span style={{ color: "#f44336" }}>*</span>
						</label>
						<input
							type="email"
							value={formData.email}
							onChange={(e) =>
								setFormData({ ...formData, email: e.target.value })
							}
							placeholder="your@email.com"
							className="form-input"
							required
						/>
					</div>

					<div className="form-group">
						<label>
							Password: <span style={{ color: "#f44336" }}>*</span>
						</label>
						<input
							type="password"
							value={formData.password}
							onChange={(e) =>
								setFormData({ ...formData, password: e.target.value })
							}
							placeholder="Min 8 chars, 1 letter, 1 number"
							className="form-input"
							required
						/>
					</div>

					<div className="modal-actions">
						<button
							onClick={handleChangeEmail}
							disabled={loading || !formData.email || !formData.password}
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

export default AccountChangeModal;
