import React from "react";
import { useNavigate } from "react-router-dom";
import App from "../App";
import "./UNOGamePage.css";

/**
 * UNO Game Page Component
 * Wraps the existing UNO game (App.js) with navigation
 */
function UNOGamePage({ client, session, socket, isConnected }) {
	const navigate = useNavigate();

	return (
		<div className="uno-game-page">
			{/* Back Button */}
			<div className="game-nav">
				<button className="back-btn" onClick={() => navigate("/games")}>
					<span className="back-icon">←</span>
					<span className="back-text">Back to Games</span>
				</button>
			</div>

			{/* UNO Game - Pass authentication props from parent */}
			<div className="game-wrapper">
				<App
					externalClient={client}
					externalSession={session}
					externalSocket={socket}
					externalIsConnected={isConnected}
				/>
			</div>
		</div>
	);
}

export default UNOGamePage;
