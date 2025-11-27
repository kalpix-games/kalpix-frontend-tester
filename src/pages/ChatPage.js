import React, { useState, useCallback } from "react";
import ChatSection from "../components/ChatSection";
import EventLog from "../components/EventLog";

/**
 * Chat / DM Page
 * Router-integrated page that exposes the existing ChatSection + EventLog
 * so you can access DMs from the main navigation.
 */
function ChatPage({ client, session, socket, isConnected }) {
	const [events, setEvents] = useState([]);

	const addEvent = useCallback((event, message, type = "info", details = null) => {
		setEvents((prev) => [
			...prev,
			{
				id: `${Date.now()}-${prev.length + 1}`,
				event,
				message,
				type,
				timestamp: Date.now(),
				details,
			},
		]);
	}, []);

	const handleClearEvents = useCallback(() => {
		setEvents([]);
	}, []);

	if (!session) {
		// Should not normally happen because route is protected, but keep it safe.
		return (
			<div className="container" style={{ padding: "40px" }}>
				<h2>Chat</h2>
				<p>Please log in to access Direct Messages.</p>
			</div>
		);
	}

	return (
		<div className="container" style={{ padding: "20px" }}>
			<div style={{ marginBottom: "16px" }}>
				<h1 style={{ marginBottom: "8px" }}>💬 Direct Messages (Tester)</h1>
				<p style={{ margin: 0, color: "#555" }}>
					Use this page to test Instagram-style DMs: inbox, message requests, story
					replies, typing indicators, and read receipts.
				</p>
				{!isConnected && (
					<div className="message warning-message" style={{ marginTop: "12px" }}>
						WebSocket is not connected yet. Go to the Home page once to connect,
						then return here for real-time typing and read receipts.
					</div>
				)}
			</div>

			<div className="grid">
				<div>
					<ChatSection
						client={client}
						session={session}
						socket={socket}
						onEvent={addEvent}
					/>
				</div>
				<div>
					<EventLog events={events} onClear={handleClearEvents} />
				</div>
			</div>
		</div>
	);
}

export default ChatPage;

