import React from "react";
import { getCardName, getColorName, getColorHex } from "../utils/cardDatabase";
import { getTimeDisplay } from "../utils/cardDecoder";

/**
 * Game Board Component
 * Displays the main game state (top card, timer, current player, special effects)
 */
function GameBoard({ gameState, timerDisplay, session, myUserId }) {
	if (!gameState.isGameStarted) {
		return null;
	}

	// ✅ FIX: Add defensive checks and use currentPlayerName from state
	const currentPlayer =
		Array.isArray(gameState.players) && gameState.currentPlayer !== undefined
			? gameState.players[gameState.currentPlayer]
			: null;

	// Use currentPlayerName from state (set by backend) or fall back to player object
	const currentPlayerName =
		gameState.currentPlayerName || currentPlayer?.username || "Player";
	const isMyTurn = currentPlayer?.userId === (myUserId || session?.user_id);

	console.log("🎮 GameBoard - Current player:", {
		currentPlayerIndex: gameState.currentPlayer,
		currentPlayerName,
		currentPlayerUserId: currentPlayer?.userId,
		myUserId: myUserId,
		sessionUserId: session?.user_id,
		isMyTurn,
	});

	const timeInfo = getTimeDisplay(gameState.timeLeft);

	return (
		<div
			className="section"
			style={{
				backgroundColor: "#f0f8ff",
				border: "2px solid #007bff",
				padding: "15px",
				marginBottom: "10px",
			}}
		>
			<h2
				style={{
					color: "#0056b3",
					marginBottom: "10px",
					fontSize: "1.2rem",
				}}
			>
				🎮 Game Board
			</h2>

			{/* Top Discard Card */}
			{gameState.topDiscardCard !== null &&
				gameState.topDiscardCard !== undefined && (
					<div style={{ marginBottom: "10px" }}>
						<div
							style={{
								fontSize: "11px",
								fontWeight: "bold",
								marginBottom: "3px",
							}}
						>
							Top Card:
						</div>
						<div
							style={{
								padding: "10px",
								backgroundColor: "#fff",
								borderRadius: "6px",
								border: "2px solid #007bff",
								textAlign: "center",
								fontSize: "18px",
								fontWeight: "bold",
								textTransform: "uppercase",
							}}
						>
							{/* ✅ FIX: Use correct card database for display */}
							{getCardName(gameState.topDiscardCard)}
						</div>
					</div>
				)}

			{/* Current Color */}
			{gameState.currentColor !== null &&
				gameState.currentColor !== undefined && (
					<div style={{ marginBottom: "10px" }}>
						<div
							style={{
								fontSize: "11px",
								fontWeight: "bold",
								marginBottom: "3px",
							}}
						>
							Current Color:
						</div>
						<div
							style={{
								padding: "8px",
								backgroundColor: getColorHex(gameState.currentColor),
								color: "white",
								borderRadius: "5px",
								textAlign: "center",
								fontSize: "14px",
								fontWeight: "bold",
							}}
						>
							{getColorName(gameState.currentColor)}
						</div>
					</div>
				)}

			{/* Current Player & Timer */}
			<div style={{ marginBottom: "10px" }}>
				<div
					style={{ fontSize: "11px", fontWeight: "bold", marginBottom: "3px" }}
				>
					Current Turn:
				</div>
				<div
					style={{
						padding: "8px",
						backgroundColor: isMyTurn ? "#d4edda" : "#fff3cd",
						borderRadius: "5px",
						border: "2px solid " + (isMyTurn ? "#28a745" : "#ffc107"),
					}}
				>
					<div
						style={{
							fontSize: "13px",
							fontWeight: "bold",
							marginBottom: "3px",
						}}
					>
						{isMyTurn ? "👉 YOUR TURN" : `${currentPlayerName}'s turn`}
					</div>
					<div
						style={{
							fontSize: "16px",
							fontFamily: "monospace",
							color: timeInfo.isWarning
								? "#dc3545"
								: timeInfo.isExpired
								? "#6c757d"
								: "#28a745",
						}}
					>
						⏱️ {timerDisplay}
						{timeInfo.isWarning && " ⚠️"}
						{timeInfo.isExpired && " ⏰"}
					</div>
				</div>
			</div>

			{/* Draw Stack */}
			{gameState.drawStack > 0 && (
				<div
					style={{
						padding: "8px",
						backgroundColor: "#f8d7da",
						borderRadius: "5px",
						border: "2px solid #dc3545",
						marginBottom: "10px",
						textAlign: "center",
					}}
				>
					<div
						style={{ fontSize: "14px", fontWeight: "bold", color: "#721c24" }}
					>
						⚠️ Draw Stack: +{gameState.drawStack}
					</div>
				</div>
			)}

			{/* Special Effects */}
			<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
				{gameState.redFuryActive && (
					<div
						style={{
							flex: "1",
							padding: "6px",
							backgroundColor: "#ff6b6b",
							color: "white",
							borderRadius: "5px",
							textAlign: "center",
							fontSize: "11px",
							fontWeight: "bold",
						}}
					>
						🔥 Red Fury Active
					</div>
				)}

				{gameState.shieldWindowActive && (
					<div
						style={{
							flex: "1",
							padding: "6px",
							backgroundColor: "#4facfe",
							color: "white",
							borderRadius: "5px",
							textAlign: "center",
							fontSize: "11px",
							fontWeight: "bold",
						}}
					>
						🛡️ Shield Window
					</div>
				)}

				{gameState.swapRequestActive && (
					<div
						style={{
							flex: "1",
							padding: "6px",
							backgroundColor: "#f39c12",
							color: "white",
							borderRadius: "5px",
							textAlign: "center",
							fontSize: "11px",
							fontWeight: "bold",
						}}
					>
						🔄 Choose Swap Target
					</div>
				)}
			</div>

			{/* Game End */}
			{gameState.gameEnded && (
				<div
					style={{
						marginTop: "10px",
						padding: "10px",
						backgroundColor: "#d4edda",
						borderRadius: "6px",
						border: "2px solid #28a745",
						textAlign: "center",
					}}
				>
					<div
						style={{
							fontSize: "18px",
							fontWeight: "bold",
							marginBottom: "6px",
						}}
					>
						🏆 Game Over!
					</div>
					<div style={{ fontSize: "14px" }}>
						Winner: {gameState.winner || "Unknown"}
					</div>
					{gameState.scores && Object.keys(gameState.scores).length > 0 && (
						<div style={{ marginTop: "6px", fontSize: "12px" }}>
							<strong>Scores:</strong>
							{Object.entries(gameState.scores).map(([userId, scoreData]) => {
								const player = Array.isArray(gameState.players)
									? gameState.players.find((p) => p.userId === userId)
									: null;

								// ✅ FIX: Handle both score as number and score as object
								const score =
									typeof scoreData === "object" && scoreData !== null
										? scoreData.score
										: scoreData;

								const username =
									typeof scoreData === "object" &&
									scoreData !== null &&
									scoreData.username
										? scoreData.username
										: player?.username || userId;

								return (
									<div key={userId}>
										{username}: {score}
									</div>
								);
							})}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

export default GameBoard;
