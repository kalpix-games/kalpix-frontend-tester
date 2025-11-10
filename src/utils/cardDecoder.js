/**
 * Card Decoder Utility
 * Converts card IDs to human-readable names
 */

// Color constants
export const COLORS = {
	0: "red",
	1: "blue",
	2: "green",
	3: "yellow",
};

export const COLOR_NAMES = ["Red", "Blue", "Green", "Yellow"];

// Card type constants
export const CARD_TYPES = {
	NUMBER: "number",
	SKIP: "skip",
	REVERSE: "reverse",
	DRAW_TWO: "draw_two",
	WILD: "wild",
	WILD_DRAW_FOUR: "wild_draw_four",
	DEAD_BLUE: "dead_blue",
	SHIELD: "shield",
	BLOCK_ALL: "block_all",
	RED_FIXED: "red_fixed",
	SKIP_BLAST: "skip_blast",
};

/**
 * Decode card ID to human-readable format
 * @param {number|object} card - Card ID or card object
 * @param {number} currentColor - OPTIONAL: Only used for displaying wild cards in hand with chosen color
 * @returns {string} Human-readable card name
 */
export function decodeCard(card, currentColor = null) {
	// Handle card objects (backend sends {id, color, type, value, points})
	let cardId;
	if (typeof card === "object" && card !== null) {
		cardId = card.id;
	} else {
		cardId = card;
	}

	if (cardId === null || cardId === undefined) {
		return "unknown";
	}

	// Card ID ranges:
	// 0-75: Number cards (0-9 in each color, with duplicates)
	// 76-83: Skip cards (2 per color)
	// 84-91: Reverse cards (2 per color)
	// 92-99: Draw Two cards (2 per color)
	// 100-103: Wild cards (4 total)
	// 104-107: Wild Draw Four cards (4 total)

	// Number cards (0-75)
	if (cardId >= 0 && cardId <= 75) {
		const colorIndex = Math.floor(cardId / 19);
		const value = cardId % 19;
		const actualValue = value <= 9 ? value : value - 9;
		return `${COLORS[colorIndex]} ${actualValue}`;
	}

	// Skip cards (76-83)
	if (cardId >= 76 && cardId <= 83) {
		const colorIndex = Math.floor((cardId - 76) / 2);
		return `${COLORS[colorIndex]} skip`;
	}

	// Reverse cards (84-91)
	if (cardId >= 84 && cardId <= 91) {
		const colorIndex = Math.floor((cardId - 84) / 2);
		return `${COLORS[colorIndex]} reverse`;
	}

	// Draw Two cards (92-99)
	if (cardId >= 92 && cardId <= 99) {
		const colorIndex = Math.floor((cardId - 92) / 2);
		return `${COLORS[colorIndex]} +2`;
	}

	// Wild cards (100-103)
	// ✅ FIX: Just show "wild" - the currentColor is shown separately in the UI
	if (cardId >= 100 && cardId <= 103) {
		return "wild";
	}

	// Wild Draw Four cards (104-107)
	// ✅ FIX: Just show "wild +4" - the currentColor is shown separately in the UI
	if (cardId >= 104 && cardId <= 107) {
		return "wild +4";
	}

	// Special cards (if implemented)
	// Dead Blue, Shield, Block All, Red Fixed, Skip Blast
	// These would be in higher ID ranges

	return `card ${cardId}`;
}

/**
 * Get color name from color index
 * @param {number} colorIndex - Color index (0-3)
 * @returns {string} Color name
 */
export function getColorName(colorIndex) {
	return COLOR_NAMES[colorIndex] || "Unknown";
}

/**
 * Get color hex code for styling
 * @param {number} colorIndex - Color index (0-3)
 * @returns {string} Hex color code
 */
export function getColorHex(colorIndex) {
	const colors = {
		0: "#e74c3c", // red
		1: "#3498db", // blue
		2: "#2ecc71", // green
		3: "#f39c12", // yellow
	};
	return colors[colorIndex] || "#95a5a6";
}

/**
 * Check if card is a wild card
 * @param {number|object} card - Card ID or card object
 * @returns {boolean} True if wild card
 */
export function isWildCard(card) {
	const cardId = typeof card === "object" ? card.id : card;
	return cardId >= 100 && cardId <= 107;
}

/**
 * Check if card is an action card
 * @param {number|object} card - Card ID or card object
 * @returns {boolean} True if action card
 */
export function isActionCard(card) {
	const cardId = typeof card === "object" ? card.id : card;
	return cardId >= 76 && cardId <= 107;
}

/**
 * Get card color from card ID
 * @param {number|object} card - Card ID or card object
 * @returns {number|null} Color index or null for wild cards
 */
export function getCardColor(card) {
	const cardId = typeof card === "object" ? card.id : card;

	if (cardId >= 0 && cardId <= 75) {
		return Math.floor(cardId / 19);
	}
	if (cardId >= 76 && cardId <= 83) {
		return Math.floor((cardId - 76) / 2);
	}
	if (cardId >= 84 && cardId <= 91) {
		return Math.floor((cardId - 84) / 2);
	}
	if (cardId >= 92 && cardId <= 99) {
		return Math.floor((cardId - 92) / 2);
	}

	return null; // Wild cards have no color
}

/**
 * Format time remaining
 * @param {number} seconds - Seconds remaining
 * @returns {string} Formatted time (MM:SS)
 */
export function formatTime(seconds) {
	if (seconds < 0) return "00:00";
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins.toString().padStart(2, "0")}:${secs
		.toString()
		.padStart(2, "0")}`;
}

/**
 * Get time display with warning indicator
 * @param {number} seconds - Seconds remaining
 * @returns {object} {display: string, isWarning: boolean}
 */
export function getTimeDisplay(seconds) {
	return {
		display: formatTime(seconds),
		isWarning: seconds <= 10 && seconds > 0,
		isExpired: seconds <= 0,
	};
}
