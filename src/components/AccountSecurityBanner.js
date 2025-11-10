import React, { useState, useEffect, useRef } from "react";
import { getUserProfile } from "../utils/authClient";
import VerificationModal from "./VerificationModal";
import AccountUpgradeModal from "./AccountUpgradeModal";
import "./AccountSecurityBanner.css";

/**
 * Account Security Banner Component
 * Shows banners for unverified email users and guest users
 * Periodically checks verification status and displays account linking notifications
 */
function AccountSecurityBanner({ client, session, onSessionUpdate }) {
	const [profile, setProfile] = useState(null);
	const [loading, setLoading] = useState(true);
	const [dismissed, setDismissed] = useState(false);
	const [showVerificationModal, setShowVerificationModal] = useState(false);
	const [showUpgradeModal, setShowUpgradeModal] = useState(false);
	const [notification, setNotification] = useState(null);
	const intervalRef = useRef(null);

	// Load profile function (extracted for reuse)
	const loadProfile = async () => {
		if (!client || !session) {
			setLoading(false);
			return;
		}

		try {
			const profileData = await getUserProfile(client, session);
			console.log("🔍 Banner Profile Data:", profileData);
			console.log("🔍 isSecure:", profileData.isSecure);
			console.log("🔍 isVerified:", profileData.isVerified);
			console.log("🔍 accountType:", profileData.accountType);

			// Check for account linking notification
			if (
				profileData.metadata &&
				profileData.metadata.accountLinkedNotification
			) {
				setNotification(profileData.metadata.accountLinkedNotification);
				// Auto-dismiss notification after 10 seconds
				setTimeout(() => setNotification(null), 10000);
			}

			setProfile(profileData);
		} catch (error) {
			console.error("Failed to load profile for banner:", error);
		} finally {
			setLoading(false);
		}
	};

	// Initial profile load
	useEffect(() => {
		loadProfile();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [client, session]);

	// Periodic profile check (every 5 seconds) to detect verification status changes
	useEffect(() => {
		if (!client || !session) {
			return;
		}

		// Set up periodic check
		intervalRef.current = setInterval(() => {
			console.log("🔄 Periodic profile check...");
			loadProfile();
		}, 5000); // Check every 5 seconds

		// Cleanup on unmount
		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [client, session]);

	// Check if account is secure
	const isSecure = profile?.isSecure;
	const isVerified = profile?.isVerified;
	const accountType = profile?.accountType;

	// Handle successful verification
	const handleVerified = (newSession) => {
		if (onSessionUpdate) {
			onSessionUpdate(newSession);
		}
		// Reload profile to update banner
		loadProfile();
	};

	// Handle successful account upgrade
	const handleUpgraded = (newSession) => {
		if (onSessionUpdate) {
			onSessionUpdate(newSession);
		}
		// Reload profile to update banner
		loadProfile();
	};

	// Render notification banner if present
	const renderNotification = () => {
		if (!notification) return null;

		return (
			<div className="security-banner success">
				<div className="banner-content">
					<div className="banner-icon">✅</div>
					<div className="banner-text">
						<h3>Account Linked Successfully!</h3>
						<p>{notification}</p>
					</div>
					<div className="banner-actions">
						<button
							className="banner-btn secondary"
							onClick={() => setNotification(null)}
						>
							Dismiss
						</button>
					</div>
				</div>
			</div>
		);
	};

	// Don't show security banner if dismissed or loading
	if (dismissed || loading || !profile) {
		// Still show notification even if banner is dismissed
		return notification ? renderNotification() : null;
	}

	// Banner for unverified email users
	if (!isSecure && !isVerified && accountType === "email") {
		return (
			<>
				{renderNotification()}
				<div className="security-banner warning">
					<div className="banner-content">
						<div className="banner-icon">⚠️</div>
						<div className="banner-text">
							<h3>Verify Your Email to Secure Your Account</h3>
							<p>
								Your account is not verified. Verify your email to protect your
								progress and unlock all features.
							</p>
						</div>
						<div className="banner-actions">
							<button
								className="banner-btn primary"
								onClick={() => setShowVerificationModal(true)}
							>
								Verify Now
							</button>
							<button
								className="banner-btn secondary"
								onClick={() => setDismissed(true)}
							>
								Dismiss
							</button>
						</div>
					</div>
				</div>

				{showVerificationModal && (
					<VerificationModal
						client={client}
						email={profile.email}
						onClose={() => setShowVerificationModal(false)}
						onVerified={handleVerified}
					/>
				)}
			</>
		);
	}

	// Banner for guest users
	if (!isSecure && !isVerified && accountType === "guest") {
		return (
			<>
				{renderNotification()}
				<div className="security-banner danger">
					<div className="banner-content">
						<div className="banner-icon">🔒</div>
						<div className="banner-text">
							<h3>Register to Secure Your Account</h3>
							<p>
								You're using a guest account. Register with email or Google to
								save your progress and prevent data loss.
							</p>
						</div>
						<div className="banner-actions">
							<button
								className="banner-btn primary"
								onClick={() => setShowUpgradeModal(true)}
							>
								Register Now
							</button>
							<button
								className="banner-btn secondary"
								onClick={() => setDismissed(true)}
							>
								Dismiss
							</button>
						</div>
					</div>
				</div>

				{showUpgradeModal && (
					<AccountUpgradeModal
						client={client}
						onClose={() => setShowUpgradeModal(false)}
						onUpgraded={handleUpgraded}
					/>
				)}
			</>
		);
	}

	// No security banner needed for secure accounts, but still show notification
	return renderNotification();
}

export default AccountSecurityBanner;
