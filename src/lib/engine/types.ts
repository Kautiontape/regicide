export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
	id: string;
	suit: Suit | null;
	/** Solo Jesters are never dealt into the tavern (they're side-of-screen one-shot abilities), but
	 *  'JESTER' stays in the rank union so multiplayer can reintroduce them without retyping every site. */
	rank: Rank | 'JESTER';
	/** Attack/health value used in combat math. Aces=1, 2-10 face value, J=10, Q=15, K=20, Jester=0. */
	value: number;
}

export interface Royal extends Card {
	suit: Suit;
	rank: 'J' | 'Q' | 'K';
	attack: number;
	maxHealth: number;
	damageTaken: number;
}

export type Phase =
	| 'play'        // player chooses card(s) to play (or yields)
	| 'damage'      // royal counter-attacks; player must discard to cover
	| 'won'
	| 'lost';

export interface RoyalDefeat {
	royalId: string;
	exact: boolean;
}

export interface LogEntry {
	turn: number;
	kind:
		| 'play'
		| 'jester'
		| 'heal'
		| 'draw'
		| 'shield'
		| 'double'
		| 'damage'
		| 'defeat'
		| 'newRoyal'
		| 'win'
		| 'lose'
		| 'discard';
	text: string;
}

export interface GameConfig {
	jesters: 0 | 1 | 2;
	handSize: number; // 8 for solo
	seed?: number; // optional for determinism
	tutorial?: boolean; // when true, run guided callouts on the first few turns
}

export interface GameState {
	config: GameConfig;
	tavernDeck: Card[];        // face-down draw pile
	castleDeck: Royal[];       // top is currentEnemy when revealed
	currentEnemy: Royal | null;
	hand: Card[];
	discardPile: Card[];
	/** Cards played in the current battle that haven't been moved to discard yet (kept face-up beside enemy). */
	playedThisBattle: Card[];
	/** Total shield value accumulated against the current enemy from played spades. Resets when a new royal appears. */
	shield: number;
	/** Whether a Jester has cancelled the current royal's immunity. Resets when a new royal appears.
	 *  In solo this is unused — the solo Jester ability does NOT cancel immunity. Kept on the state
	 *  shape so multiplayer (where deck Jesters return) can drop in without further migration. */
	immunityCancelled: boolean;
	/** Solo Jester ability charges remaining. Each is a one-shot "discard hand, refill to handSize"
	 *  usable at the start of Step 1 or Step 4. Starts at config.jesters. */
	jestersRemaining: number;
	phase: Phase;
	turn: number;
	/** Wall-clock timestamp (ms since epoch) when the game began. Used for the match timer
	 *  and history records. Persists in the save so reloading mid-game keeps real elapsed time. */
	startedAt: number;
	/** Set when the game transitions to 'won' or 'lost' so elapsed time freezes at completion. */
	endedAt: number | null;
	log: LogEntry[];
	/** Counters for the guidance layer: how many times the user has seen each rule fire. Persisted across games. */
	seenRules: Record<string, number>;
}
