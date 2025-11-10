import React from "react";

/**
 * Opponent List Component
 * Displays information about other players in the game
 */
function OpponentList({ gameState, session }) {
	if (!gameState.isGameStarted || !gameState.players) {
		return null;
	}

	// ✅ FIX: Ensure players is an array
	const playersArray = Array.isArray(gameState.players)
		? gameState.players
		: [];

	if (playersArray.length === 0) {
		return null;
	}

	// Filter out current user
	const opponents = playersArray.filter((p) => p.userId !== session?.user_id);

	if (opponents.length === 0) {
		return null;
	}

	return (
		<div className="section">
			<h2>👥 Opponents ({opponents.length})</h2>

			<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
				{opponents.map((player, idx) => {
					const isCurrentPlayer =
						gameState.currentPlayer ===
						playersArray.findIndex((p) => p.userId === player.userId);
					const hasUno = player.handSize === 1;

					return (
						<div
							key={player.userId}
							style={{
								padding: "12px",
								backgroundColor: isCurrentPlayer ? "#fff3cd" : "#f8f9fa",
								borderRadius: "8px",
								border: `2px solid ${isCurrentPlayer ? "#ffc107" : "#dee2e6"}`,
								position: "relative",
							}}
						>
							{/* Player Name */}
							<div
								style={{
									fontSize: "16px",
									fontWeight: "bold",
									marginBottom: "8px",
									display: "flex",
									alignItems: "center",
									gap: "8px",
								}}
							>
								{isCurrentPlayer && "▶️"}
								{player.username}
								{player.isBot && "🤖"}
								{hasUno && "🎯"}
							</div>

							{/* Player Stats */}
							<div style={{ fontSize: "14px", color: "#495057" }}>
								<div style={{ marginBottom: "4px" }}>
									<strong>Cards:</strong> {player.handSize || 0}
									{hasUno && (
										<span
											style={{
												marginLeft: "8px",
												padding: "2px 8px",
												backgroundColor: "#ffc107",
												color: "#000",
												borderRadius: "4px",
												fontSize: "12px",
												fontWeight: "bold",
											}}
										>
											UNO!
										</span>
									)}
								</div>

								<div style={{ marginBottom: "4px" }}>
									<strong>Status:</strong>{" "}
									<span
										style={{
											color: player.isConnected ? "#28a745" : "#dc3545",
											fontWeight: "bold",
										}}
									>
										{player.isConnected ? "🟢 Online" : "🔴 Offline"}
									</span>
								</div>

								{player.score !== undefined && (
									<div>
										<strong>Score:</strong> {player.score}
									</div>
								)}
							</div>

							{/* Current Turn Indicator */}
							{isCurrentPlayer && (
								<div
									style={{
										marginTop: "8px",
										padding: "6px",
										backgroundColor: "#ffc107",
										borderRadius: "4px",
										textAlign: "center",
										fontSize: "12px",
										fontWeight: "bold",
										color: "#000",
									}}
								>
									⏰ THEIR TURN
								</div>
							)}

							{/* Last Action (if available) */}
							{player.lastAction && (
								<div
									style={{
										marginTop: "8px",
										padding: "6px",
										backgroundColor: "#e9ecef",
										borderRadius: "4px",
										fontSize: "12px",
										fontStyle: "italic",
										color: "#6c757d",
									}}
								>
									Last: {player.lastAction}
								</div>
							)}
						</div>
					);
				})}
			</div>

			{/* Team Info (for 2v2 mode) */}
			{gameState.gameMode === "2v2" && (
				<div
					style={{
						marginTop: "15px",
						padding: "10px",
						backgroundColor: "#d1ecf1",
						borderRadius: "6px",
						fontSize: "14px",
					}}
				>
					<strong>Team Mode:</strong> Players alternate between teams
				</div>
			)}
		</div>
	);
}

export default OpponentList;
