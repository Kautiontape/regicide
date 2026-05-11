/* ────────────────────────────────────────────────────────────────────────────
 * MULTIPLAYER STASH — NOT WIRED UP
 *
 * Solo-only Regicide is the only mode currently shipped. The official rulebook
 * has a handful of mechanics that only make sense with 2-4 players, and a few
 * solo-vs-multiplayer divergences. This module preserves the multiplayer logic
 * so it can be lifted back into the engine when multiplayer lands instead of
 * being reconstructed from the rulebook.
 *
 * Nothing here is exported from src/lib/engine/index.ts on purpose.
 * ──────────────────────────────────────────────────────────────────────────── */

import type { Card, GameState, Suit } from './types';

/* ── 1. Deck-Jesters in the tavern ──────────────────────────────────────────
 *
 * In multiplayer (3p/4p), 1 or 2 Jester cards are shuffled into the tavern deck
 * and dealt to hands like any other card. They function as in-hand cards with:
 *   - attack value 0
 *   - "play alone" combo restriction
 *   - effect: cancel the current enemy's immunity for the rest of the battle
 *   - additionally: the playing player chooses who goes next (turn-passing)
 *
 * The solo "Jester" is a completely different mechanic (one-shot discard-and-refill,
 * lives off to the side of the screen). To restore deck-Jesters for multiplayer:
 *   1. Re-add 'JESTER' card creation in deck.ts → buildTavernDeck (with a `jesters` arg).
 *   2. Re-add the JESTER branch in combo.ts → checkCombo.
 *   3. Re-add the jester branch in game.ts → play() (see playJester below).
 *   4. Add a 'chooseNextPlayer' phase or callback to GameState for the turn-passing rule.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Multiplayer Jester combo check (extracted from the previous solo implementation). */
export function checkComboJester(cards: Card[]): { ok: true; kind: 'jester'; totalValue: 0 } | { ok: false; reason: string } | null {
	const hasJester = cards.some((c) => c.rank === 'JESTER');
	if (!hasJester) return null;
	if (cards.length === 1) return { ok: true, kind: 'jester', totalValue: 0 };
	return { ok: false, reason: 'A Jester must be played alone.' };
}

/** Multiplayer play() handler for an in-hand Jester. Transitions to a state where the
 *  player chooses who goes next (multiplayer-only turn-passing). */
export function playJesterMultiplayer(state: GameState, played: Card[]): GameState {
	return {
		...state,
		playedThisBattle: [...state.playedThisBattle, ...played],
		immunityCancelled: true,
		// NOTE: a 'chooseNextPlayer' phase would go here for multiplayer turn-passing.
		// In solo this entire branch is unreachable because Jesters are never in hand.
		phase: 'damage',
		log: [...state.log, { turn: state.turn, kind: 'jester' as const, text: 'Jester played: immunity cancelled.' }]
	};
}

/* ── 2. Retroactive ♠ shield activation when a Jester cancels immunity ───────
 *
 * Per rulebook: "If the Jester is played against a spades enemy, spades played
 * prior to the Jester will begin reducing the attack value of the enemy."
 *
 * Implementing this correctly requires tracking each suppressed shield contribution
 * in `playedThisBattle` so that, when immunity is cancelled mid-battle against a
 * ♠ royal, those suppressed shields can retroactively activate. Clubs is explicitly
 * NOT retroactive ("clubs played prior to the Jester against a clubs enemy will not
 * count for double"), so this only applies to ♠.
 *
 * Helper below recomputes the shield total assuming a Jester just cancelled immunity. */
export function recomputeShieldAfterJesterCancel(state: GameState): number {
	const enemy = state.currentEnemy;
	if (!enemy) return state.shield;
	if (enemy.suit !== 'spades') return state.shield; // only ♠ enemies trigger retroactive shield

	// Walk playedThisBattle and add the combo total for every ♠-containing play.
	// NOTE: this is an approximation — we don't track which play was which combo, so we treat
	// each played ♠ card's value as its individual contribution. To do this precisely we'd
	// need to record combo groupings on `playedThisBattle`. Revisit when wiring up.
	let extra = 0;
	for (const c of state.playedThisBattle) {
		if (c.suit === 'spades') extra += c.value;
	}
	return state.shield + extra;
}

/* ── 3. Multiplayer-only rule strings ───────────────────────────────────────
 *
 * Yielding is allowed in multiplayer (with the "not if every OTHER player yielded
 * last turn" restriction). It's effectively impossible in solo (vacuously every
 * other player has yielded since there are none), so the rule entry was dropped
 * from the solo rules table. Restore the entry here when adding multiplayer. */
export const MULTIPLAYER_RULE_TEXT = {
	yieldRule: {
		short: 'yield',
		long: 'Yield: skip your attack and take the counter-attack instead. You cannot yield if every other player yielded on their last turn.'
	},
	jesterForcedPlay: {
		// Was a solo-only invention ("enemy picks a random card from your hand after a Jester").
		// Not in the rulebook. Kept here only as a reminder that it should NOT come back.
		short: 'forced play',
		long: '[non-canonical] Old solo mechanic — do not reintroduce. The official Jester rule passes turn choice to the playing player (multiplayer) or is unrelated (solo Jester ability).'
	}
} as const;

/* ── 4. Suit power resolution order constant ────────────────────────────────
 *
 * Hearts → Diamonds → Clubs → Spades. The rules mandate Hearts-before-Diamonds
 * explicitly: "Any time where both a Hearts power and Diamonds power are resolved
 * together, resolve the Hearts healing before drawing with Diamonds." Clubs/Spades
 * fire later than the red suits by definition (they affect Steps 3 and 4). */
export const POWER_ORDER_REFERENCE: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
