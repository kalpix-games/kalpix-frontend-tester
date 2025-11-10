import React, { useState, useEffect } from "react";
import {
	BrowserRouter as Router,
	Routes,
	Route,
	Navigate,
} from "react-router-dom";
import { Client } from "@heroiclabs/nakama-js";
import "./App.css";

// Pages
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import SocialPage from "./pages/SocialPage";
import GamesPage from "./pages/GamesPage";
import UNOGamePage from "./pages/UNOGamePage";

// Components
import Navigation from "./components/Navigation";

/**
 * Main Application Component
 * Handles routing, authentication state, and Nakama client
 */
function MainApp() {
	// Nakama client state
	const [client, setClient] = useState(null);
	const [session, setSession] = useState(null);
	const [socket, setSocket] = useState(null);
	const [isConnected, setIsConnected] = useState(false);

	// Initialize Nakama client
	useEffect(() => {
		// Get Nakama configuration from environment variables or use defaults
		const serverKey = process.env.REACT_APP_NAKAMA_SERVER_KEY || "defaultkey";
		const host = process.env.REACT_APP_NAKAMA_HOST || "127.0.0.1";
		const port = process.env.REACT_APP_NAKAMA_PORT || "7350";
		const useSSL = process.env.REACT_APP_NAKAMA_USE_SSL === "true";

		console.log("🔧 Nakama Configuration:", { serverKey, host, port, useSSL });

		const nakamaClient = new Client(serverKey, host, port, useSSL);
		setClient(nakamaClient);

		// Try to restore session from localStorage
		const savedSession = localStorage.getItem("nakama_session");
		if (savedSession) {
			try {
				const sessionData = JSON.parse(savedSession);
				// Check if session is still valid
				const now = Date.now();
				if (sessionData.expires_at && sessionData.expires_at > now) {
					setSession(sessionData);
				} else {
					// Session expired, clear it
					localStorage.removeItem("nakama_session");
				}
			} catch (error) {
				console.error("Failed to restore session:", error);
				localStorage.removeItem("nakama_session");
			}
		}
	}, []);

	// Save session to localStorage when it changes
	useEffect(() => {
		if (session) {
			localStorage.setItem("nakama_session", JSON.stringify(session));
		} else {
			localStorage.removeItem("nakama_session");
		}
	}, [session]);

	// Connect WebSocket when session is available
	useEffect(() => {
		const connectSocket = async () => {
			if (client && session && !socket) {
				try {
					const newSocket = client.createSocket(false, false);

					// Create a proper Nakama Session object from our session data
					// The Nakama SDK expects a Session object with specific properties
					const nakamaSession = {
						token: session.token,
						refresh_token: session.refresh_token || "",
						user_id: session.user_id,
						username: session.username,
						created_at: session.created_at,
						expires_at: session.expires_at,
						// Add required methods that Nakama SDK expects
						isexpired: (currenttime) => {
							const expireTime = session.expires_at || 0;
							return expireTime < (currenttime || Date.now());
						},
					};

					await newSocket.connect(nakamaSession, false);
					setSocket(newSocket);
					setIsConnected(true);
					console.log("✅ WebSocket connected");
				} catch (error) {
					console.error("❌ WebSocket connection failed:", error);
				}
			}
		};

		connectSocket();

		// Cleanup on unmount
		return () => {
			if (socket) {
				socket.disconnect();
			}
		};
	}, [client, session]); // Only reconnect when client or session changes

	// Handle logout
	const handleLogout = () => {
		if (socket) {
			socket.disconnect();
		}
		setSession(null);
		setSocket(null);
		setIsConnected(false);
		localStorage.removeItem("nakama_session");
	};

	// Handle successful authentication
	const handleAuthSuccess = (newSession) => {
		setSession(newSession);
	};

	// Protected Route Component
	const ProtectedRoute = ({ children }) => {
		if (!session) {
			return <Navigate to="/login" replace />;
		}
		return children;
	};

	return (
		<Router>
			<div className="app-container">
				{/* Navigation - only show when logged in */}
				{session && <Navigation session={session} onLogout={handleLogout} />}

				{/* Routes */}
				<Routes>
					{/* Login Page */}
					<Route
						path="/login"
						element={
							session ? (
								<Navigate to="/home" replace />
							) : (
								<LoginPage
									client={client}
									session={session}
									setSession={setSession}
									onAuthSuccess={handleAuthSuccess}
								/>
							)
						}
					/>

					{/* Home Page */}
					<Route
						path="/home"
						element={
							<ProtectedRoute>
								<HomePage
									client={client}
									session={session}
									setSession={setSession}
									socket={socket}
									isConnected={isConnected}
								/>
							</ProtectedRoute>
						}
					/>

					{/* Social Page */}
					<Route
						path="/social"
						element={
							<ProtectedRoute>
								<SocialPage
									client={client}
									session={session}
									socket={socket}
									isConnected={isConnected}
								/>
							</ProtectedRoute>
						}
					/>

					{/* Games Page */}
					<Route
						path="/games"
						element={
							<ProtectedRoute>
								<GamesPage
									client={client}
									session={session}
									socket={socket}
									isConnected={isConnected}
								/>
							</ProtectedRoute>
						}
					/>

					{/* UNO Game Page */}
					<Route
						path="/games/uno"
						element={
							<ProtectedRoute>
								<UNOGamePage
									client={client}
									session={session}
									socket={socket}
									isConnected={isConnected}
								/>
							</ProtectedRoute>
						}
					/>

					{/* Default redirect */}
					<Route
						path="/"
						element={
							session ? (
								<Navigate to="/home" replace />
							) : (
								<Navigate to="/login" replace />
							)
						}
					/>

					{/* 404 - Not Found */}
					<Route
						path="*"
						element={
							<div style={{ padding: "40px", textAlign: "center" }}>
								<h1>404 - Page Not Found</h1>
								<p>The page you're looking for doesn't exist.</p>
								<a href="/home">Go to Home</a>
							</div>
						}
					/>
				</Routes>
			</div>
		</Router>
	);
}

export default MainApp;
