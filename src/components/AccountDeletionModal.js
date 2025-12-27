import React, { useState, useEffect } from "react";
import { requestAccountDeletion, getDeletionStatus } from "../utils/authClient";
import "./AccountDeletionModal.css";

/**
 * Account Deletion Modal Component
 * Handles account deletion with 14-day grace period
 */
function AccountDeletionModal({ client, session, onClose, onDeletionRequested }) {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [deletionStatus, setDeletionStatus] = useState(null);
	const [confirmText, setConfirmText] = useState("");

	// Load deletion status on mount
	useEffect(() => {
		loadDeletionStatus();
	}, []);

	const loadDeletionStatus = async () => {
		try {
			const status = await getDeletionStatus(client, session);
			setDeletionStatus(status);
		} catch (err) {
			console.error("Failed to load deletion status:", err);
		}
	};

	const handleRequestDeletion = async () => {
		if (confirmText !== "DELETE") {
			setError('Please type "DELETE" to confirm');
			return;
		}

		setLoading(true);
		setError("");
		setSuccess("");

		try {
			const result = await requestAccountDeletion(client, session);
			setSuccess(result.message || "Account deletion requested successfully");
			
			// Reload deletion status
			await loadDeletionStatus();

			if (onDeletionRequested) {
				onDeletionRequested();
			}

			// Close modal after 2 seconds
			setTimeout(() => {
				onClose();
			}, 2000);
		} catch (err) {
			console.error("Request deletion error:", err);
			setError(err.message || "Failed to request account deletion");
		} finally {
			setLoading(false);
		}
	};

	const formatDate = (timestamp) => {
		if (!timestamp) return "N/A";
		const date = new Date(timestamp * 1000);
		return date.toLocaleString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const getDaysRemaining = (scheduledAt) => {
		if (!scheduledAt) return 0;
		const now = Date.now() / 1000;
		const remaining = scheduledAt - now;
		return Math.ceil(remaining / (24 * 60 * 60));
	};

	// If deletion is already scheduled, show status
	if (deletionStatus?.isScheduled) {
		const daysRemaining = getDaysRemaining(deletionStatus.scheduledAt);
		return (
			<div className="modal-overlay" onClick={onClose}>
				<div
					className="modal-content deletion-modal"
					onClick={(e) => e.stopPropagation()}
				>
					<div className="modal-header">
						<h2>⚠️ Account Deletion Scheduled</h2>
						<button className="modal-close" onClick={onClose}>
							×
						</button>
					</div>

					<div className="modal-body">
						<div className="deletion-status">
							<div className="status-icon">⏰</div>
							<p className="status-message">
								Your account is scheduled for deletion.
							</p>
							<div className="status-details">
								<p>
									<strong>Scheduled Date:</strong>{" "}
									{formatDate(deletionStatus.scheduledAt)}
								</p>
								<p>
									<strong>Days Remaining:</strong>{" "}
									<span className="days-remaining">{daysRemaining} days</span>
								</p>
							</div>
							<div className="info-box">
								<p>
									💡 <strong>Good news!</strong> You can cancel this deletion
									by simply logging in before the scheduled date. Your account
									deletion will be automatically revoked when you log in.
								</p>
							</div>
						</div>

						<div className="modal-actions">
							<button onClick={onClose} className="btn-primary">
								Got it
							</button>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Show deletion request form
	return (
		<div className="modal-overlay" onClick={onClose}>
			<div
				className="modal-content deletion-modal"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="modal-header">
					<h2>🗑️ Delete Account</h2>
					<button className="modal-close" onClick={onClose}>
						×
					</button>
				</div>

				<div className="modal-body">
					{error && <div className="alert alert-error">{error}</div>}
					{success && <div className="alert alert-success">{success}</div>}

					<div className="warning-box">
						<h3>⚠️ Warning: This action cannot be undone</h3>
						<p>
							Requesting account deletion will schedule your account for
							permanent deletion after <strong>14 days</strong>.
						</p>
						<ul>
							<li>All your data will be permanently deleted</li>
							<li>You will lose access to all your progress and content</li>
							<li>This action is irreversible after the 14-day grace period</li>
						</ul>
						<p className="grace-period-info">
							💡 <strong>14-Day Grace Period:</strong> You can cancel this
							deletion by logging in before the scheduled deletion date. Your
							account deletion will be automatically revoked.
						</p>
					</div>

					<div className="form-group">
						<label>
							To confirm, please type <strong>DELETE</strong> in the box below:
						</label>
						<input
							type="text"
							value={confirmText}
							onChange={(e) => setConfirmText(e.target.value)}
							placeholder="Type DELETE to confirm"
							className="confirm-input"
							autoFocus
						/>
					</div>

					<div className="modal-actions">
						<button
							onClick={handleRequestDeletion}
							disabled={loading || confirmText !== "DELETE"}
							className="btn-danger"
						>
							{loading ? "Requesting..." : "🗑️ Request Account Deletion"}
						</button>
						<button onClick={onClose} className="btn-secondary">
							Cancel
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

export default AccountDeletionModal;

