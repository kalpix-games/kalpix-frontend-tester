import React from "react";
import { getGameModeDisplay, getPlayerCount } from "../utils/nakamaClient";

/**
 * Match Section Component
 * Handles match creation, joining, and lobby management
 */
function MatchSection({
	isConnected,
	currentMatch,
	gameState,
	matchForm,
	setMatchForm,
	manualMatchId,
	setManualMatchId,
	isMatchmaking,
	matchmakerStatus,
	onCreateMatch,
	onJoinMatch,
	onStartMatchmaking,
	onCancelMatchmaking,
	onAddBot,
	isAddingBot,
	onStartGame,
	onLeaveMatch,
	session,
}) {
	const isInMatch = !!currentMatch;
	const isHost =
		gameState.players.length > 0 &&
		gameState.players[0]?.userId === session?.user_id;
	const expectedPlayers = getPlayerCount(
		gameState.gameMode || matchForm.gameMode
	);
	const currentPlayers = gameState.players.length;
	const isLobbyFull = currentPlayers === expectedPlayers;

	// 🔍 DEBUG: Log bot button visibility conditions
	console.log("🤖 Bot Button Visibility:", {
		isInMatch,
		isGameStarted: gameState.isGameStarted,
		isHost,
		isLobbyFull,
		currentPlayers,
		expectedPlayers,
		players: gameState.players,
		sessionUserId: session?.user_id,
		firstPlayerUserId: gameState.players[0]?.userId,
		shouldShowBotButton:
			isInMatch && !gameState.isGameStarted && isHost && !isLobbyFull,
	});

	return (
		<div className="section">
			<h2>🎮 Match Management</h2>

			{/* Match Creation/Joining */}
			{!isInMatch && !isMatchmaking && (
				<div>
					{/* Game Mode Selection */}
					<div className="form-group">
						<label>Game Mode:</label>
						<select
							value={matchForm.gameMode}
							onChange={(e) =>
								setMatchForm({ ...matchForm, gameMode: e.target.value })
							}
						>
							<option value="2p">2 Players</option>
							<option value="3p">3 Players</option>
							<option value="4p">4 Players</option>
							<option value="2v2">2v2 Team</option>
						</select>
					</div>

					{/* Match Type Selection */}
					<div className="form-group">
						<label>Match Type:</label>
						<select
							value={matchForm.matchType}
							onChange={(e) =>
								setMatchForm({ ...matchForm, matchType: e.target.value })
							}
						>
							<option value="private">Private Match</option>
							<option value="random">Random Matchmaking</option>
						</select>
					</div>

					{/* Action Buttons */}
					<div className="button-group">
						{matchForm.matchType === "private" ? (
							<button
								className="btn-primary"
								onClick={onCreateMatch}
								disabled={!isConnected}
							>
								🎯 Create Private Match
							</button>
						) : (
							<button
								className="btn-success"
								onClick={onStartMatchmaking}
								disabled={!isConnected}
							>
								🔍 Find Random Match
							</button>
						)}
					</div>

					{/* Join Existing Match */}
					<div
						style={{
							marginTop: "20px",
							paddingTop: "20px",
							borderTop: "1px solid #ddd",
						}}
					>
						<h3 style={{ fontSize: "16px", marginBottom: "10px" }}>
							Join Existing Match
						</h3>
						<div className="form-group">
							<label>Match ID:</label>
							<input
								type="text"
								value={manualMatchId}
								onChange={(e) => setManualMatchId(e.target.value)}
								placeholder="Enter Match ID"
							/>
						</div>
						<button
							className="btn-secondary"
							onClick={onJoinMatch}
							disabled={!isConnected || !manualMatchId}
						>
							🚪 Join Match
						</button>
					</div>
				</div>
			)}

			{/* Matchmaking Status */}
			{isMatchmaking && (
				<div
					style={{
						padding: "20px",
						backgroundColor: "#fff3cd",
						borderRadius: "8px",
						textAlign: "center",
					}}
				>
					<div style={{ fontSize: "18px", marginBottom: "10px" }}>
						🔍 Searching for players...
					</div>
					<div
						style={{ fontSize: "14px", color: "#856404", marginBottom: "15px" }}
					>
						{matchmakerStatus || "Looking for match..."}
					</div>
					<button className="btn-danger" onClick={onCancelMatchmaking}>
						❌ Cancel Search
					</button>
				</div>
			)}

			{/* Lobby Display */}
			{isInMatch && !gameState.isGameStarted && (
				<div>
					<div
						style={{
							padding: "15px",
							backgroundColor: "#d1ecf1",
							borderRadius: "8px",
							marginBottom: "15px",
						}}
					>
						<h3 style={{ margin: "0 0 10px 0", fontSize: "16px" }}>
							🏠 Lobby ({currentPlayers}/{expectedPlayers} players)
						</h3>

						{/* Match ID Display */}
						<div
							style={{
								padding: "10px",
								backgroundColor: "#fff",
								borderRadius: "4px",
								marginBottom: "10px",
								fontFamily: "monospace",
								fontSize: "12px",
							}}
						>
							<strong>Match ID:</strong> {currentMatch.matchId}
							<button
								onClick={() =>
									navigator.clipboard.writeText(currentMatch.matchId)
								}
								style={{
									marginLeft: "10px",
									padding: "4px 8px",
									fontSize: "11px",
									cursor: "pointer",
								}}
							>
								📋 Copy
							</button>
						</div>

						{/* Player List */}
						<div style={{ marginTop: "10px" }}>
							{Array.isArray(gameState.players) &&
								gameState.players.map((player, idx) => (
									<div
										key={player.userId}
										style={{
											padding: "8px",
											backgroundColor: "#fff",
											borderRadius: "4px",
											marginBottom: "5px",
											display: "flex",
											justifyContent: "space-between",
											alignItems: "center",
										}}
									>
										<span>
											{idx === 0 && "👑 "}
											{player.username}
											{player.isBot && " 🤖"}
										</span>
										<span
											style={{
												fontSize: "12px",
												color: player.isConnected ? "#28a745" : "#dc3545",
											}}
										>
											{player.isConnected ? "🟢 Online" : "🔴 Offline"}
										</span>
									</div>
								))}
						</div>

						{/* Empty Slots */}
						{currentPlayers < expectedPlayers && (
							<div
								style={{ marginTop: "10px", fontSize: "14px", color: "#666" }}
							>
								{expectedPlayers - currentPlayers} empty slot(s)
							</div>
						)}
					</div>

					{/* Lobby Actions */}
					<div className="button-group">
						{isHost && !isLobbyFull && (
							<button
								className="btn-secondary"
								onClick={onAddBot}
								disabled={isAddingBot}
							>
								{isAddingBot ? "⏳ Adding..." : "🤖 Add Bot"}
							</button>
						)}

						{isHost && isLobbyFull && (
							<button className="btn-success" onClick={onStartGame}>
								🚀 Start Game
							</button>
						)}

						<button className="btn-danger" onClick={onLeaveMatch}>
							🚪 Leave Match
						</button>
					</div>

					{/* Waiting Message */}
					{!isLobbyFull && (
						<div
							style={{
								marginTop: "15px",
								padding: "10px",
								backgroundColor: "#fff3cd",
								borderRadius: "4px",
								fontSize: "14px",
								textAlign: "center",
							}}
						>
							⏳ Waiting for {expectedPlayers - currentPlayers} more
							player(s)...
						</div>
					)}
				</div>
			)}

			{/* In-Game Match Info */}
			{isInMatch && gameState.isGameStarted && (
				<div
					style={{
						padding: "15px",
						backgroundColor: "#d4edda",
						borderRadius: "8px",
					}}
				>
					<h3 style={{ margin: "0 0 10px 0", fontSize: "16px" }}>
						✅ Game In Progress
					</h3>
					<div style={{ fontSize: "14px" }}>
						<div>
							<strong>Mode:</strong> {getGameModeDisplay(gameState.gameMode)}
						</div>
						<div>
							<strong>Players:</strong> {gameState.players.length}
						</div>
					</div>
					<button
						className="btn-danger"
						onClick={onLeaveMatch}
						style={{ marginTop: "10px" }}
					>
						🚪 Leave Game
					</button>
				</div>
			)}
		</div>
	);
}

export default MatchSection;
