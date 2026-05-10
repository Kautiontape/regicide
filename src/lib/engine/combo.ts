import type { Card } from './types';

export type ComboKind = 'single' | 'jester' | 'companion' | 'sameRank';

export type ComboCheck =
	| { ok: true; kind: ComboKind; totalValue: number }
	| { ok: false; reason: string };

/** Validate a set of cards as a single legal play.
 *
 * Legal plays:
 *  - One Jester (alone).
 *  - One non-Jester card (any).
 *  - Animal Companion: one Ace + one non-Ace, non-Jester card.
 *  - Animal Companion: two Aces (same-rank combo, sum=2 ≤ 10).
 *  - Same-rank combo: 2+ cards of the same rank, total value ≤ 10. Aces only count if paired with another Ace.
 */
export function checkCombo(cards: Card[]): ComboCheck {
	if (cards.length === 0) return { ok: false, reason: 'No cards selected.' };

	const hasJester = cards.some((c) => c.rank === 'JESTER');
	if (hasJester) {
		if (cards.length === 1) return { ok: true, kind: 'jester', totalValue: 0 };
		return { ok: false, reason: 'A Jester must be played alone.' };
	}

	if (cards.length === 1) {
		return { ok: true, kind: 'single', totalValue: cards[0].value };
	}

	const aces = cards.filter((c) => c.rank === 'A');
	const others = cards.filter((c) => c.rank !== 'A');

	// Animal Companion: exactly one Ace + exactly one other card.
	if (cards.length === 2 && aces.length === 1 && others.length === 1) {
		return { ok: true, kind: 'companion', totalValue: 1 + others[0].value };
	}

	// Same-rank combo (including all-Aces): every card must share the same rank.
	const ranks = new Set(cards.map((c) => c.rank));
	if (ranks.size === 1) {
		const total = cards.reduce((s, c) => s + c.value, 0);
		if (total > 10)
			return { ok: false, reason: `Same-rank combo total ${total} exceeds 10.` };
		return { ok: true, kind: 'sameRank', totalValue: total };
	}

	return {
		ok: false,
		reason: 'Pick one card, an Ace + one other (Animal Companion), or same-rank cards summing ≤ 10.'
	};
}
