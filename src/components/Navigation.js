import React from "react";
import { NavLink } from "react-router-dom";
import "./Navigation.css";

/**
 * Navigation Component
 * Top navigation bar for the application
 */
function Navigation({ session, onLogout }) {
	return (
		<nav className="navigation">
			<div className="nav-container">
				{/* Logo */}
				<div className="nav-logo">
					<span className="logo-icon">🎮</span>
					<span className="logo-text">Plazy</span>
				</div>

				{/* Navigation Links */}
				<div className="nav-links">
					<NavLink
						to="/home"
						className={({ isActive }) =>
							isActive ? "nav-link active" : "nav-link"
						}
					>
						<span className="nav-icon">🏠</span>
						<span className="nav-text">Home</span>
					</NavLink>

					<NavLink
						to="/games"
						className={({ isActive }) =>
							isActive ? "nav-link active" : "nav-link"
						}
					>
						<span className="nav-icon">🎯</span>
						<span className="nav-text">Games</span>
					</NavLink>

					<NavLink
						to="/social"
						className={({ isActive }) =>
							isActive ? "nav-link active" : "nav-link"
						}
					>
						<span className="nav-icon">📱</span>
						<span className="nav-text">Social</span>
					</NavLink>
				</div>

				{/* User Info */}
				<div className="nav-user">
					<div className="user-info">
						<span className="user-icon">👤</span>
						<span className="user-name">{session?.username || "User"}</span>
					</div>
					<button className="logout-btn" onClick={onLogout}>
						Logout
					</button>
				</div>
			</div>
		</nav>
	);
}

export default Navigation;

