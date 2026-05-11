import type { Card } from './types';

export type ComboKind = 'single' | 'companion' | 'sameRank';

export type ComboCheck =
	| { ok: true; kind: ComboKind; totalValue: number }
	| { ok: false; reason: string };

/** Validate a set of cards as a single legal play.
 *
 * Legal plays (per official rules):
 *  - One non-Jester card (any rank).
 *  - Animal Companion: one Ace + one other non-Ace card (counts as 1 + other).
 *  - Animal Companion: two Aces (rules: "an Animal Companion can be paired with one other Animal Companion").
 *  - Same-rank combo: 2, 3, or 4 cards of the same number (2-10), total ≤ 10.
 *
 * Aces (Animal Companions) cannot appear in same-rank combos of 3 or more — they can ONLY be
 * paired with one other card (which may itself be an Ace). Jesters are never in the hand in solo. */
export function checkCombo(cards: Card[]): ComboCheck {
	if (cards.length === 0) return { ok: false, reason: 'No cards selected.' };

	if (cards.length === 1) {
		return { ok: true, kind: 'single', totalValue: cards[0].value };
	}

	const aces = cards.filter((c) => c.rank === 'A');
	const others = cards.filter((c) => c.rank !== 'A');

	// Animal Companion: exactly one Ace + exactly one other card.
	if (cards.length === 2 && aces.length === 1 && others.length === 1) {
		return { ok: true, kind: 'companion', totalValue: 1 + others[0].value };
	}

	// Animal Companion + Animal Companion: exactly two Aces.
	if (cards.length === 2 && aces.length === 2) {
		return { ok: true, kind: 'companion', totalValue: 2 };
	}

	// Aces can only appear in the two cases above. 3+ Aces, or an Ace mixed into a same-rank
	// combo (impossible by ranks alone, but guard anyway), is illegal.
	if (aces.length > 0) {
		return { ok: false, reason: 'Animal Companions can only be paired with one other card.' };
	}

	// Same-rank combo: 2-4 cards of the same number, total ≤ 10.
	const ranks = new Set(cards.map((c) => c.rank));
	if (ranks.size === 1) {
		if (cards.length > 4) {
			return { ok: false, reason: 'Same-rank combo can be at most 4 cards.' };
		}
		const total = cards.reduce((s, c) => s + c.value, 0);
		if (total > 10) {
			return { ok: false, reason: `Same-rank combo total ${total} exceeds 10.` };
		}
		return { ok: true, kind: 'sameRank', totalValue: total };
	}

	return {
		ok: false,
		reason: 'Pick one card, an Ace + one other (Animal Companion), or same-rank cards summing ≤ 10.'
	};
}
