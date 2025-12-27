import React, { useState, useEffect } from "react";
import { getUserProfile, updateUserProfile, getDeletionStatus } from "../utils/authClient";
import AccountChangeModal from "../components/AccountChangeModal";
import AccountDeletionModal from "../components/AccountDeletionModal";
import "./ProfilePage.css";

// Country code to flag emoji converter
const getCountryFlag = (countryCode) => {
	if (!countryCode || countryCode.length !== 2) return "🌍";
	const codePoints = countryCode
		.toUpperCase()
		.split("")
		.map((char) => 127397 + char.charCodeAt(0));
	return String.fromCodePoint(...codePoints);
};

/**
 * Profile Page Component
 * Displays and allows editing of user profile information
 */
function ProfilePage({ client, session, socket, onSessionUpdate }) {
	const [profile, setProfile] = useState(null);
	const [loading, setLoading] = useState(true);
	const [editing, setEditing] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [deletionStatus, setDeletionStatus] = useState(null);
	const [showChangeModal, setShowChangeModal] = useState(false);
	const [showDeletionModal, setShowDeletionModal] = useState(false);

	// Form state
	const [formData, setFormData] = useState({
		displayName: "",
		bio: "",
		country: "",
	});

	// Load profile and deletion status on mount
	useEffect(() => {
		loadProfile();
		loadDeletionStatus();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const loadProfile = async () => {
		setLoading(true);
		setError("");
		try {
			const result = await getUserProfile(client, session);
			setProfile(result);
			setFormData({
				displayName: result.displayName || "",
				bio: result.bio || "",
				country: result.country || "",
			});
		} catch (err) {
			setError(err.message || "Failed to load profile");
		} finally {
			setLoading(false);
		}
	};

	const loadDeletionStatus = async () => {
		try {
			const status = await getDeletionStatus(client, session);
			setDeletionStatus(status);
		} catch (err) {
			console.error("Failed to load deletion status:", err);
		}
	};

	const handleAccountChanged = async (newSession) => {
		if (onSessionUpdate) {
			onSessionUpdate(newSession);
		}
		await loadProfile();
		setSuccess("Account changed successfully!");
		setTimeout(() => setSuccess(""), 3000);
	};

	const handleDeletionRequested = async () => {
		await loadDeletionStatus();
		setSuccess("Account deletion requested. You can cancel by logging in before the scheduled date.");
		setTimeout(() => setSuccess(""), 5000);
	};

	const handleInputChange = (e) => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	const handleSave = async () => {
		setLoading(true);
		setError("");
		setSuccess("");
		try {
			await updateUserProfile(
				client,
				session,
				formData.displayName,
				formData.bio,
				formData.country
			);
			setSuccess("Profile updated successfully!");
			setEditing(false);
			await loadProfile();
		} catch (err) {
			setError(err.message || "Failed to update profile");
		} finally {
			setLoading(false);
		}
	};

	const handleCancel = () => {
		setEditing(false);
		setFormData({
			displayName: profile.displayName || "",
			bio: profile.bio || "",
			country: profile.country || "",
		});
		setError("");
		setSuccess("");
	};

	const formatDate = (timestamp) => {
		if (!timestamp) return "N/A";
		const date = new Date(timestamp * 1000);
		const day = date.getDate();
		const month = date.toLocaleString("en-US", { month: "short" });
		const year = date.getFullYear();
		return `${day} ${month} ${year}`;
	};

	if (loading && !profile) {
		return (
			<div className="profile-page">
				<div className="profile-container">
					<div className="loading">Loading profile...</div>
				</div>
			</div>
		);
	}

	return (
		<div className="profile-page">
			<div className="profile-container">
				<div className="profile-header">
					<h1>👤 My Profile</h1>
				</div>

				{error && <div className="error-message">{error}</div>}
				{success && <div className="success-message">{success}</div>}

				{profile && (
					<div className="profile-content">
						{/* Profile Avatar */}
						<div className="profile-avatar-section">
							<img
								src={profile.avatarUrl || "/default-avatar.png"}
								alt="Profile"
								className="profile-avatar"
							/>
						</div>

						{/* Profile Information */}
						<div className="profile-info-section">
							<div className="info-row">
								<label>Username:</label>
								<span className="info-value">{profile.username}</span>
							</div>

							<div className="info-row">
								<label>Display Name:</label>
								{editing ? (
									<input
										type="text"
										name="displayName"
										value={formData.displayName}
										onChange={handleInputChange}
										className="edit-input"
										placeholder="Enter display name"
									/>
								) : (
									<span className="info-value">
										{profile.displayName || "Not set"}
									</span>
								)}
							</div>
							<div className="info-row">
								<label>Bio:</label>
								{editing ? (
									<textarea
										name="bio"
										value={formData.bio}
										onChange={handleInputChange}
										className="edit-textarea"
										placeholder="Tell us about yourself"
										rows="3"
									/>
								) : (
									<span className="info-value">{profile.bio || "Not set"}</span>
								)}
							</div>

							<div className="info-row">
								<label>Country:</label>
								{editing ? (
									<input
										type="text"
										name="country"
										value={formData.country}
										onChange={handleInputChange}
										className="edit-input"
										placeholder="Country code (e.g., US)"
										maxLength="2"
									/>
								) : (
									<span className="info-value">
										{profile.country ? (
											<>
												{getCountryFlag(profile.country)} {profile.country}
											</>
										) : (
											"Not set"
										)}
									</span>
								)}
							</div>

							<div className="info-row">
								<label>Date of Joining:</label>
								<span className="info-value">
									{formatDate(profile.dateOfJoining)}
								</span>
							</div>

							<div className="info-row">
								<label>Account Type:</label>
								<span className="info-value account-type">
									{profile.accountType}
									{profile.isVerified && (
										<span className="badge verified">✓ Verified</span>
									)}
								</span>
							</div>

							<div className="info-row">
								<label>Status:</label>
								<span className="info-value">
									{profile.isOnline ? (
										<span className="status online">🟢 Online</span>
									) : (
										<span className="status offline">⚫ Offline</span>
									)}
								</span>
							</div>

							{profile.email && (
								<div className="info-row">
									<label>Email:</label>
									<span className="info-value">{profile.email}</span>
								</div>
							)}
						</div>

						{/* Account Deletion Status */}
						{deletionStatus?.isScheduled && (
							<div className="deletion-warning-banner">
								<div className="warning-icon">⏰</div>
								<div className="warning-content">
									<h4>Account Deletion Scheduled</h4>
									<p>
										Your account is scheduled for deletion. You can cancel by
										logging in before the scheduled date.
									</p>
								</div>
							</div>
						)}

						{/* Account Settings Section */}
						{profile.isVerified && (
							<div className="account-settings-section">
								<h3>Account Settings</h3>
								<div className="settings-actions">
									<button
										onClick={() => setShowChangeModal(true)}
										className="btn-secondary"
									>
										🔄 Change Account
									</button>
									<button
										onClick={() => setShowDeletionModal(true)}
										className="btn-danger-outline"
									>
										🗑️ Delete Account
									</button>
								</div>
							</div>
						)}

						{/* Action Buttons */}
						<div className="profile-actions">
							{editing ? (
								<>
									<button
										onClick={handleSave}
										disabled={loading}
										className="btn-primary"
									>
										{loading ? "Saving..." : "💾 Save Changes"}
									</button>
									<button
										onClick={handleCancel}
										disabled={loading}
										className="btn-secondary"
									>
										❌ Cancel
									</button>
								</>
							) : (
								<button
									onClick={() => setEditing(true)}
									className="btn-primary"
								>
									✏️ Edit Profile
								</button>
							)}
						</div>
					</div>
				)}

				{/* Account Change Modal */}
				{showChangeModal && (
					<AccountChangeModal
						client={client}
						session={session}
						socket={socket}
						onClose={() => setShowChangeModal(false)}
						onChanged={handleAccountChanged}
					/>
				)}

				{/* Account Deletion Modal */}
				{showDeletionModal && (
					<AccountDeletionModal
						client={client}
						session={session}
						onClose={() => setShowDeletionModal(false)}
						onDeletionRequested={handleDeletionRequested}
					/>
				)}
			</div>
		</div>
	);
}

export default ProfilePage;
