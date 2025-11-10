import React from "react";
import { useNavigate } from "react-router-dom";
import AuthTester from "../components/AuthTester";
import "./LoginPage.css";

/**
 * Login Page Component
 * Displays authentication UI and redirects to home after successful login
 */
function LoginPage({ client, session, setSession, onAuthSuccess }) {
	const navigate = useNavigate();

	// Handle successful authentication
	const handleAuthSuccess = (newSession) => {
		console.log("✅ Authentication successful, redirecting to home...");
		if (onAuthSuccess) {
			onAuthSuccess(newSession);
		}
		// Redirect to home page
		navigate("/home");
	};

	return (
		<div className="login-page">
			<div className="login-container">
				<div className="login-header">
					<h1>🎮 Welcome to Plazy</h1>
					<p>Login to start playing games and connect with friends</p>
				</div>

				<AuthTester
					client={client}
					session={session}
					setSession={setSession}
					onAuthSuccess={handleAuthSuccess}
				/>
			</div>
		</div>
	);
}

export default LoginPage;

