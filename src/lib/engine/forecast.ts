import { checkCombo, type ComboCheck } from './combo';
import type { Card, GameState, Suit } from './types';

export interface ForecastPower {
	suit: Suit;
	value: number;
	suppressed: boolean;
	/** Human-readable summary of what happens, e.g. "draws 5", "heals 3 (3 available)". */
	summary: string;
}

export interface Forecast {
	combo: ComboCheck;
	/** Raw combo total (before doubling). */
	rawDamage: number;
	/** Damage that will be dealt after club doubling. */
	damage: number;
	powers: ForecastPower[];
	/** New enemy HP after the play, clamped to 0. */
	enemyHpAfter: number;
	/** Defeat info if this play would kill the royal. */
	defeated: { exact: boolean } | null;
	/** Spade shield total after this play (the new effective shield for the battle). */
	newShield: number;
	/** Effective enemy ATK that the player will face *after* this play. */
	newEnemyAtk: number;
	/** Hand size after removing played cards and applying ♦ draws. */
	newHandSize: number;
	/** Discard size after ♥ heals (cards removed) and any played cards moving (when defeating). */
	newDiscardSize: number;
	/** Tavern deck size after hearts heal (cards added) and diamond draws (cards removed). */
	newTavernSize: number;
}

const POWER_ORDER: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

/** Compute a pure projection of what would happen if `cardIds` were played from the current state.
 *  Returns null if the selection is empty. Returns a forecast with `combo.ok = false` for illegal selections.
 *
 *  This function is deterministic and does not consume RNG state — heart heals are previewed as
 *  count-only (we don't pick specific cards), and diamond draws are bounded by tavern size.
 */
export function forecast(state: GameState, cardIds: string[]): Forecast | null {
	if (cardIds.length === 0) return null;
	if (!state.currentEnemy) return null;

	const handById = new Map(state.hand.map((c) => [c.id, c]));
	const cards: Card[] = [];
	for (const id of cardIds) {
		const c = handById.get(id);
		if (!c) return null;
		cards.push(c);
	}

	const combo = checkCombo(cards);
	if (!combo.ok) {
		return {
			combo,
			rawDamage: 0,
			damage: 0,
			powers: [],
			enemyHpAfter: state.currentEnemy.maxHealth - state.currentEnemy.damageTaken,
			defeated: null,
			newShield: state.shield,
			newEnemyAtk: Math.max(0, state.currentEnemy.attack - state.shield),
			newHandSize: state.hand.length,
			newDiscardSize: state.discardPile.length,
			newTavernSize: state.tavernDeck.length
		};
	}

	const enemy = state.currentEnemy;

	// Jester preview.
	if (combo.kind === 'jester') {
		// No damage, no powers. Cancels immunity (effect lasts until battle ends — surfaced separately in UI).
		const handSize = state.hand.length - 1; // minus the played jester
		return {
			combo,
			rawDamage: 0,
			damage: 0,
			powers: [],
			enemyHpAfter: enemy.maxHealth - enemy.damageTaken,
			defeated: null,
			newShield: state.shield,
			newEnemyAtk: Math.max(0, enemy.attack - state.shield),
			newHandSize: handSize,
			newDiscardSize: state.discardPile.length,
			newTavernSize: state.tavernDeck.length
		};
	}

	const total = combo.totalValue;
	const suitsPlayed = new Set(cards.map((c) => c.suit).filter((x): x is Suit => !!x));
	const immunityActive = enemy.suit && !state.immunityCancelled;

	// Project each power.
	const powers: ForecastPower[] = [];

	let projDiscard = state.discardPile.length;
	let projTavern = state.tavernDeck.length;
	let projHand = state.hand.length - cards.length;
	const handLimit = state.config.handSize;

	let clubFires = false;

	for (const suit of POWER_ORDER) {
		if (!suitsPlayed.has(suit)) continue;
		const suppressed = immunityActive ? enemy.suit === suit : false;

		if (suit === 'hearts') {
			const heal = suppressed ? 0 : Math.min(total, projDiscard);
			powers.push({
				suit: 'hearts',
				value: total,
				suppressed,
				summary: suppressed
					? `♥ heal suppressed (immunity)`
					: heal === 0
						? `♥ no cards in discard to heal`
						: heal < total
							? `♥ heal ${heal} (only ${heal} in discard)`
							: `♥ heal ${heal}`
			});
			if (!suppressed) {
				projDiscard -= heal;
				projTavern += heal;
			}
		} else if (suit === 'diamonds') {
			const wantDraw = suppressed ? 0 : total;
			const canDraw = Math.min(wantDraw, handLimit - projHand, projTavern);
			powers.push({
				suit: 'diamonds',
				value: total,
				suppressed,
				summary: suppressed
					? `♦ draw suppressed (immunity)`
					: canDraw === 0
						? `♦ no draw (hand full or deck empty)`
						: canDraw < total
							? `♦ draw ${canDraw} (hand caps at ${handLimit})`
							: `♦ draw ${canDraw}`
			});
			if (!suppressed) {
				projHand += canDraw;
				projTavern -= canDraw;
			}
		} else if (suit === 'clubs') {
			clubFires = !suppressed;
			powers.push({
				suit: 'clubs',
				value: total,
				suppressed,
				summary: suppressed ? `♣ double suppressed (immunity)` : `♣ damage ×2`
			});
		} else {
			// spades
			powers.push({
				suit: 'spades',
				value: total,
				suppressed,
				summary: suppressed ? `♠ shield suppressed (immunity)` : `♠ shield +${total}`
			});
		}
	}

	const damage = clubFires ? total * 2 : total;
	const remainingHp = enemy.maxHealth - enemy.damageTaken;
	const enemyHpAfter = Math.max(0, remainingHp - damage);
	const defeated = damage >= remainingHp ? { exact: damage === remainingHp } : null;

	// Shield comes from the spade power, which fires at the combo total — not the sum of
	// the spades' individual values. So Ace♠ + 7♣ contributes the combo total (8), not 1.
	const spadeInCombo = cards.some((c) => c.suit === 'spades');
	const spadeImmune = immunityActive && enemy.suit === 'spades';
	const shieldFromThisPlay = spadeInCombo && !spadeImmune ? total : 0;
	const newShield = state.shield + shieldFromThisPlay;
	// If this play defeats the royal, the next royal appears with full ATK and 0 shield.
	const newEnemyAtk = defeated ? 0 : Math.max(0, enemy.attack - newShield);

	return {
		combo,
		rawDamage: total,
		damage,
		powers,
		enemyHpAfter,
		defeated,
		newShield,
		newEnemyAtk,
		newHandSize: projHand,
		newDiscardSize: projDiscard,
		newTavernSize: projTavern
	};
}

