import React from "react";
import { useNavigate } from "react-router-dom";
import AccountSecurityBanner from "../components/AccountSecurityBanner";
import "./HomePage.css";

/**
 * Home Page Component
 * Displays list of available games and quick access features
 */
function HomePage({ client, session, setSession, socket, isConnected }) {
	const navigate = useNavigate();

	// Handle session update from banner
	const handleSessionUpdate = (newSession) => {
		if (setSession) {
			setSession(newSession);
			// Save to localStorage
			localStorage.setItem("nakama_session", JSON.stringify(newSession));
		}
	};

	// Available games
	const games = [
		{
			id: "uno",
			name: "UNO",
			icon: "🎴",
			description: "Classic card game with special cards and power-ups",
			status: "available",
			players: "2-4 players",
			route: "/games/uno",
		},
		{
			id: "poker",
			name: "Poker",
			icon: "♠️",
			description: "Texas Hold'em Poker - Coming Soon",
			status: "coming_soon",
			players: "2-8 players",
		},
		{
			id: "chess",
			name: "Chess",
			icon: "♟️",
			description: "Classic strategy board game - Coming Soon",
			status: "coming_soon",
			players: "2 players",
		},
		{
			id: "ludo",
			name: "Ludo",
			icon: "🎲",
			description: "Roll the dice and race to the finish - Coming Soon",
			status: "coming_soon",
			players: "2-4 players",
		},
	];

	// Quick stats (placeholder data)
	const stats = {
		gamesPlayed: 0,
		wins: 0,
		friends: 0,
		rank: "Beginner",
	};

	const handleGameClick = (game) => {
		if (game.status === "available" && game.route) {
			navigate(game.route);
		}
	};

	return (
		<div className="home-page">
			<div className="home-container">
				{/* Welcome Section */}
				<div className="welcome-section">
					<h1>Welcome back, {session?.username || "Player"}! 👋</h1>
					<p>Ready to play some games?</p>
				</div>

				{/* Account Security Banner */}
				<AccountSecurityBanner
					client={client}
					session={session}
					onSessionUpdate={handleSessionUpdate}
				/>

				{/* Connection Status */}
				<div
					className={`connection-status ${
						isConnected ? "connected" : "disconnected"
					}`}
				>
					<span className="status-dot"></span>
					<span className="status-text">
						{isConnected ? "Connected to server" : "Connecting..."}
					</span>
				</div>

				{/* Quick Stats */}
				<div className="stats-grid">
					<div className="stat-card">
						<div className="stat-icon">🎮</div>
						<div className="stat-value">{stats.gamesPlayed}</div>
						<div className="stat-label">Games Played</div>
					</div>
					<div className="stat-card">
						<div className="stat-icon">🏆</div>
						<div className="stat-value">{stats.wins}</div>
						<div className="stat-label">Wins</div>
					</div>
					<div className="stat-card">
						<div className="stat-icon">👥</div>
						<div className="stat-value">{stats.friends}</div>
						<div className="stat-label">Friends</div>
					</div>
					<div className="stat-card">
						<div className="stat-icon">⭐</div>
						<div className="stat-value">{stats.rank}</div>
						<div className="stat-label">Rank</div>
					</div>
				</div>

				{/* Featured Games */}
				<div className="section">
					<h2>🎯 Featured Games</h2>
					<div className="games-grid">
						{games.map((game) => (
							<div
								key={game.id}
								className={`game-card ${game.status}`}
								onClick={() => handleGameClick(game)}
							>
								<div className="game-icon">{game.icon}</div>
								<div className="game-info">
									<h3>{game.name}</h3>
									<p className="game-description">{game.description}</p>
									<div className="game-meta">
										<span className="game-players">{game.players}</span>
										{game.status === "available" && (
											<span className="game-status-badge available">
												Play Now
											</span>
										)}
										{game.status === "coming_soon" && (
											<span className="game-status-badge coming-soon">
												Coming Soon
											</span>
										)}
									</div>
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Quick Actions */}
				<div className="section">
					<h2>⚡ Quick Actions</h2>
					<div className="quick-actions">
						<button
							className="action-btn primary"
							onClick={() => navigate("/games")}
						>
							<span className="btn-icon">🎮</span>
							<span className="btn-text">Browse All Games</span>
						</button>
						<button
							className="action-btn secondary"
							onClick={() => navigate("/social")}
						>
							<span className="btn-icon">📱</span>
							<span className="btn-text">Social Feed</span>
						</button>
						<button
							className="action-btn secondary"
							onClick={() => navigate("/games/uno")}
							disabled={!isConnected}
						>
							<span className="btn-icon">🎴</span>
							<span className="btn-text">Quick Play UNO</span>
						</button>
					</div>
				</div>

				{/* Recent Activity (Placeholder) */}
				<div className="section">
					<h2>📊 Recent Activity</h2>
					<div className="activity-list">
						<div className="activity-item empty">
							<p>No recent activity. Start playing to see your game history!</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default HomePage;
