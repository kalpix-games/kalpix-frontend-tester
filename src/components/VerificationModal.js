import React, { useState } from "react";
import { resendOTP, verifyRegistrationOTP } from "../utils/authClient";
import "./VerificationModal.css";

/**
 * Verification Modal Component
 * Allows unverified email users to verify their email
 */
function VerificationModal({ client, email, onClose, onVerified }) {
	const [otp, setOtp] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [remainingAttempts, setRemainingAttempts] = useState(null);
	const [resendCooldown, setResendCooldown] = useState(0);

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

	const handleVerify = async () => {
		if (!otp || otp.length !== 6) {
			setError("Please enter a valid 6-digit OTP");
			return;
		}

		setLoading(true);
		setError("");
		setSuccess("");

		try {
			const result = await verifyRegistrationOTP(client, email, otp);
			setSuccess("Email verified successfully!");
			setTimeout(() => {
				if (onVerified) {
					onVerified(result.session);
				}
				onClose();
			}, 1500);
		} catch (err) {
			console.error("Verify OTP error:", err);
			const errorMessage = err.message || "Failed to verify OTP";

			// Extract remaining attempts from error message
			const attempts = extractRemainingAttempts(errorMessage);
			if (attempts !== null) {
				setRemainingAttempts(attempts);
			}

			// Provide user-friendly error messages
			if (errorMessage.includes("already been verified")) {
				// Account was verified via another method (e.g., Google login)
				setError(
					"✅ Your account has already been verified! You can close this window and continue using the app."
				);
				// Auto-close after 3 seconds
				setTimeout(() => {
					onClose();
				}, 3000);
			} else if (errorMessage.includes("Maximum OTP attempts exceeded")) {
				setError(
					"Too many incorrect attempts. Please request a new OTP by clicking 'Resend OTP'."
				);
				setRemainingAttempts(0);
			} else if (errorMessage.includes("OTP has expired")) {
				setError(
					"This OTP has expired. Please click 'Resend OTP' to get a new code."
				);
			} else if (errorMessage.includes("No verification pending")) {
				setError("No verification pending for this email.");
			} else {
				setError(errorMessage);
			}
		} finally {
			setLoading(false);
		}
	};

	const handleResendOTP = async () => {
		setLoading(true);
		setError("");
		setSuccess("");

		try {
			const result = await resendOTP(client, email);
			setRemainingAttempts(null); // Reset attempts on new OTP
			setSuccess(result.message || "OTP sent successfully!");
			setTimeout(() => setSuccess(""), 3000);
		} catch (err) {
			console.error("Resend OTP error:", err);
			const errorMessage = err.message || "Failed to resend OTP";

			// Extract rate limit cooldown from error message
			const cooldown = extractRateLimitCooldown(errorMessage);
			if (cooldown !== null) {
				startCooldownTimer(cooldown);
			}

			setError(errorMessage);
		} finally {
			setLoading(false);
		}
	};

	const handleKeyPress = (e) => {
		if (e.key === "Enter" && !loading) {
			handleVerify();
		}
	};

	return (
		<div className="modal-overlay" onClick={onClose}>
			<div className="modal-content" onClick={(e) => e.stopPropagation()}>
				<div className="modal-header">
					<h2>Verify Your Email</h2>
					<button className="modal-close" onClick={onClose}>
						×
					</button>
				</div>

				<div className="modal-body">
					<p className="modal-description">
						Enter the 6-digit verification code sent to <strong>{email}</strong>
					</p>

					{error && <div className="alert alert-error">{error}</div>}
					{success && <div className="alert alert-success">{success}</div>}

					<div className="form-group">
						<label>Verification Code:</label>
						<input
							type="text"
							value={otp}
							onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
							onKeyPress={handleKeyPress}
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
							onClick={handleVerify}
							disabled={loading || !otp || otp.length !== 6}
							className="btn-primary"
						>
							{loading ? "Verifying..." : "✅ Verify Email"}
						</button>
						<button
							onClick={handleResendOTP}
							disabled={loading || resendCooldown > 0}
							className="btn-secondary"
						>
							{resendCooldown > 0
								? `🔄 Resend in ${resendCooldown}s`
								: "🔄 Resend OTP"}
						</button>
					</div>

					<div className="modal-help">
						<strong>ℹ️ Didn't receive the code?</strong>
						<ul>
							<li>Check your spam/junk folder</li>
							<li>Wait a few moments and click "Resend OTP"</li>
							<li>Make sure the email address is correct</li>
						</ul>
					</div>
				</div>
			</div>
		</div>
	);
}

export default VerificationModal;
