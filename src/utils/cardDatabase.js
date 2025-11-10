/**
 * UNO Ultimate Card Database
 *
 * This is the single source of truth for all card data in the frontend.
 * It matches the backend CardDatabase exactly (kalpix-backend/src/uno_game.go line 324).
 *
 * Card Structure:
 * - id: Unique card identifier (0-109)
 * - color: 0=Red, 1=Blue, 2=Green, 3=Yellow, 4=Wild
 * - type: 0=Number, 1=Skip, 2=Reverse, 3=DrawTwo, 4=Wild, 5=WildDrawFour, 6=BlueThunder, 7=Shield, 8=SkipBlast, 9=RedFury
 * - value: Number value (0-9 for number cards, -1 for special cards)
 * - points: Point value for scoring
 * - canStack: Whether this card can be stacked with Draw Two/Wild+4
 * - isSevenO: Whether this card triggers Seven-O rule (7 or 0)
 */

// Card Color Constants
export const CardColor = {
	RED: 0,
	BLUE: 1,
	GREEN: 2,
	YELLOW: 3,
	WILD: 4,
};

export const ColorNames = {
	0: "Red",
	1: "Blue",
	2: "Green",
	3: "Yellow",
	4: "Wild",
};

// Card Type Constants
export const CardType = {
	NUMBER: 0,
	SKIP: 1,
	REVERSE: 2,
	DRAW_TWO: 3,
	WILD: 4,
	WILD_DRAW_FOUR: 5,
	BLUE_THUNDER: 6,
	SHIELD: 7,
	SKIP_BLAST: 8,
	RED_FURY: 9,
};

export const TypeNames = {
	0: "Number",
	1: "Skip",
	2: "Reverse",
	3: "Draw Two",
	4: "Wild",
	5: "Wild Draw Four",
	6: "Blue Thunder",
	7: "Shield",
	8: "Skip Blast",
	9: "Red Fury",
};

// Complete Card Database (110 cards: 0-109)
export const CardDatabase = [
	// Red cards (0-24)
	{
		id: 0,
		color: 0,
		type: 0,
		value: 0,
		points: 0,
		canStack: false,
		isSevenO: true,
	},
	{
		id: 1,
		color: 0,
		type: 0,
		value: 1,
		points: 1,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 2,
		color: 0,
		type: 0,
		value: 1,
		points: 1,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 3,
		color: 0,
		type: 0,
		value: 2,
		points: 2,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 4,
		color: 0,
		type: 0,
		value: 2,
		points: 2,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 5,
		color: 0,
		type: 0,
		value: 3,
		points: 3,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 6,
		color: 0,
		type: 0,
		value: 3,
		points: 3,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 7,
		color: 0,
		type: 0,
		value: 4,
		points: 4,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 8,
		color: 0,
		type: 0,
		value: 4,
		points: 4,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 9,
		color: 0,
		type: 0,
		value: 5,
		points: 5,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 10,
		color: 0,
		type: 0,
		value: 5,
		points: 5,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 11,
		color: 0,
		type: 0,
		value: 6,
		points: 6,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 12,
		color: 0,
		type: 0,
		value: 6,
		points: 6,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 13,
		color: 0,
		type: 0,
		value: 7,
		points: 7,
		canStack: false,
		isSevenO: true,
	},
	{
		id: 14,
		color: 0,
		type: 0,
		value: 7,
		points: 7,
		canStack: false,
		isSevenO: true,
	},
	{
		id: 15,
		color: 0,
		type: 0,
		value: 8,
		points: 8,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 16,
		color: 0,
		type: 0,
		value: 8,
		points: 8,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 17,
		color: 0,
		type: 0,
		value: 9,
		points: 9,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 18,
		color: 0,
		type: 0,
		value: 9,
		points: 9,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 19,
		color: 0,
		type: 1,
		value: -1,
		points: 20,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 20,
		color: 0,
		type: 1,
		value: -1,
		points: 20,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 21,
		color: 0,
		type: 2,
		value: -1,
		points: 20,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 22,
		color: 0,
		type: 2,
		value: -1,
		points: 20,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 23,
		color: 0,
		type: 3,
		value: -1,
		points: 20,
		canStack: true,
		isSevenO: false,
	},
	{
		id: 24,
		color: 0,
		type: 3,
		value: -1,
		points: 20,
		canStack: true,
		isSevenO: false,
	},

	// Blue cards (25-49)
	{
		id: 25,
		color: 1,
		type: 0,
		value: 0,
		points: 0,
		canStack: false,
		isSevenO: true,
	},
	{
		id: 26,
		color: 1,
		type: 0,
		value: 1,
		points: 1,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 27,
		color: 1,
		type: 0,
		value: 1,
		points: 1,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 28,
		color: 1,
		type: 0,
		value: 2,
		points: 2,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 29,
		color: 1,
		type: 0,
		value: 2,
		points: 2,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 30,
		color: 1,
		type: 0,
		value: 3,
		points: 3,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 31,
		color: 1,
		type: 0,
		value: 3,
		points: 3,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 32,
		color: 1,
		type: 0,
		value: 4,
		points: 4,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 33,
		color: 1,
		type: 0,
		value: 4,
		points: 4,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 34,
		color: 1,
		type: 0,
		value: 5,
		points: 5,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 35,
		color: 1,
		type: 0,
		value: 5,
		points: 5,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 36,
		color: 1,
		type: 0,
		value: 6,
		points: 6,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 37,
		color: 1,
		type: 0,
		value: 6,
		points: 6,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 38,
		color: 1,
		type: 0,
		value: 7,
		points: 7,
		canStack: false,
		isSevenO: true,
	},
	{
		id: 39,
		color: 1,
		type: 0,
		value: 7,
		points: 7,
		canStack: false,
		isSevenO: true,
	},
	{
		id: 40,
		color: 1,
		type: 0,
		value: 8,
		points: 8,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 41,
		color: 1,
		type: 0,
		value: 8,
		points: 8,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 42,
		color: 1,
		type: 0,
		value: 9,
		points: 9,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 43,
		color: 1,
		type: 0,
		value: 9,
		points: 9,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 44,
		color: 1,
		type: 1,
		value: -1,
		points: 20,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 45,
		color: 1,
		type: 1,
		value: -1,
		points: 20,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 46,
		color: 1,
		type: 2,
		value: -1,
		points: 20,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 47,
		color: 1,
		type: 2,
		value: -1,
		points: 20,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 48,
		color: 1,
		type: 3,
		value: -1,
		points: 20,
		canStack: true,
		isSevenO: false,
	},
	{
		id: 49,
		color: 1,
		type: 3,
		value: -1,
		points: 20,
		canStack: true,
		isSevenO: false,
	},

	// Green cards (50-74)
	{
		id: 50,
		color: 2,
		type: 0,
		value: 0,
		points: 0,
		canStack: false,
		isSevenO: true,
	},
	{
		id: 51,
		color: 2,
		type: 0,
		value: 1,
		points: 1,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 52,
		color: 2,
		type: 0,
		value: 1,
		points: 1,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 53,
		color: 2,
		type: 0,
		value: 2,
		points: 2,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 54,
		color: 2,
		type: 0,
		value: 2,
		points: 2,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 55,
		color: 2,
		type: 0,
		value: 3,
		points: 3,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 56,
		color: 2,
		type: 0,
		value: 3,
		points: 3,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 57,
		color: 2,
		type: 0,
		value: 4,
		points: 4,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 58,
		color: 2,
		type: 0,
		value: 4,
		points: 4,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 59,
		color: 2,
		type: 0,
		value: 5,
		points: 5,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 60,
		color: 2,
		type: 0,
		value: 5,
		points: 5,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 61,
		color: 2,
		type: 0,
		value: 6,
		points: 6,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 62,
		color: 2,
		type: 0,
		value: 6,
		points: 6,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 63,
		color: 2,
		type: 0,
		value: 7,
		points: 7,
		canStack: false,
		isSevenO: true,
	},
	{
		id: 64,
		color: 2,
		type: 0,
		value: 7,
		points: 7,
		canStack: false,
		isSevenO: true,
	},
	{
		id: 65,
		color: 2,
		type: 0,
		value: 8,
		points: 8,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 66,
		color: 2,
		type: 0,
		value: 8,
		points: 8,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 67,
		color: 2,
		type: 0,
		value: 9,
		points: 9,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 68,
		color: 2,
		type: 0,
		value: 9,
		points: 9,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 69,
		color: 2,
		type: 1,
		value: -1,
		points: 20,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 70,
		color: 2,
		type: 1,
		value: -1,
		points: 20,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 71,
		color: 2,
		type: 2,
		value: -1,
		points: 20,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 72,
		color: 2,
		type: 2,
		value: -1,
		points: 20,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 73,
		color: 2,
		type: 3,
		value: -1,
		points: 20,
		canStack: true,
		isSevenO: false,
	},
	{
		id: 74,
		color: 2,
		type: 3,
		value: -1,
		points: 20,
		canStack: true,
		isSevenO: false,
	},

	// Yellow cards (75-99)
	{
		id: 75,
		color: 3,
		type: 0,
		value: 0,
		points: 0,
		canStack: false,
		isSevenO: true,
	},
	{
		id: 76,
		color: 3,
		type: 0,
		value: 1,
		points: 1,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 77,
		color: 3,
		type: 0,
		value: 1,
		points: 1,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 78,
		color: 3,
		type: 0,
		value: 2,
		points: 2,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 79,
		color: 3,
		type: 0,
		value: 2,
		points: 2,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 80,
		color: 3,
		type: 0,
		value: 3,
		points: 3,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 81,
		color: 3,
		type: 0,
		value: 3,
		points: 3,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 82,
		color: 3,
		type: 0,
		value: 4,
		points: 4,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 83,
		color: 3,
		type: 0,
		value: 4,
		points: 4,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 84,
		color: 3,
		type: 0,
		value: 5,
		points: 5,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 85,
		color: 3,
		type: 0,
		value: 5,
		points: 5,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 86,
		color: 3,
		type: 0,
		value: 6,
		points: 6,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 87,
		color: 3,
		type: 0,
		value: 6,
		points: 6,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 88,
		color: 3,
		type: 0,
		value: 7,
		points: 7,
		canStack: false,
		isSevenO: true,
	},
	{
		id: 89,
		color: 3,
		type: 0,
		value: 7,
		points: 7,
		canStack: false,
		isSevenO: true,
	},
	{
		id: 90,
		color: 3,
		type: 0,
		value: 8,
		points: 8,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 91,
		color: 3,
		type: 0,
		value: 8,
		points: 8,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 92,
		color: 3,
		type: 0,
		value: 9,
		points: 9,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 93,
		color: 3,
		type: 0,
		value: 9,
		points: 9,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 94,
		color: 3,
		type: 1,
		value: -1,
		points: 20,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 95,
		color: 3,
		type: 1,
		value: -1,
		points: 20,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 96,
		color: 3,
		type: 2,
		value: -1,
		points: 20,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 97,
		color: 3,
		type: 2,
		value: -1,
		points: 20,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 98,
		color: 3,
		type: 3,
		value: -1,
		points: 20,
		canStack: true,
		isSevenO: false,
	},
	{
		id: 99,
		color: 3,
		type: 3,
		value: -1,
		points: 20,
		canStack: true,
		isSevenO: false,
	},

	// Wild cards (100-102)
	{
		id: 100,
		color: 4,
		type: 4,
		value: -1,
		points: 50,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 101,
		color: 4,
		type: 4,
		value: -1,
		points: 50,
		canStack: false,
		isSevenO: false,
	},
	{
		id: 102,
		color: 4,
		type: 4,
		value: -1,
		points: 50,
		canStack: false,
		isSevenO: false,
	},

	// Wild Draw Four (103-105)
	{
		id: 103,
		color: 4,
		type: 5,
		value: -1,
		points: 50,
		canStack: true,
		isSevenO: false,
	},
	{
		id: 104,
		color: 4,
		type: 5,
		value: -1,
		points: 50,
		canStack: true,
		isSevenO: false,
	},
	{
		id: 105,
		color: 4,
		type: 5,
		value: -1,
		points: 50,
		canStack: true,
		isSevenO: false,
	},

	// Special cards (106-109)
	{
		id: 106,
		color: 1,
		type: 6,
		value: -1,
		points: 30,
		canStack: false,
		isSevenO: false,
	}, // Blue Thunder
	{
		id: 107,
		color: 4,
		type: 7,
		value: -1,
		points: 40,
		canStack: false,
		isSevenO: false,
	}, // Shield
	{
		id: 108,
		color: 4,
		type: 8,
		value: -1,
		points: 50,
		canStack: false,
		isSevenO: false,
	}, // Skip Blast
	{
		id: 109,
		color: 0,
		type: 9,
		value: -1,
		points: 40,
		canStack: false,
		isSevenO: false,
	}, // Red Fury
];

/**
 * Get card details by ID
 * @param {number} cardId - Card ID (0-109)
 * @returns {object} Card object with all properties
 */
export function getCard(cardId) {
	if (cardId < 0 || cardId >= CardDatabase.length) {
		console.error(`Invalid card ID: ${cardId}`);
		return null;
	}
	return CardDatabase[cardId];
}

/**
 * Get human-readable card name
 * @param {number} cardId - Card ID (0-109)
 * @returns {string} Card name like "Red 5", "Blue Skip", "Wild Draw Four"
 */
export function getCardName(cardId) {
	const card = getCard(cardId);
	if (!card) return "Unknown Card";

	const colorName = ColorNames[card.color];

	if (card.type === CardType.NUMBER) {
		return `${colorName} ${card.value}`;
	} else if (card.type === CardType.WILD) {
		return "Wild";
	} else if (card.type === CardType.WILD_DRAW_FOUR) {
		return "Wild Draw Four";
	} else {
		const typeName = TypeNames[card.type];
		if (card.color === CardColor.WILD) {
			return typeName; // Shield
		}
		return `${colorName} ${typeName}`;
	}
}

/**
 * Get card color name
 * @param {number} colorId - Color ID (0-4)
 * @returns {string} Color name
 */
export function getColorName(colorId) {
	return ColorNames[colorId] || "Unknown";
}

/**
 * Get card type name
 * @param {number} typeId - Type ID (0-9)
 * @returns {string} Type name
 */
export function getTypeName(typeId) {
	return TypeNames[typeId] || "Unknown";
}

/**
 * Get color hex code for styling
 * @param {number} colorId - Color ID (0-4)
 * @returns {string} Hex color code
 */
export function getColorHex(colorId) {
	const colors = {
		0: "#e74c3c", // red
		1: "#3498db", // blue
		2: "#2ecc71", // green
		3: "#f39c12", // yellow
		4: "#95a5a6", // wild (gray)
	};
	return colors[colorId] || "#95a5a6";
}

export default CardDatabase;
