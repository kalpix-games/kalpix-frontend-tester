import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./GamesPage.css";

/**
 * Games Page Component
 * Displays all available games with filtering and search
 */
function GamesPage({ client, session, socket, isConnected }) {
	const navigate = useNavigate();
	const [searchQuery, setSearchQuery] = useState("");
	const [filterCategory, setFilterCategory] = useState("all");

	// All games
	const allGames = [
		{
			id: "uno",
			name: "UNO",
			icon: "🎴",
			description: "Classic card game with special cards, power-ups, and exciting gameplay",
			category: "card",
			status: "available",
			players: "2-4 players",
			difficulty: "Easy",
			duration: "10-15 min",
			route: "/games/uno",
		},
		{
			id: "poker",
			name: "Poker",
			icon: "♠️",
			description: "Texas Hold'em Poker - Test your skills and bluff your way to victory",
			category: "card",
			status: "coming_soon",
			players: "2-8 players",
			difficulty: "Medium",
			duration: "20-30 min",
		},
		{
			id: "chess",
			name: "Chess",
			icon: "♟️",
			description: "Classic strategy board game - Outsmart your opponent",
			category: "board",
			status: "coming_soon",
			players: "2 players",
			difficulty: "Hard",
			duration: "15-60 min",
		},
		{
			id: "ludo",
			name: "Ludo",
			icon: "🎲",
			description: "Roll the dice and race to the finish line with your tokens",
			category: "board",
			status: "coming_soon",
			players: "2-4 players",
			difficulty: "Easy",
			duration: "15-20 min",
		},
		{
			id: "rummy",
			name: "Rummy",
			icon: "🃏",
			description: "Form sets and sequences to win this classic card game",
			category: "card",
			status: "coming_soon",
			players: "2-6 players",
			difficulty: "Medium",
			duration: "15-25 min",
		},
		{
			id: "8ball",
			name: "8 Ball Pool",
			icon: "🎱",
			description: "Pot all your balls and sink the 8-ball to win",
			category: "sports",
			status: "coming_soon",
			players: "2 players",
			difficulty: "Medium",
			duration: "5-10 min",
		},
	];

	// Filter games
	const filteredGames = allGames.filter((game) => {
		const matchesSearch = game.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			game.description.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesCategory = filterCategory === "all" || game.category === filterCategory;
		return matchesSearch && matchesCategory;
	});

	const handleGameClick = (game) => {
		if (game.status === "available" && game.route) {
			navigate(game.route);
		}
	};

	return (
		<div className="games-page">
			<div className="games-container">
				{/* Header */}
				<div className="games-header">
					<h1>🎯 All Games</h1>
					<p>Choose your favorite game and start playing!</p>
				</div>

				{/* Search and Filter */}
				<div className="games-controls">
					<div className="search-box">
						<span className="search-icon">🔍</span>
						<input
							type="text"
							placeholder="Search games..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="search-input"
						/>
					</div>

					<div className="filter-buttons">
						<button
							className={`filter-btn ${filterCategory === "all" ? "active" : ""}`}
							onClick={() => setFilterCategory("all")}
						>
							All Games
						</button>
						<button
							className={`filter-btn ${filterCategory === "card" ? "active" : ""}`}
							onClick={() => setFilterCategory("card")}
						>
							🎴 Card Games
						</button>
						<button
							className={`filter-btn ${filterCategory === "board" ? "active" : ""}`}
							onClick={() => setFilterCategory("board")}
						>
							🎲 Board Games
						</button>
						<button
							className={`filter-btn ${filterCategory === "sports" ? "active" : ""}`}
							onClick={() => setFilterCategory("sports")}
						>
							🎱 Sports
						</button>
					</div>
				</div>

				{/* Games Grid */}
				<div className="games-list">
					{filteredGames.length === 0 ? (
						<div className="no-games">
							<p>No games found matching your search.</p>
						</div>
					) : (
						<div className="games-grid-page">
							{filteredGames.map((game) => (
								<div
									key={game.id}
									className={`game-card-page ${game.status}`}
									onClick={() => handleGameClick(game)}
								>
									<div className="game-card-header">
										<div className="game-icon-large">{game.icon}</div>
										{game.status === "available" && (
											<span className="status-badge available">Available</span>
										)}
										{game.status === "coming_soon" && (
											<span className="status-badge coming-soon">Coming Soon</span>
										)}
									</div>

									<div className="game-card-body">
										<h3>{game.name}</h3>
										<p className="game-desc">{game.description}</p>

										<div className="game-details">
											<div className="detail-item">
												<span className="detail-icon">👥</span>
												<span className="detail-text">{game.players}</span>
											</div>
											<div className="detail-item">
												<span className="detail-icon">⏱️</span>
												<span className="detail-text">{game.duration}</span>
											</div>
											<div className="detail-item">
												<span className="detail-icon">📊</span>
												<span className="detail-text">{game.difficulty}</span>
											</div>
										</div>
									</div>

									<div className="game-card-footer">
										{game.status === "available" ? (
											<button className="play-btn">
												Play Now
											</button>
										) : (
											<button className="play-btn disabled" disabled>
												Coming Soon
											</button>
										)}
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

export default GamesPage;

