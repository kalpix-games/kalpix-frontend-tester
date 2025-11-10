import React, { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../config/firebase";

/**
 * Google Login Button Component
 * Handles Google OAuth flow using Firebase Authentication
 */
function GoogleLoginButton({ onSuccess, onError }) {
	const [loading, setLoading] = useState(false);
	const [idToken, setIdToken] = useState(null);
	const [userInfo, setUserInfo] = useState(null);

	const handleGoogleSignIn = async () => {
		setLoading(true);
		try {
			// Sign in with Google using Firebase
			const result = await signInWithPopup(auth, googleProvider);

			// Get the Firebase ID token
			const token = await result.user.getIdToken();

			// Store token and user info for display
			setIdToken(token);
			setUserInfo({
				email: result.user.email,
				displayName: result.user.displayName,
				photoURL: result.user.photoURL,
			});

			// Log token to console for easy copying
			console.log("🔑 Firebase ID Token:");
			console.log(token);
			console.log("\n📋 Copy this token for Postman testing!");

			// Call the success callback with the Firebase ID token
			onSuccess(token);
		} catch (error) {
			console.error("Google sign-in error:", error);
			onError(error);
		} finally {
			setLoading(false);
		}
	};

	const copyToken = () => {
		if (idToken) {
			navigator.clipboard.writeText(idToken);
			alert("✅ ID Token copied to clipboard!");
		}
	};

	return (
		<div>
			<button
				onClick={handleGoogleSignIn}
				disabled={loading}
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					gap: "10px",
					padding: "12px 24px",
					backgroundColor: "#fff",
					border: "1px solid #dadce0",
					borderRadius: "4px",
					fontSize: "14px",
					fontWeight: "500",
					color: "#3c4043",
					cursor: loading ? "not-allowed" : "pointer",
					width: "100%",
					transition: "background-color 0.2s",
				}}
				onMouseEnter={(e) => {
					if (!loading) e.target.style.backgroundColor = "#f8f9fa";
				}}
				onMouseLeave={(e) => {
					e.target.style.backgroundColor = "#fff";
				}}
			>
				{loading ? (
					<span>Signing in...</span>
				) : (
					<>
						<svg width="18" height="18" xmlns="http://www.w3.org/2000/svg">
							<g fill="none" fillRule="evenodd">
								<path
									d="M17.6 9.2l-.1-1.8H9v3.4h4.8C13.6 12 13 13 12 13.6v2.2h3a8.8 8.8 0 0 0 2.6-6.6z"
									fill="#4285F4"
									fillRule="nonzero"
								/>
								<path
									d="M9 18c2.4 0 4.5-.8 6-2.2l-3-2.2a5.4 5.4 0 0 1-8-2.9H1V13a9 9 0 0 0 8 5z"
									fill="#34A853"
									fillRule="nonzero"
								/>
								<path
									d="M4 10.7a5.4 5.4 0 0 1 0-3.4V5H1a9 9 0 0 0 0 8l3-2.3z"
									fill="#FBBC05"
									fillRule="nonzero"
								/>
								<path
									d="M9 3.6c1.3 0 2.5.4 3.4 1.3L15 2.3A9 9 0 0 0 1 5l3 2.4a5.4 5.4 0 0 1 5-3.7z"
									fill="#EA4335"
									fillRule="nonzero"
								/>
							</g>
						</svg>
						<span>Sign in with Google</span>
					</>
				)}
			</button>
			<p
				style={{
					fontSize: "12px",
					color: "#666",
					marginTop: "10px",
					textAlign: "center",
				}}
			>
				Sign in with your Google account via Firebase
			</p>

			{/* Display ID Token for Testing */}
			{idToken && userInfo && (
				<div
					style={{
						marginTop: "20px",
						padding: "20px",
						background: "#f0f7ff",
						border: "2px solid #4285F4",
						borderRadius: "8px",
					}}
				>
					<div style={{ marginBottom: "15px" }}>
						<h4 style={{ margin: "0 0 10px 0", color: "#1a73e8" }}>
							✅ Signed in successfully!
						</h4>
						<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
							{userInfo.photoURL && (
								<img
									src={userInfo.photoURL}
									alt="Profile"
									style={{
										width: "40px",
										height: "40px",
										borderRadius: "50%",
									}}
								/>
							)}
							<div>
								<div style={{ fontWeight: "bold", fontSize: "14px" }}>
									{userInfo.displayName}
								</div>
								<div style={{ fontSize: "12px", color: "#666" }}>
									{userInfo.email}
								</div>
							</div>
						</div>
					</div>

					<div
						style={{
							background: "#1e1e1e",
							color: "#d4d4d4",
							padding: "15px",
							borderRadius: "6px",
							fontSize: "11px",
							fontFamily: "monospace",
							wordBreak: "break-all",
							maxHeight: "150px",
							overflowY: "auto",
							marginBottom: "10px",
						}}
					>
						<div style={{ color: "#4ec9b0", marginBottom: "5px" }}>
							🔑 Firebase ID Token:
						</div>
						{idToken}
					</div>

					<button
						onClick={copyToken}
						style={{
							width: "100%",
							padding: "10px",
							background: "#34A853",
							color: "white",
							border: "none",
							borderRadius: "4px",
							fontSize: "14px",
							fontWeight: "600",
							cursor: "pointer",
						}}
					>
						📋 Copy Token to Clipboard
					</button>

					<div
						style={{
							marginTop: "15px",
							padding: "12px",
							background: "#fff3cd",
							border: "1px solid #ffc107",
							borderRadius: "6px",
							fontSize: "12px",
						}}
					>
						<strong>🧪 For Postman Testing:</strong>
						<ol style={{ margin: "8px 0 0 0", paddingLeft: "20px" }}>
							<li>Click "Copy Token to Clipboard" above</li>
							<li>Open Postman</li>
							<li>
								POST to:{" "}
								<code
									style={{
										background: "#f4f4f4",
										padding: "2px 4px",
										borderRadius: "3px",
									}}
								>
									http://localhost:7350/v2/rpc/auth/firebase_login?http_key=defaulthttpkey
								</code>
							</li>
							<li>
								Body: <code>{`{"id_token": "PASTE_TOKEN_HERE"}`}</code>
							</li>
						</ol>
						<div style={{ marginTop: "8px", color: "#856404" }}>
							⚠️ Token expires in 1 hour
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

export default GoogleLoginButton;
