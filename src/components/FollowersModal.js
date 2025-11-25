import React from "react";
import { useNavigate } from "react-router-dom";
import "./FollowersModal.css";

/**
 * FollowersModal Component
 * Displays a modal with a list of followers or following users
 */
function FollowersModal({ isOpen, onClose, users, title, currentUserId }) {
	const navigate = useNavigate();

	if (!isOpen) return null;

	const handleUserClick = (userId) => {
		onClose();
		navigate(`/profile/${userId}`);
	};

	const handleBackdropClick = (e) => {
		if (e.target === e.currentTarget) {
			onClose();
		}
	};

	return (
		<div className="modal-backdrop" onClick={handleBackdropClick}>
			<div className="modal-content">
				<div className="modal-header">
					<h2>{title}</h2>
					<button className="modal-close" onClick={onClose}>
						×
					</button>
				</div>
				<div className="modal-body">
					{users && users.length > 0 ? (
						<div className="users-list-modal">
							{users.map((user) => (
								<div
									key={user.userId}
									className="user-item-modal"
									onClick={() => handleUserClick(user.userId)}
								>
									<img
										src={user.avatarUrl || "/default-avatar.png"}
										alt={user.username}
										className="user-avatar-modal"
									/>
									<div className="user-info-modal">
										<span className="user-username-modal">
											{user.username}
										</span>
										<span className="user-displayname-modal">
											{user.displayName}
										</span>
									</div>
									{user.isFriend && (
										<span className="badge-friend-modal">Friends</span>
									)}
									{user.userId === currentUserId && (
										<span className="badge-you-modal">You</span>
									)}
								</div>
							))}
						</div>
					) : (
						<div className="empty-state-modal">
							<p>No users to display</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

export default FollowersModal;

