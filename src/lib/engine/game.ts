import type { Card, GameConfig, GameState, LogEntry, Royal, Suit } from './types';
import { buildCastleDeck, buildTavernDeck, rng, shuffleWith } from './deck';
import { checkCombo } from './combo';

const POWER_ORDER: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

export interface PowerActivation {
	suit: Suit;
	value: number;
	suppressed: boolean; // true when royal is immune and not cancelled
}

export interface ResolveResult {
	state: GameState;
	activations: PowerActivation[];
	damageDealt: number;
	defeated: { exact: boolean } | null;
}

/* ───────── helpers ───────── */

function appendLog(state: GameState, entry: Omit<LogEntry, 'turn'>): GameState {
	return { ...state, log: [...state.log, { turn: state.turn, ...entry }] };
}

function effectiveAttack(state: GameState): number {
	if (!state.currentEnemy) return 0;
	return Math.max(0, state.currentEnemy.attack - state.shield);
}

/* ───────── public surface ───────── */

export function newGame(config: GameConfig, seed = Date.now()): GameState {
	const rand = rng(seed);
	const shuffle = shuffleWith(rand);
	const tavern = shuffle(buildTavernDeck(config.jesters));
	const castle = buildCastleDeck(shuffle);

	const hand = tavern.splice(0, config.handSize);
	const enemy = castle.shift()!;

	const log: LogEntry[] = [
		{ turn: 1, kind: 'newRoyal', text: `${rankName(enemy.rank)} of ${enemy.suit} appears (HP ${enemy.maxHealth}, ATK ${enemy.attack}).` }
	];

	return {
		config: { ...config, seed },
		tavernDeck: tavern,
		castleDeck: castle,
		currentEnemy: enemy,
		hand,
		discardPile: [],
		playedThisBattle: [],
		shield: 0,
		immunityCancelled: false,
		jesterEnemyChooses: false,
		phase: 'play',
		turn: 1,
		log,
		seenRules: {}
	};
}

function rankName(r: 'J' | 'Q' | 'K'): string {
	return r === 'J' ? 'Jack' : r === 'Q' ? 'Queen' : 'King';
}

/** Validate that a play is currently legal for the engine state. */
export function checkPlay(state: GameState, cardIds: string[]): { ok: true } | { ok: false; reason: string } {
	if (state.phase !== 'play') return { ok: false, reason: 'Not in play phase.' };
	if (cardIds.length === 0) return { ok: false, reason: 'Pick a card to play.' };
	const cards = cardIds.map((id) => state.hand.find((c) => c.id === id));
	if (cards.some((c) => !c)) return { ok: false, reason: 'A selected card is not in hand.' };
	const combo = checkCombo(cards as Card[]);
	if (!combo.ok) return { ok: false, reason: combo.reason };
	return { ok: true };
}

/** Play card(s) from hand. Resolves powers, deals damage, advances phase. */
export function play(state: GameState, cardIds: string[]): ResolveResult {
	if (state.phase !== 'play') throw new Error('Not in play phase.');
	if (!state.currentEnemy) throw new Error('No enemy.');

	const handById = new Map(state.hand.map((c) => [c.id, c]));
	const played: Card[] = cardIds.map((id) => {
		const c = handById.get(id);
		if (!c) throw new Error(`Card not in hand: ${id}`);
		return c;
	});

	const combo = checkCombo(played);
	if (!combo.ok) throw new Error(combo.reason);

	let s: GameState = { ...state, hand: state.hand.filter((c) => !cardIds.includes(c.id)) };

	// Jester is special: 0 damage, cancel immunity, set forced-play flag.
	if (combo.kind === 'jester') {
		s = {
			...s,
			playedThisBattle: [...s.playedThisBattle, ...played],
			immunityCancelled: true,
			jesterEnemyChooses: true,
			phase: 'damage'
		};
		s = appendLog(s, { kind: 'jester', text: 'Jester played: immunity cancelled.' });
		return { state: s, activations: [], damageDealt: 0, defeated: null };
	}

	const total = combo.totalValue;
	const enemy = s.currentEnemy;
	if (!enemy) throw new Error('No enemy.');
	const suitsPlayed = new Set(played.map((c) => c.suit).filter((x): x is Suit => !!x));

	const activations: PowerActivation[] = [];
	for (const suit of POWER_ORDER) {
		if (!suitsPlayed.has(suit)) continue;
		const suppressed = enemy.suit === suit && !s.immunityCancelled;
		activations.push({ suit, value: total, suppressed });
		if (suppressed) continue;
		s = applyPower(s, suit, total);
	}

	// Compute damage AFTER powers (clubs may double; immunity to clubs would have already suppressed it).
	const clubActivated = activations.find((a) => a.suit === 'clubs' && !a.suppressed);
	let damage = total;
	if (clubActivated) damage *= 2;

	// Apply damage to enemy.
	const newEnemyDamage = enemy.damageTaken + damage;
	const remaining = enemy.maxHealth - newEnemyDamage;
	const updatedEnemy: Royal = { ...enemy, damageTaken: newEnemyDamage };

	s = {
		...s,
		currentEnemy: updatedEnemy,
		playedThisBattle: [...s.playedThisBattle, ...played]
	};
	s = appendLog(s, {
		kind: 'damage',
		text: `Dealt ${damage} damage. ${rankName(enemy.rank)} of ${enemy.suit}: ${Math.max(0, remaining)}/${enemy.maxHealth} HP.`
	});

	if (remaining <= 0) {
		const exact = remaining === 0;
		s = defeatRoyal(s, exact);
		// Defeating skips counter-attack. If still alive after advancing, return to play.
		return { state: s, activations, damageDealt: damage, defeated: { exact } };
	}

	// Enemy survives — move to damage phase.
	s = { ...s, phase: 'damage' };
	return { state: s, activations, damageDealt: damage, defeated: null };
}

function applyPower(state: GameState, suit: Suit, value: number): GameState {
	if (suit === 'hearts') {
		// Move up to `value` cards from top of discard back to bottom of tavern (shuffled).
		const take = Math.min(value, state.discardPile.length);
		if (take === 0) return state;
		const fromTop = state.discardPile.slice(-take);
		const remaining = state.discardPile.slice(0, state.discardPile.length - take);
		// Shuffle the moved cards using a fresh draw from the seed-derived rand. For simplicity and
		// determinism per state, derive a one-shot rng from current state size.
		const rand = rng(
			(state.config.seed ?? 1) +
				state.turn * 131 +
				state.discardPile.length * 17 +
				state.tavernDeck.length
		);
		const shuffled = shuffleWith(rand)(fromTop);
		return {
			...state,
			discardPile: remaining,
			tavernDeck: [...shuffled, ...state.tavernDeck], // bottom = front (we draw from end)
			log: [...state.log, { turn: state.turn, kind: 'heal', text: `♥ healed ${take} cards back into the deck.` }]
		};
	}
	if (suit === 'diamonds') {
		const limit = state.config.handSize;
		const canDraw = Math.min(value, limit - state.hand.length, state.tavernDeck.length);
		if (canDraw <= 0) return state;
		const drawn = state.tavernDeck.slice(-canDraw);
		const remaining = state.tavernDeck.slice(0, state.tavernDeck.length - canDraw);
		return {
			...state,
			tavernDeck: remaining,
			hand: [...state.hand, ...drawn],
			log: [...state.log, { turn: state.turn, kind: 'draw', text: `♦ drew ${canDraw}.` }]
		};
	}
	if (suit === 'clubs') {
		return {
			...state,
			log: [...state.log, { turn: state.turn, kind: 'double', text: `♣ damage doubled.` }]
		};
	}
	// spades — shield is the combo total (not just the spade card's individual value),
	// so Ace♠ + 7♣ correctly grants 8 shield rather than 1.
	return {
		...state,
		shield: state.shield + value,
		log: [...state.log, { turn: state.turn, kind: 'shield', text: `♠ +${value} shield this battle.` }]
	};
}

function defeatRoyal(state: GameState, exact: boolean): GameState {
	const enemy = state.currentEnemy;
	if (!enemy) throw new Error('No enemy to defeat.');
	// Played-this-battle cards go to discard.
	const newDiscard = [...state.discardPile, ...state.playedThisBattle];
	let s: GameState = {
		...state,
		discardPile: newDiscard,
		playedThisBattle: [],
		shield: 0,
		immunityCancelled: false,
		jesterEnemyChooses: state.jesterEnemyChooses // a defeat doesn't cancel forced play
	};
	const royalCard: Card = { id: enemy.id, suit: enemy.suit, rank: enemy.rank, value: enemy.value };
	if (exact) {
		// Place on TOP of tavern (next draw).
		s = { ...s, tavernDeck: [...s.tavernDeck, royalCard] };
		s = appendLog(s, { kind: 'defeat', text: `${rankName(enemy.rank)} of ${enemy.suit} defeated by exact damage — placed on top of the tavern deck.` });
	} else {
		s = { ...s, discardPile: [...s.discardPile, royalCard] };
		s = appendLog(s, { kind: 'defeat', text: `${rankName(enemy.rank)} of ${enemy.suit} defeated.` });
	}

	// Advance to next royal.
	if (s.castleDeck.length === 0) {
		return appendLog({ ...s, currentEnemy: null, phase: 'won' }, { kind: 'win', text: 'All royals defeated. You win!' });
	}
	const next = s.castleDeck[0];
	// Defeating a royal still ends the player's turn — draw back up to hand size before the
	// next royal so a defeating play doesn't soft-lock when the player emptied their hand.
	s = refillHand(s);
	s = {
		...s,
		castleDeck: s.castleDeck.slice(1),
		currentEnemy: next,
		phase: 'play',
		turn: s.turn + 1
	};
	return appendLog(s, {
		kind: 'newRoyal',
		text: `${rankName(next.rank)} of ${next.suit} appears (HP ${next.maxHealth}, ATK ${next.attack}).`
	});
}

/** During the damage phase, discard cards summing ≥ effectiveAttack(). */
export function takeDamage(state: GameState, discardIds: string[]): GameState {
	if (state.phase !== 'damage') throw new Error('Not in damage phase.');
	if (!state.currentEnemy) throw new Error('No enemy.');
	const dmg = effectiveAttack(state);

	if (dmg === 0) {
		// Free turn — no discard required, but allow empty.
		if (discardIds.length > 0) throw new Error('No damage to take; discard not allowed.');
		return endTurn(state);
	}

	const handById = new Map(state.hand.map((c) => [c.id, c]));
	const cards = discardIds.map((id) => {
		const c = handById.get(id);
		if (!c) throw new Error(`Card not in hand: ${id}`);
		return c;
	});
	const sum = cards.reduce((s, c) => s + c.value, 0);
	if (sum < dmg) throw new Error(`Discard sum ${sum} < damage ${dmg}.`);

	const newHand = state.hand.filter((c) => !discardIds.includes(c.id));
	let s: GameState = {
		...state,
		hand: newHand,
		discardPile: [...state.discardPile, ...cards]
	};
	s = appendLog(s, { kind: 'discard', text: `Discarded ${cards.length} card(s) for ${sum} to cover ${dmg} damage.` });
	return endTurn(s);
}

/** Confirm the player can or cannot pay the damage. */
export function canPayDamage(state: GameState): boolean {
	const dmg = effectiveAttack(state);
	const total = state.hand.reduce((s, c) => s + c.value, 0);
	return total >= dmg;
}

/** Smallest-waste discard set covering the damage.
 *
 * Brute-force enumerates subsets (hand ≤ 8 in solo → 256 candidates) to find the subset whose
 * total value is the smallest sum ≥ damage. Tie-breaks: prefer fewer cards (keep more in hand),
 * then prefer keeping higher-value cards (sum of remaining hand value highest).
 *
 * Returns the entire hand if no subset can cover the damage (the player has lost). */
export function suggestDiscards(state: GameState): string[] {
	const dmg = effectiveAttack(state);
	if (dmg <= 0) return [];
	const hand = state.hand;
	const n = hand.length;
	if (n === 0) return [];
	let best: { ids: string[]; sum: number; count: number } | null = null;
	const max = 1 << n;
	for (let mask = 1; mask < max; mask++) {
		let sum = 0;
		let count = 0;
		for (let i = 0; i < n; i++) {
			if (mask & (1 << i)) {
				sum += hand[i].value;
				count++;
			}
		}
		if (sum < dmg) continue;
		if (
			!best ||
			sum < best.sum ||
			(sum === best.sum && count < best.count)
		) {
			const ids: string[] = [];
			for (let i = 0; i < n; i++) {
				if (mask & (1 << i)) ids.push(hand[i].id);
			}
			best = { ids, sum, count };
		}
	}
	return best ? best.ids : hand.map((c) => c.id);
}

/** Draw from the tavern (top = end of array) up to the configured hand size. */
function refillHand(state: GameState): GameState {
	const limit = state.config.handSize;
	const need = Math.max(0, limit - state.hand.length);
	const draw = Math.min(need, state.tavernDeck.length);
	if (draw <= 0) return state;
	const drawn = state.tavernDeck.slice(-draw);
	const remaining = state.tavernDeck.slice(0, state.tavernDeck.length - draw);
	return {
		...state,
		tavernDeck: remaining,
		hand: [...state.hand, ...drawn],
		log: [...state.log, { turn: state.turn, kind: 'draw', text: `Drew ${draw} to refill.` }]
	};
}

function endTurn(state: GameState): GameState {
	// Standard Regicide: draw back up to hand size at end of turn. Without this, discarding
	// everything to cover damage soft-locks the next turn (no cards in hand to play).
	const refilled = refillHand(state);
	return { ...refilled, phase: 'play', turn: refilled.turn + 1 };
}

/** Force a check at the start of damage phase: if hand sum < attack, the game is lost. */
export function damageCheck(state: GameState): GameState {
	if (state.phase !== 'damage') return state;
	if (canPayDamage(state)) return state;
	const enemy = state.currentEnemy;
	if (!enemy) return state;
	const dmg = effectiveAttack(state);
	let s = appendLog(state, { kind: 'lose', text: `Cannot cover ${dmg} damage from ${rankName(enemy.rank)} of ${enemy.suit}.` });
	s = { ...s, phase: 'lost' };
	return s;
}

/** Pick a forced card (post-Jester in solo). Uses a deterministic-ish hash of state. */
export function pickForcedPlay(state: GameState): string | null {
	if (!state.jesterEnemyChooses || state.hand.length === 0) return null;
	const r = rng((state.config.seed ?? 1) + state.turn * 977 + state.hand.length);
	const idx = Math.floor(r() * state.hand.length);
	return state.hand[idx].id;
}

/** Clear the forced-play flag after the forced play resolves. */
export function clearForcedPlay(state: GameState): GameState {
	return { ...state, jesterEnemyChooses: false };
}

/** Public read helpers used by the UI. */
export const sel = {
	effectiveAttack,
	shield: (s: GameState) => s.shield,
	enemyImmuneTo: (s: GameState, suit: Suit) =>
		s.currentEnemy?.suit === suit && !s.immunityCancelled
};
