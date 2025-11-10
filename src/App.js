import React, { useState, useEffect, useCallback, useRef } from "react";
import { Client } from "@heroiclabs/nakama-js";
import "./App.css";

// Components
import AuthSection from "./components/AuthSection";
import MatchSection from "./components/MatchSection";
import GameBoard from "./components/GameBoard";
import PlayerHand from "./components/PlayerHand";
import OpponentList from "./components/OpponentList";
import ActionPanel from "./components/ActionPanel";
import EventLog from "./components/EventLog";
import SocialSection from "./components/SocialSection";
import ChatSection from "./components/ChatSection";

// Utilities
import { formatTime } from "./utils/cardDecoder";
import {
	sendGameAction,
	createOrJoinMatch,
	addBot as addBotToMatch,
	startMatchmaking,
	cancelMatchmaking,
	leaveMatch,
	parseMatchData,
} from "./utils/nakamaClient";

function App({
	externalClient = null,
	externalSession = null,
	externalSocket = null,
	externalIsConnected = false,
}) {
	// Nakama client state
	// Use external props if provided, otherwise use internal state
	const [client, setClient] = useState(externalClient);
	const [session, setSession] = useState(externalSession);
	const [socket, setSocket] = useState(externalSocket);
	const [isConnected, setIsConnected] = useState(externalIsConnected);
	const [currentMatch, setCurrentMatch] = useState(null);
	const myUserIdRef = useRef(null); // ✅ Use ref to avoid closure issues

	// Track if we're using external authentication
	const usingExternalAuth = externalClient !== null && externalSession !== null;

	// Game state
	const [gameState, setGameState] = useState({
		// Match info
		matchId: null,
		gameMode: null,
		matchType: null,

		// Players
		players: [],
		currentPlayer: 0,
		currentPlayerName: null,
		myUserId: null,

		// Game status
		isGameStarted: false,
		gameEnded: false,
		winner: null,

		// Cards
		myHand: [],
		topDiscardCard: null,
		currentColor: null,
		playableCards: [],

		// Timer
		turnEndTime: null,
		timeLeft: 0,

		// Special effects
		drawStack: 0,
		redFuryActive: false,
		shieldWindowActive: false,
		swapRequestActive: false,
		availableSwapTargets: [], // 🔄 7-0 Rule: Available targets for hand swap

		// Scores
		scores: {},
	});

	// UI state
	const [authForm, setAuthForm] = useState({
		deviceId: `device_${Date.now()}`,
		username: "TestPlayer1",
	});

	const [matchForm, setMatchForm] = useState({
		gameMode: "2p",
		matchType: "private",
	});

	const [manualMatchId, setManualMatchId] = useState("");
	const [isMatchmaking, setIsMatchmaking] = useState(false);
	const [matchmakerTicket, setMatchmakerTicket] = useState(null);
	const [matchmakerStatus, setMatchmakerStatus] = useState("");
	const [isAddingBot, setIsAddingBot] = useState(false); // 🔧 FIX: Prevent multiple bot additions

	const [selectedCard, setSelectedCard] = useState(null);
	const [timerDisplay, setTimerDisplay] = useState("--:--");
	const [events, setEvents] = useState([]);
	const [notifications, setNotifications] = useState([]);

	// Main tab state
	const [mainTab, setMainTab] = useState("game"); // game, social, chat

	// Refs
	const timerRef = useRef(null);
	const socketRef = useRef(null);
	const matchIdRef = useRef(null); // ✅ Store match ID in ref for reliable access
	const hasShownJoinedNotification = useRef(false); // ✅ Track if we've shown "Joined match" notification
	const handleMatchDataRef = useRef(null); // ✅ Store handleMatchData in ref to avoid initialization order issues

	// Initialize Nakama client (only if not using external client)
	useEffect(() => {
		if (!externalClient) {
			const nakamaClient = new Client("defaultkey", "127.0.0.1", "7350", false);
			setClient(nakamaClient);
		}

		return () => {
			if (timerRef.current) {
				clearTimeout(timerRef.current);
			}
		};
	}, [externalClient]);

	// Update state when external props change
	useEffect(() => {
		if (externalClient) setClient(externalClient);
		if (externalSession) {
			setSession(externalSession);
			myUserIdRef.current = externalSession.user_id;
			// ✅ FIX: Also update gameState.myUserId
			setGameState((prev) => ({ ...prev, myUserId: externalSession.user_id }));
		}
		if (externalSocket) {
			setSocket(externalSocket);
			socketRef.current = externalSocket;
		}
		setIsConnected(externalIsConnected);
	}, [externalClient, externalSession, externalSocket, externalIsConnected]);

	// Add event to log
	const addEvent = useCallback(
		(event, message, type = "info", details = null) => {
			setEvents((prev) => [
				...prev,
				{
					id: `${Date.now()}-${Math.random()}`, // Unique ID
					timestamp: Date.now(),
					event,
					message,
					type,
					details,
				},
			]);
		},
		[]
	);

	// Show notification
	const showNotification = useCallback((message) => {
		const id = Date.now();
		setNotifications((prev) => [...prev, { id, message }]);
		setTimeout(() => {
			setNotifications((prev) => prev.filter((n) => n.id !== id));
		}, 3000);
	}, []);

	// Timer countdown
	const startTimerCountdown = useCallback((turnEndTime) => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
		}

		const updateTimer = () => {
			const now = Date.now();
			const timeLeft = Math.max(0, turnEndTime - now);
			const seconds = Math.floor(timeLeft / 1000);

			setTimerDisplay(formatTime(seconds));
			setGameState((prev) => ({ ...prev, timeLeft: seconds }));

			if (timeLeft > 0) {
				timerRef.current = setTimeout(updateTimer, 1000);
			}
		};

		updateTimer();
	}, []);

	// Authentication
	const handleAuthenticate = useCallback(async () => {
		try {
			const newSession = await client.authenticateDevice(
				authForm.deviceId,
				true,
				authForm.username
			);
			setSession(newSession);
			myUserIdRef.current = newSession.user_id; // ✅ Store user ID in ref
			console.log(
				"✅ Authentication successful - User ID:",
				newSession.user_id
			);
			addEvent(
				"auth_success",
				`Authenticated as ${authForm.username}`,
				"success"
			);
			showNotification(`✅ Logged in as ${authForm.username}`);
		} catch (error) {
			addEvent(
				"auth_error",
				`Authentication failed: ${error.message}`,
				"error"
			);
			showNotification(`❌ Authentication failed`);
		}
	}, [client, authForm, addEvent, showNotification]);

	// Connect WebSocket
	const handleConnect = useCallback(async () => {
		try {
			const newSocket = client.createSocket(false, false);
			socketRef.current = newSocket;

			await newSocket.connect(session, false);
			setSocket(newSocket);
			setIsConnected(true);

			setGameState((prev) => ({ ...prev, myUserId: session.user_id }));

			addEvent("ws_connected", "WebSocket connected", "success");
			showNotification("✅ Connected to server");

			// Set up event handlers
			setupSocketHandlers(newSocket);
		} catch (error) {
			addEvent("ws_error", `Connection failed: ${error.message}`, "error");
			showNotification("❌ Connection failed");
		}
	}, [client, session, addEvent, showNotification]);

	// Disconnect WebSocket
	const handleDisconnect = useCallback(() => {
		if (socket) {
			socket.disconnect();
			setSocket(null);
			setIsConnected(false);
			addEvent("ws_disconnected", "WebSocket disconnected", "warning");
		}
	}, [socket, addEvent]);

	// Setup socket event handlers (for standalone mode only)
	const setupSocketHandlers = useCallback(
		(sock) => {
			console.log("🔧 Setting up socket event handlers (standalone mode)...");

			// Match data handler
			sock.onmatchdata = (matchData) => {
				const parsed = parseMatchData(matchData);
				if (!parsed) return;

				// Note: handleMatchData is defined later, but this is only used in standalone mode
				// For external socket mode, we use the inline handler below
				const { event, data: eventData } = parsed;
				console.log("📨 Received event (standalone):", event, eventData);
			};

			// Matchmaker matched
			sock.onmatchmakermatched = async (matched) => {
				try {
					const match = await sock.joinMatch(matched.match_id);
					setCurrentMatch({ matchId: match.match_id, match });
					matchIdRef.current = match.match_id; // ✅ Store in ref for reliable access
					setIsMatchmaking(false);
					setMatchmakerTicket(null);
				} catch (error) {
					console.error("Failed to join match:", error);
				}
			};

			console.log("✅ Socket event handlers configured (standalone mode)");
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[]
	);

	// Handle match data events
	const handleMatchData = useCallback(
		(data) => {
			const { event, data: eventData } = data;

			addEvent(event, `Event: ${event}`, "info", eventData);

			switch (event) {
				case "player_joined":
					// ✅ FIX: Add match_joined event immediately when player_joined is received
					// Check if this is MY join (not someone else joining)
					if (eventData.playerId === myUserIdRef.current) {
						addEvent(
							"match_joined",
							`Joined match: ${currentMatch?.matchId || "unknown"}`,
							"success"
						);
					}
					break;
				case "lobby_state":
					handleLobbyState(eventData);
					break;
				case "match_ready":
					showNotification("✅ Match is ready! All players joined.");
					break;
				case "cards_distributed":
					handleCardsDistributed(eventData);
					break;
				case "game_started":
					handleGameStarted(eventData);
					break;
				case "private_hand":
					handlePrivateHand(eventData);
					break;
				case "playable_cards":
					console.log("🎯 Received playable_cards event:", eventData);
					handlePlayableCards(eventData);
					break;
				case "card_played":
					handleCardPlayed(eventData);
					break;
				case "card_drawn":
					handleCardDrawn(eventData);
					break;
				case "state_delta":
					handleStateDelta(eventData);
					break;
				case "timer_sync":
					// ⚠️ DEPRECATED: timer_sync is now consolidated into state_delta with eventType="timer_sync"
					// Keeping this for backward compatibility during transition
					handleTimerSync(eventData);
					break;
				case "swap_request":
					handleSwapRequest(eventData);
					break;
				case "swap_selection_pending":
					handleSwapSelectionPending(eventData);
					break;
				case "swap_complete":
					handleSwapComplete(eventData);
					break;
				case "swap_timeout":
					handleSwapTimeout(eventData);
					break;
				case "game_ended":
					handleGameEnd(eventData);
					break;
				case "player_left":
					handlePlayerLeft(eventData);
					break;
				default:
					// Handle other events
					break;
			}
		},
		// ✅ FIX: Don't include handler functions in dependencies
		// They're already wrapped in useCallback and would cause circular dependency
		[addEvent, showNotification]
	);

	// ✅ Update ref whenever handleMatchData changes
	useEffect(() => {
		handleMatchDataRef.current = handleMatchData;
	}, [handleMatchData]);

	// Event Handlers
	const handleLobbyState = useCallback((data) => {
		if (data.players) {
			setGameState((prev) => ({
				...prev,
				players: data.players,
				gameMode: data.gameMode || prev.gameMode,
				matchType: data.matchType || prev.matchType,
			}));
		}
	}, []);

	const handleCardsDistributed = useCallback(
		async (data) => {
			console.log("🎴 handleCardsDistributed called", data);
			addEvent("animation", "Card distribution animation started", "info");
			showNotification("🎴 Dealing cards...");

			const ANIMATION_DURATION = 2000; // 2 seconds

			// ✅ STEP 1: Send animation_started with duration
			if (socketRef.current && matchIdRef.current && data.eventId) {
				try {
					await sendGameAction(socketRef.current, matchIdRef.current, {
						action: "animation_started",
						eventId: data.eventId,
						animationType: "card_distribution",
						estimatedDuration: ANIMATION_DURATION,
					});
					console.log("📤 Sent animation_started to backend");
				} catch (error) {
					console.error("❌ Failed to send animation_started:", error);
				}
			}

			// ✅ STEP 2: Play the actual animation
			console.log(`⏳ Starting ${ANIMATION_DURATION}ms animation...`);
			await new Promise((resolve) => setTimeout(resolve, ANIMATION_DURATION));
			console.log("✅ Animation complete, sending to backend...");

			// ✅ STEP 3: Send animation_complete
			if (socketRef.current && matchIdRef.current && data.eventId) {
				try {
					await sendGameAction(socketRef.current, matchIdRef.current, {
						action: "animation_complete",
						eventId: data.eventId,
					});
					addEvent(
						"animation_complete",
						"Animation complete sent to backend",
						"success"
					);
					console.log("✅ animation_complete sent successfully");
				} catch (error) {
					console.error("❌ Failed to send animation_complete:", error);
				}
			}
		},
		[addEvent, showNotification]
	);

	const handleGameStarted = useCallback(
		(data) => {
			console.log("🎮 handleGameStarted called", data);

			// ✅ FIX: Extract gameState from backend event
			const backendGameState = data.gameState || {};

			setGameState((prev) => ({
				...prev,
				isGameStarted: true,
				currentPlayer: data.currentPlayer,
				currentPlayerName: data.username,
				turnEndTime: data.turnEndTime,
				timeLeft: data.timeLeft || 60,
				// ✅ Apply backend game state
				topDiscardCard: backendGameState.topDiscardCard ?? prev.topDiscardCard,
				currentColor: backendGameState.currentColor ?? prev.currentColor,
				players: Array.isArray(backendGameState.players)
					? backendGameState.players
					: prev.players,
			}));

			if (data.turnEndTime) {
				startTimerCountdown(data.turnEndTime);
			}

			showNotification("🎮 Game started!");
		},
		[startTimerCountdown, showNotification]
	);

	const handlePrivateHand = useCallback((data) => {
		if (data.hand && Array.isArray(data.hand)) {
			setGameState((prev) => ({ ...prev, myHand: data.hand }));
		}
	}, []);

	const handlePlayableCards = useCallback((data) => {
		console.log("🃏 handlePlayableCards called", data);
		console.log("🔍 DEBUG - myUserId from ref:", myUserIdRef.current);

		if (data.playableCards && Array.isArray(data.playableCards)) {
			setGameState((prev) => {
				const myUserId = myUserIdRef.current;
				console.log("🃏 Updating playableCards:", {
					playerId: data.playerId,
					myUserId: myUserId,
					isForMe: data.playerId === myUserId,
					playableCount: data.playableCards.length,
					playableCards: data.playableCards,
					myHand: prev.myHand,
					myHandTypes: prev.myHand?.map((card) => typeof card),
					playableCardsTypes: data.playableCards.map((card) => typeof card),
					gameStarted: prev.isGameStarted,
					currentPlayer: prev.currentPlayer,
					players: prev.players,
					currentPlayerUserId: prev.players?.[prev.currentPlayer]?.userId,
				});

				// ✅ CRITICAL FIX: Remove the game started check - playable cards should be set regardless
				// The backend only sends playable_cards to the current player, so we can trust it
				if (data.playerId === myUserId) {
					console.log(
						"🃏 ✅ Setting playableCards for current user:",
						data.playableCards
					);
					return { ...prev, playableCards: data.playableCards };
				} else {
					console.log("🃏 ❌ Not updating playableCards - playerId mismatch:", {
						dataPlayerId: data.playerId,
						myUserId: myUserId,
					});
				}
				return prev;
			});
		} else {
			console.log("🃏 Invalid playableCards data:", data);
		}
	}, []); // ✅ Empty dependency array - we use ref instead

	const handleCardPlayed = useCallback(
		(data) => {
			console.log("🃏 handleCardPlayed called", data);
			setGameState((prev) => ({
				...prev,
				// 🔧 FIX: Use topDiscardCard from event if available, fallback to cardId
				topDiscardCard:
					data.topDiscardCard !== undefined ? data.topDiscardCard : data.cardId,
				currentColor:
					data.currentColor !== undefined
						? data.currentColor
						: prev.currentColor,
				drawStack: data.drawStack || 0,
				players: Array.isArray(prev.players)
					? prev.players.map((p) =>
							p.userId === data.playerId
								? { ...p, handSize: data.newHandSize }
								: p
					  )
					: prev.players,
			}));

			if (data.playerName) {
				showNotification(`${data.playerName} played a card`);
			}
		},
		[showNotification]
	);

	const handleCardDrawn = useCallback(
		(data) => {
			setGameState((prev) => ({
				...prev,
				players: Array.isArray(prev.players)
					? prev.players.map((p) =>
							p.userId === data.playerId
								? { ...p, handSize: data.newHandSize }
								: p
					  )
					: prev.players,
			}));

			if (data.newHand && data.playerId === session?.user_id) {
				setGameState((prev) => ({ ...prev, myHand: data.newHand }));
			}

			if (data.playerName) {
				showNotification(`${data.playerName} drew ${data.cardsDrawn} card(s)`);
			}
		},
		[session, showNotification]
	);

	const handleStateDelta = useCallback(
		(data) => {
			if (data.changes) {
				console.log(
					"🔄 handleStateDelta - Received changes:",
					data.changes,
					"eventType:",
					data.eventType,
					"version:",
					data.version
				);

				setGameState((prev) => {
					const newState = { ...prev };

					// ✅ CRITICAL FIX: Preserve playableCards when applying delta changes
					// playableCards is sent separately via playable_cards event, not in state_delta
					const preservedPlayableCards = prev.playableCards;

					// Apply all changes from the delta
					Object.keys(data.changes).forEach((key) => {
						// Don't overwrite playableCards from state_delta
						if (key === "playableCards") {
							return;
						}

						// ✅ CRITICAL FIX: Handle players as a map (delta changes) instead of array replacement
						if (key === "players" && typeof data.changes[key] === "object") {
							const playerChanges = data.changes[key];

							// If prev.players is an array, merge the changes
							if (Array.isArray(newState.players)) {
								newState.players = newState.players.map((player) => {
									const userId = player.userId;
									if (playerChanges[userId]) {
										// Merge changes for this player
										return { ...player, ...playerChanges[userId] };
									}
									return player;
								});

								// Check for new players not in the array
								Object.keys(playerChanges).forEach((userId) => {
									const existingPlayer = newState.players.find(
										(p) => p.userId === userId
									);
									if (!existingPlayer) {
										// New player - add to array
										newState.players.push(playerChanges[userId]);
									}
								});
							} else {
								// If players is not an array yet, just set it
								// This shouldn't happen, but handle it gracefully
								newState[key] = data.changes[key];
							}
						} else {
							// For all other fields, just apply the change
							newState[key] = data.changes[key];
						}
					});

					// Restore playableCards
					newState.playableCards = preservedPlayableCards;

					// ✅ Handle game_started event type (version 1 state_delta)
					if (data.eventType === "game_started") {
						console.log("🎮 GAME STARTED - Setting isGameStarted = true");
						newState.isGameStarted = true;
						// Derive current player's username
						if (
							Array.isArray(newState.players) &&
							newState.currentPlayer !== undefined &&
							newState.players[newState.currentPlayer]
						) {
							newState.currentPlayerName =
								newState.players[newState.currentPlayer].username;
						}
					}

					// ✅ OPTIMIZATION: Handle turn_change via state_delta
					// If this is a turn change event, derive the current player's username
					if (
						data.eventType === "turn_change" &&
						newState.currentPlayer !== undefined
					) {
						if (
							Array.isArray(newState.players) &&
							newState.players[newState.currentPlayer]
						) {
							newState.currentPlayerName =
								newState.players[newState.currentPlayer].username;
						}
						// ❌ DON'T clear playable cards here - backend sends fresh playable_cards event
						// Clearing here causes race condition where playableCards might be empty
						// newState.playableCards = [];
					}

					console.log("🔄 handleStateDelta - Updated state:", {
						topDiscardCard: newState.topDiscardCard,
						currentColor: newState.currentColor,
						currentPlayer: newState.currentPlayer,
						currentPlayerName: newState.currentPlayerName,
						players: newState.players,
						playableCards: newState.playableCards,
						isGameStarted: newState.isGameStarted,
						eventType: data.eventType,
						version: data.version,
					});

					return newState;
				});

				// ✅ Handle game_started specific actions
				if (data.eventType === "game_started") {
					// Start timer countdown if turnEndTime is provided
					if (data.changes.turnEndTime) {
						startTimerCountdown(data.changes.turnEndTime);
					}
					showNotification("🎮 Game started!");
				}

				// ✅ OPTIMIZATION: Handle turn_change specific actions
				if (data.eventType === "turn_change") {
					// Start timer countdown if turnEndTime is provided
					if (data.changes.turnEndTime) {
						startTimerCountdown(data.changes.turnEndTime);
					}
					// Clear selected card on turn change
					setSelectedCard(null);
				}

				// ✅ OPTIMIZATION: Handle timer_sync via state_delta (consolidated event)
				if (data.eventType === "timer_sync") {
					// Resync timer if turnEndTime is provided
					if (data.changes.turnEndTime) {
						startTimerCountdown(data.changes.turnEndTime);
					}
				}
			}
		},
		[startTimerCountdown, showNotification]
	);

	const handleTimerSync = useCallback(
		(data) => {
			if (data.turnEndTime) {
				setGameState((prev) => ({
					...prev,
					turnEndTime: data.turnEndTime,
					timeLeft: data.timeLeft || prev.timeLeft,
				}));
				startTimerCountdown(data.turnEndTime);
			}
		},
		[startTimerCountdown]
	);

	const handleGameEnd = useCallback(
		(data) => {
			setGameState((prev) => ({
				...prev,
				gameEnded: true,
				winner: data.winnerName || data.winner,
				scores: data.scores || {},
			}));

			showNotification(
				`🏆 Game Over! Winner: ${data.winnerName || data.winner}`
			);
		},
		[showNotification]
	);

	const handlePlayerLeft = useCallback(
		(data) => {
			console.log("👋 Player left", data);

			// Update players list
			if (data.playerId) {
				setGameState((prev) => ({
					...prev,
					players: Array.isArray(prev.players)
						? prev.players.filter((p) => p.userId !== data.playerId)
						: prev.players,
				}));
			}

			if (data.playerName) {
				showNotification(`👋 ${data.playerName} left the game`);
			}
		},
		[showNotification]
	);

	// 🔄 7-0 Rule: Handle swap request (when player plays 0 card)
	const handleSwapRequest = useCallback(
		(data) => {
			console.log("🔄 Swap request received", data);

			// Check if this player needs to choose a swap target
			const myUserId = myUserIdRef.current || session?.user_id;
			if (data.playerId === myUserId) {
				// This player played the 0 card and needs to choose swap target
				setGameState((prev) => ({
					...prev,
					swapRequestActive: true,
					availableSwapTargets: data.availableTargets || [],
				}));
				showNotification("🔄 Choose a player to swap hands with!");
			} else {
				// Another player played 0 card, just show notification
				const playerName =
					gameState.players?.find((p) => p.userId === data.playerId)
						?.username || "A player";
				showNotification(
					`🔄 ${playerName} is choosing who to swap hands with...`
				);
			}
		},
		[session, showNotification, gameState.players]
	);

	// 🔄 7-0 Rule: Handle swap selection pending (notification to other players)
	const handleSwapSelectionPending = useCallback(
		(data) => {
			console.log("⏳ Swap selection pending", data);

			// Show notification to other players
			if (data.message) {
				showNotification(data.message);
			}
		},
		[showNotification]
	);

	// 🔄 7-0 Rule: Handle swap complete (after swap target chosen)
	const handleSwapComplete = useCallback(
		(data) => {
			console.log("✅ Swap complete", data);

			// Clear swap request state
			setGameState((prev) => ({
				...prev,
				swapRequestActive: false,
				availableSwapTargets: [],
			}));

			// Show notification about the swap
			const requesterName =
				gameState.players?.find((p) => p.userId === data.requester)?.username ||
				"Player";
			const targetName =
				gameState.players?.find((p) => p.userId === data.target)?.username ||
				"Player";
			showNotification(`🔄 ${requesterName} swapped hands with ${targetName}!`);
		},
		[showNotification, gameState.players]
	);

	// 🔄 7-0 Rule: Handle swap timeout (10 seconds expired without selection)
	const handleSwapTimeout = useCallback(
		(data) => {
			console.log("⏰ Swap timeout", data);

			// Clear swap request state
			setGameState((prev) => ({
				...prev,
				swapRequestActive: false,
				availableSwapTargets: [],
			}));

			// Show notification
			if (data.message) {
				showNotification(`⏰ ${data.message}`);
			}
		},
		[showNotification]
	);

	// Match Actions
	const handleCreateMatch = useCallback(async () => {
		try {
			console.log("Creating match with:", {
				gameMode: matchForm.gameMode,
				matchType: matchForm.matchType,
			});
			const result = await createOrJoinMatch(
				client,
				session,
				socket,
				matchForm.gameMode,
				matchForm.matchType
			);
			console.log("Match created:", result);
			setCurrentMatch(result);
			matchIdRef.current = result.matchId; // ✅ Store in ref for reliable access
			addEvent("match_created", `Match created: ${result.matchId}`, "success");
			showNotification(`✅ Match created: ${result.matchId}`);
		} catch (error) {
			console.error("Match creation error:", error);
			const errorMsg = error?.message || error?.toString() || "Unknown error";
			addEvent(
				"match_error",
				`Failed to create match: ${errorMsg}`,
				"error",
				error
			);
			showNotification(`❌ Failed to create match: ${errorMsg}`);
		}
	}, [client, session, socket, matchForm, addEvent, showNotification]);

	const handleJoinMatch = useCallback(async () => {
		try {
			const result = await createOrJoinMatch(
				client,
				session,
				socket,
				null,
				null,
				manualMatchId
			);
			setCurrentMatch(result);
			matchIdRef.current = result.matchId; // ✅ Store in ref for reliable access
			// ✅ REMOVED: Don't add match_joined here - it's added when player_joined event is received
			// addEvent("match_joined", `Joined match: ${result.matchId}`, "success");

			// ✅ FIX: Only show notification once
			if (!hasShownJoinedNotification.current) {
				showNotification(`✅ Joined match`);
				hasShownJoinedNotification.current = true;
			}
		} catch (error) {
			addEvent(
				"match_error",
				`Failed to join match: ${error.message}`,
				"error"
			);
			showNotification("❌ Failed to join match");
		}
	}, [client, session, socket, manualMatchId, addEvent, showNotification]);

	const handleStartMatchmaking = useCallback(async () => {
		try {
			const result = await startMatchmaking(
				client,
				session,
				socket,
				matchForm.gameMode
			);

			setCurrentMatch({
				matchId: result.matchId,
				match: result.match,
			});
			setIsMatchmaking(false);
			setMatchmakerStatus("");

			const message = result.success
				? "Random match created! Waiting for players (5s)..."
				: "Joined existing random match!";

			addEvent(
				"match_created",
				`${result.message}: ${result.matchId}`,
				"success"
			);
			showNotification(`🎮 ${message}`);
		} catch (error) {
			addEvent(
				"matchmaking_error",
				`Matchmaking failed: ${error.message}`,
				"error"
			);
			setIsMatchmaking(false);
		}
	}, [client, session, socket, matchForm.gameMode, addEvent, showNotification]);

	const handleCancelMatchmaking = useCallback(async () => {
		try {
			await cancelMatchmaking(socket, matchmakerTicket);
			setIsMatchmaking(false);
			setMatchmakerTicket(null);
			addEvent("matchmaking_cancelled", "Matchmaking cancelled", "warning");
		} catch (error) {
			addEvent(
				"matchmaking_error",
				`Failed to cancel: ${error.message}`,
				"error"
			);
		}
	}, [socket, matchmakerTicket, addEvent]);

	const handleAddBot = useCallback(async () => {
		// 🔧 FIX: Prevent multiple simultaneous bot additions
		if (isAddingBot) {
			console.log("Bot addition already in progress, ignoring...");
			return;
		}

		setIsAddingBot(true);
		try {
			const response = await addBotToMatch(
				client,
				session,
				currentMatch.matchId
			);
			addEvent(
				"bot_added",
				`Bot added: ${response.message || "Success"}`,
				"success"
			);
			showNotification("🤖 Bot added");
		} catch (error) {
			console.error("Add bot error:", error);
			// 🔧 FIX: Better error message extraction
			let errorMsg = "Unknown error";
			if (error?.message) {
				errorMsg = error.message;
			} else if (typeof error === "string") {
				errorMsg = error;
			} else if (error) {
				// Try to extract meaningful error info
				errorMsg = JSON.stringify(error);
			}
			addEvent("bot_error", `Failed to add bot: ${errorMsg}`, "error");
			showNotification(`❌ Failed to add bot: ${errorMsg}`);
		} finally {
			// Reset the flag after a short delay to allow the lobby_state event to arrive
			setTimeout(() => setIsAddingBot(false), 1000);
		}
	}, [client, session, currentMatch, addEvent, showNotification, isAddingBot]);

	const handleStartGame = useCallback(async () => {
		try {
			await sendGameAction(socket, currentMatch.matchId, {
				action: "start_game",
			});
			addEvent("game_starting", "Starting game...", "info");
		} catch (error) {
			addEvent("game_error", `Failed to start game: ${error.message}`, "error");
		}
	}, [socket, currentMatch, addEvent]);

	const handleLeaveMatch = useCallback(async () => {
		try {
			await leaveMatch(socket, currentMatch?.matchId);
			setCurrentMatch(null);
			matchIdRef.current = null; // ✅ Clear match ID ref
			hasShownJoinedNotification.current = false; // ✅ Reset notification flag
			setGameState((prev) => ({
				...prev,
				isGameStarted: false,
				gameEnded: false,
				players: [],
				myHand: [],
				playableCards: [],
			}));
			addEvent("match_left", "Left match", "warning");
		} catch (error) {
			addEvent(
				"match_error",
				`Failed to leave match: ${error.message}`,
				"error"
			);
		}
	}, [socket, currentMatch, addEvent]);

	// Game Actions
	const handlePlayCard = useCallback(
		async (cardId, color = null) => {
			try {
				const action = {
					action: "play_card",
					cardId,
					// ✅ HYBRID: Send estimated animation duration
					estimatedDuration: 800, // 800ms for card play animation
				};
				if (color !== null) {
					action.color = color;
				}
				await sendGameAction(socket, currentMatch.matchId, action);
				setSelectedCard(null);
				addEvent("action_sent", `Played card ${cardId}`, "success");
			} catch (error) {
				addEvent(
					"action_error",
					`Failed to play card: ${error.message}`,
					"error"
				);
			}
		},
		[socket, currentMatch, addEvent]
	);

	const handleDrawCard = useCallback(async () => {
		try {
			await sendGameAction(socket, currentMatch.matchId, {
				action: "draw_card",
				// ✅ HYBRID: Send estimated animation duration
				estimatedDuration: 600, // 600ms for card draw animation
			});
			addEvent("action_sent", "Drew card", "success");
		} catch (error) {
			addEvent(
				"action_error",
				`Failed to draw card: ${error.message}`,
				"error"
			);
		}
	}, [socket, currentMatch, addEvent]);

	const handleChooseSwapTarget = useCallback(
		async (targetUserId) => {
			try {
				await sendGameAction(socket, currentMatch.matchId, {
					action: "choose_swap_target",
					targetUserId,
				});
				addEvent("action_sent", "Chose swap target", "success");
			} catch (error) {
				addEvent(
					"action_error",
					`Failed to choose target: ${error.message}`,
					"error"
				);
			}
		},
		[socket, currentMatch, addEvent]
	);

	const handlePlayShield = useCallback(async () => {
		try {
			await sendGameAction(socket, currentMatch.matchId, {
				action: "play_shield",
			});
			addEvent("action_sent", "Played shield", "success");
		} catch (error) {
			addEvent(
				"action_error",
				`Failed to play shield: ${error.message}`,
				"error"
			);
		}
	}, [socket, currentMatch, addEvent]);

	const handleAutoPlay = useCallback(async () => {
		try {
			await sendGameAction(socket, currentMatch.matchId, {
				action: "autoplay_turn",
			});
			addEvent("action_sent", "Auto-play triggered", "warning");
		} catch (error) {
			addEvent(
				"action_error",
				`Failed to auto-play: ${error.message}`,
				"error"
			);
		}
	}, [socket, currentMatch, addEvent]);

	const handleCardSelect = useCallback((cardId) => {
		setSelectedCard(cardId);
	}, []);

	const handleClearEvents = useCallback(() => {
		setEvents([]);
	}, []);

	// ✅ FIX: Set up socket event handlers for external socket
	// This runs AFTER all handlers are defined to avoid initialization order issues
	useEffect(() => {
		if (socket && externalSocket) {
			console.log("🔧 Setting up socket event handlers for external socket...");

			// Match data handler - uses ref to call handleMatchData
			socket.onmatchdata = (matchData) => {
				console.log("📨 Received match data:", matchData);
				const parsed = parseMatchData(matchData);
				if (parsed) {
					console.log("📨 Parsed match data:", parsed);
					// Use ref to call handleMatchData (avoids initialization order issues)
					if (handleMatchDataRef.current) {
						handleMatchDataRef.current(parsed);
					} else {
						console.warn("⚠️ handleMatchDataRef.current is not set yet");
					}
				}
			};

			// Matchmaker matched
			socket.onmatchmakermatched = async (matched) => {
				try {
					const match = await socket.joinMatch(matched.match_id);
					setCurrentMatch({ matchId: match.match_id, match });
					matchIdRef.current = match.match_id;
					setIsMatchmaking(false);
					setMatchmakerTicket(null);
				} catch (error) {
					console.error("Failed to join match:", error);
				}
			};

			console.log("✅ Socket event handlers configured for external socket");
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [socket, externalSocket]);

	return (
		<div className="container">
			<h1>🎮 UNO Nakama Backend Tester</h1>

			{/* Notifications */}
			<div
				style={{
					position: "fixed",
					top: "20px",
					right: "20px",
					zIndex: 1000,
					display: "flex",
					flexDirection: "column",
					gap: "10px",
				}}
			>
				{notifications.map((notif) => (
					<div
						key={notif.id}
						style={{
							padding: "12px 20px",
							backgroundColor: "#28a745",
							color: "white",
							borderRadius: "6px",
							boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
							animation: "slideIn 0.3s ease",
						}}
					>
						{notif.message}
					</div>
				))}
			</div>

			{/* Main Tab Navigation - Only show in standalone mode */}
			{!externalSession && (
				<div
					style={{
						display: "flex",
						gap: "10px",
						marginBottom: "20px",
						justifyContent: "center",
					}}
				>
					<button
						onClick={() => setMainTab("game")}
						style={{
							padding: "12px 24px",
							backgroundColor: mainTab === "game" ? "#007bff" : "#6c757d",
							color: "white",
							border: "none",
							borderRadius: "8px",
							cursor: "pointer",
							fontSize: "16px",
							fontWeight: "bold",
							minWidth: "150px",
						}}
					>
						🎮 Game
					</button>
					<button
						onClick={() => setMainTab("social")}
						style={{
							padding: "12px 24px",
							backgroundColor: mainTab === "social" ? "#007bff" : "#6c757d",
							color: "white",
							border: "none",
							borderRadius: "8px",
							cursor: "pointer",
							fontSize: "16px",
							fontWeight: "bold",
							minWidth: "150px",
						}}
					>
						📱 Social
					</button>
					<button
						onClick={() => setMainTab("chat")}
						style={{
							padding: "12px 24px",
							backgroundColor: mainTab === "chat" ? "#007bff" : "#6c757d",
							color: "white",
							border: "none",
							borderRadius: "8px",
							cursor: "pointer",
							fontSize: "16px",
							fontWeight: "bold",
							minWidth: "150px",
						}}
					>
						💬 Chat
					</button>
				</div>
			)}

			{/* Game Tab - Always show when using external auth, otherwise show based on mainTab */}
			{(externalSession || mainTab === "game") && (
				<div className="grid">
					{/* Left Column */}
					<div>
						{/* Only show AuthSection if not using external authentication */}
						{!externalSession && (
							<AuthSection
								client={client}
								session={session}
								isConnected={isConnected}
								authForm={authForm}
								setAuthForm={setAuthForm}
								onAuthenticate={handleAuthenticate}
								onConnect={handleConnect}
								onDisconnect={handleDisconnect}
							/>
						)}

						<MatchSection
							isConnected={isConnected}
							currentMatch={currentMatch}
							gameState={gameState}
							matchForm={matchForm}
							setMatchForm={setMatchForm}
							manualMatchId={manualMatchId}
							setManualMatchId={setManualMatchId}
							isMatchmaking={isMatchmaking}
							matchmakerStatus={matchmakerStatus}
							onCreateMatch={handleCreateMatch}
							onJoinMatch={handleJoinMatch}
							onStartMatchmaking={handleStartMatchmaking}
							onCancelMatchmaking={handleCancelMatchmaking}
							onAddBot={handleAddBot}
							isAddingBot={isAddingBot}
							onStartGame={handleStartGame}
							onLeaveMatch={handleLeaveMatch}
							session={session}
						/>
					</div>

					{/* Center Column */}
					<div>
						<GameBoard
							gameState={gameState}
							timerDisplay={timerDisplay}
							session={session}
							myUserId={myUserIdRef.current}
						/>

						<PlayerHand
							gameState={gameState}
							session={session}
							myUserId={myUserIdRef.current}
							selectedCard={selectedCard}
							onCardSelect={handleCardSelect}
						/>
					</div>

					{/* Right Column */}
					<div>
						<ActionPanel
							gameState={gameState}
							session={session}
							myUserId={myUserIdRef.current}
							selectedCard={selectedCard}
							onPlayCard={handlePlayCard}
							onDrawCard={handleDrawCard}
							onChooseSwapTarget={handleChooseSwapTarget}
							onPlayShield={handlePlayShield}
							onAutoPlay={handleAutoPlay}
						/>

						<EventLog events={events} onClear={handleClearEvents} />
					</div>
					<OpponentList gameState={gameState} session={session} />
				</div>
			)}

			{/* Social Tab - Only show in standalone mode */}
			{!externalSession && mainTab === "social" && (
				<div className="grid">
					{/* Left Column - Auth (only show if not using external authentication) */}
					{!externalSession && (
						<div>
							<AuthSection
								client={client}
								session={session}
								isConnected={isConnected}
								authForm={authForm}
								setAuthForm={setAuthForm}
								onAuthenticate={handleAuthenticate}
								onConnect={handleConnect}
								onDisconnect={handleDisconnect}
							/>
						</div>
					)}

					{/* Center Column - Social */}
					<div>
						<SocialSection
							client={client}
							session={session}
							onEvent={addEvent}
						/>
					</div>

					{/* Right Column - Event Log */}
					<div>
						<EventLog events={events} onClear={handleClearEvents} />
					</div>
				</div>
			)}

			{/* Chat Tab - Only show in standalone mode */}
			{!externalSession && mainTab === "chat" && (
				<div className="grid">
					{/* Left Column - Auth (only show if not using external authentication) */}
					{!externalSession && (
						<div>
							<AuthSection
								client={client}
								session={session}
								isConnected={isConnected}
								authForm={authForm}
								setAuthForm={setAuthForm}
								onAuthenticate={handleAuthenticate}
								onConnect={handleConnect}
								onDisconnect={handleDisconnect}
							/>
						</div>
					)}

					{/* Center Column - Chat */}
					<div>
						<ChatSection client={client} session={session} onEvent={addEvent} />
					</div>

					{/* Right Column - Event Log */}
					<div>
						<EventLog events={events} onClear={handleClearEvents} />
					</div>
				</div>
			)}
		</div>
	);
}

export default App;
