import { describe, expect, it } from 'vitest';
import { buildTavernDeck } from './deck';
import { checkCombo } from './combo';
import { newGame, play, takeDamage, damageCheck, sel, canPayDamage, suggestDiscards } from './game';
import type { Card, GameState } from './types';

function jack(state: GameState) {
	expect(state.currentEnemy?.rank).toBe('J');
}

function findInHand(state: GameState, predicate: (c: Card) => boolean): Card {
	const c = state.hand.find(predicate);
	if (!c) throw new Error('Card not found');
	return c;
}

describe('deck', () => {
	it('builds 52 cards + jester count', () => {
		expect(buildTavernDeck(0)).toHaveLength(40); // A-10 only
		expect(buildTavernDeck(2)).toHaveLength(42);
	});
});

describe('combo validation', () => {
	const c = (id: string, suit: Card['suit'], rank: Card['rank'], value: number): Card => ({
		id, suit, rank, value
	});
	it('rejects empty', () => {
		expect(checkCombo([])).toMatchObject({ ok: false });
	});
	it('accepts single jester', () => {
		expect(checkCombo([c('J1', null, 'JESTER', 0)])).toMatchObject({ ok: true, kind: 'jester' });
	});
	it('rejects jester combo', () => {
		expect(checkCombo([c('J1', null, 'JESTER', 0), c('5H', 'hearts', '5', 5)])).toMatchObject({ ok: false });
	});
	it('accepts animal companion', () => {
		expect(checkCombo([c('AS', 'spades', 'A', 1), c('5H', 'hearts', '5', 5)]))
			.toMatchObject({ ok: true, kind: 'companion', totalValue: 6 });
	});
	it('accepts same-rank combo summing to 10', () => {
		expect(checkCombo([c('5H', 'hearts', '5', 5), c('5C', 'clubs', '5', 5)]))
			.toMatchObject({ ok: true, kind: 'sameRank', totalValue: 10 });
	});
	it('rejects same-rank combo over 10', () => {
		expect(checkCombo([c('6H', 'hearts', '6', 6), c('6C', 'clubs', '6', 6)]))
			.toMatchObject({ ok: false });
	});
	it('rejects mixed-rank non-companion', () => {
		expect(checkCombo([c('5H', 'hearts', '5', 5), c('4C', 'clubs', '4', 4)]))
			.toMatchObject({ ok: false });
	});
});

describe('new game', () => {
	it('starts with 8-card hand vs Jack of some suit, 11 royals remain', () => {
		const s = newGame({ jesters: 0, handSize: 8 }, 1);
		expect(s.hand).toHaveLength(8);
		jack(s);
		expect(s.castleDeck).toHaveLength(11);
		expect(s.phase).toBe('play');
	});
});

describe('play resolution', () => {
	it('deals damage equal to card value', () => {
		const s = newGame({ jesters: 0, handSize: 8 }, 42);
		const card = s.hand[0];
		const r = play(s, [card.id]);
		expect(r.damageDealt).toBe(card.value);
	});

	it('clubs double damage when not immune', () => {
		// Build a state by hand-injecting a club card vs a non-club enemy.
		const s0 = newGame({ jesters: 0, handSize: 8 }, 1);
		const enemy = { ...s0.currentEnemy!, suit: 'hearts' as const };
		const club: Card = { id: '5C', suit: 'clubs', rank: '5', value: 5 };
		const s: GameState = { ...s0, currentEnemy: enemy, hand: [club, ...s0.hand.slice(1)] };
		const r = play(s, ['5C']);
		expect(r.damageDealt).toBe(10);
	});

	it('club power suppressed by club-suit royal', () => {
		const s0 = newGame({ jesters: 0, handSize: 8 }, 1);
		const enemy = { ...s0.currentEnemy!, suit: 'clubs' as const };
		const club: Card = { id: '5C', suit: 'clubs', rank: '5', value: 5 };
		const s: GameState = { ...s0, currentEnemy: enemy, hand: [club, ...s0.hand.slice(1)] };
		const r = play(s, ['5C']);
		expect(r.damageDealt).toBe(5);
		expect(r.activations[0]).toMatchObject({ suit: 'clubs', suppressed: true });
	});

	it('spades shield reduces effective enemy attack', () => {
		const s0 = newGame({ jesters: 0, handSize: 8 }, 1);
		const enemy = { ...s0.currentEnemy!, suit: 'hearts' as const };
		const spade: Card = { id: '5S', suit: 'spades', rank: '5', value: 5 };
		const s: GameState = { ...s0, currentEnemy: enemy, hand: [spade, ...s0.hand.slice(1)] };
		const r = play(s, ['5S']);
		// Jack attack=10. After 5 shield, effective attack = 5.
		expect(sel.effectiveAttack(r.state)).toBe(5);
	});

	it('diamonds draw refills hand toward limit', () => {
		const s0 = newGame({ jesters: 0, handSize: 8 }, 1);
		const enemy = { ...s0.currentEnemy!, suit: 'hearts' as const };
		const diamond: Card = { id: '5D', suit: 'diamonds', rank: '5', value: 5 };
		const s: GameState = { ...s0, currentEnemy: enemy, hand: [diamond, ...s0.hand.slice(1, 4)] }; // 4 cards
		const r = play(s, ['5D']);
		// hand=4 with diamond removed=3, draw 5 → bounded by limit 8 → at most 5, capped to (8-3)=5
		expect(r.state.hand.length).toBe(8);
	});

	it('hearts heal moves discard back into tavern', () => {
		const s0 = newGame({ jesters: 0, handSize: 8 }, 1);
		const enemy = { ...s0.currentEnemy!, suit: 'spades' as const };
		const heart: Card = { id: '5H', suit: 'hearts', rank: '5', value: 5 };
		const dummy: Card[] = [
			{ id: '2D', suit: 'diamonds', rank: '2', value: 2 },
			{ id: '3D', suit: 'diamonds', rank: '3', value: 3 }
		];
		const s: GameState = {
			...s0, currentEnemy: enemy,
			hand: [heart, ...s0.hand.slice(1)],
			discardPile: dummy
		};
		const initialTavern = s.tavernDeck.length;
		const r = play(s, ['5H']);
		expect(r.state.discardPile).toHaveLength(0);
		expect(r.state.tavernDeck.length).toBe(initialTavern + 2);
	});
});

describe('combo total drives suit power values', () => {
	it('5C + 5D combo deals 5+5 doubled = 20 and draws 10', () => {
		const s0 = newGame({ jesters: 0, handSize: 8 }, 1);
		const enemy = { ...s0.currentEnemy!, suit: 'hearts' as const, maxHealth: 100 };
		const club: Card = { id: '5C', suit: 'clubs', rank: '5', value: 5 };
		const dia: Card = { id: '5D', suit: 'diamonds', rank: '5', value: 5 };
		const s: GameState = { ...s0, currentEnemy: enemy, hand: [club, dia, ...s0.hand.slice(2, 4)] }; // 4 in hand
		const r = play(s, ['5C', '5D']);
		expect(r.damageDealt).toBe(20);
		// hand was 4, played 2 → 2 left, draw 10 capped to limit 8, bounded by available tavern
		expect(r.state.hand.length).toBeLessThanOrEqual(8);
		expect(r.state.hand.length).toBeGreaterThan(2);
	});
});

describe('damage phase', () => {
	it('discarding cards summing ≥ attack ends turn', () => {
		const s0 = newGame({ jesters: 0, handSize: 8 }, 7);
		// Force an enemy not immune to whatever we play; pick a low card to NOT defeat
		const enemy = { ...s0.currentEnemy!, suit: 'hearts' as const, maxHealth: 100 };
		const lowCard: Card = { id: '2D', suit: 'diamonds', rank: '2', value: 2 };
		const big1: Card = { id: '7C', suit: 'clubs', rank: '7', value: 7 };
		const big2: Card = { id: '8C', suit: 'clubs', rank: '8', value: 8 };
		const s: GameState = { ...s0, currentEnemy: enemy, hand: [lowCard, big1, big2, ...s0.hand.slice(3, 6)] };
		const r = play(s, ['2D']);
		expect(r.state.phase).toBe('damage');
		// Jack ATK=10, no shield. Discard 7+8=15 ≥ 10.
		const after = takeDamage(r.state, ['7C', '8C']);
		expect(after.phase).toBe('play');
		expect(after.discardPile.find((c) => c.id === '7C')).toBeTruthy();
	});

	it('lose when total hand value < attack', () => {
		const s0 = newGame({ jesters: 0, handSize: 8 }, 7);
		const enemy = { ...s0.currentEnemy!, suit: 'hearts' as const, maxHealth: 100 };
		const tiny: Card[] = [
			{ id: '2D', suit: 'diamonds', rank: '2', value: 2 },
			{ id: '3C', suit: 'clubs', rank: '3', value: 3 } // total 5 vs ATK 10
		];
		const s: GameState = { ...s0, currentEnemy: enemy, hand: [...tiny, tiny[0]].slice(0, 2) };
		// Need to also play first — substitute hand for play and test damage check directly
		const damaged: GameState = { ...s, phase: 'damage' };
		const checked = damageCheck(damaged);
		expect(checked.phase).toBe('lost');
		expect(canPayDamage(damaged)).toBe(false);
	});
});

describe('defeat outcomes', () => {
	it('exact kill places royal on top of tavern', () => {
		const s0 = newGame({ jesters: 0, handSize: 8 }, 1);
		// Enemy is club-suit, so the club's double power is suppressed → damage = 10 vs HP 10 = exact.
		const enemy = { ...s0.currentEnemy!, suit: 'clubs' as const, maxHealth: 10, attack: 0 } as typeof s0.currentEnemy;
		const ten: Card = { id: 'TC', suit: 'clubs', rank: '10', value: 10 };
		const s: GameState = { ...s0, currentEnemy: enemy as GameState['currentEnemy'], hand: [ten, ...s0.hand.slice(1)] };
		const r = play(s, ['TC']);
		expect(r.defeated).toMatchObject({ exact: true });
		const top = r.state.tavernDeck[r.state.tavernDeck.length - 1];
		expect(top.rank).toBe('J');
	});

	it('overkill places royal in discard', () => {
		const s0 = newGame({ jesters: 0, handSize: 8 }, 1);
		const enemy = { ...s0.currentEnemy!, suit: 'clubs' as const, maxHealth: 5, attack: 0 } as typeof s0.currentEnemy;
		const ten: Card = { id: 'TC', suit: 'clubs', rank: '10', value: 10 };
		const s: GameState = { ...s0, currentEnemy: enemy as GameState['currentEnemy'], hand: [ten, ...s0.hand.slice(1)] };
		const r = play(s, ['TC']);
		expect(r.defeated).toMatchObject({ exact: false });
		expect(r.state.discardPile.some((c) => c.rank === 'J')).toBe(true);
	});
});

describe('suggestDiscards (min-waste)', () => {
	it('finds the subset with smallest sum ≥ owed', () => {
		const s0 = newGame({ jesters: 0, handSize: 8 }, 1);
		const enemy = { ...s0.currentEnemy!, attack: 10 } as typeof s0.currentEnemy;
		const hand: Card[] = [
			{ id: '4H', suit: 'hearts', rank: '4', value: 4 },
			{ id: '9H', suit: 'hearts', rank: '9', value: 9 },
			{ id: '2D', suit: 'diamonds', rank: '2', value: 2 },
			{ id: '8D', suit: 'diamonds', rank: '8', value: 8 }
		];
		const s: GameState = { ...s0, currentEnemy: enemy as GameState['currentEnemy'], hand, phase: 'damage' };
		const picked = suggestDiscards(s);
		const sum = hand.filter((c) => picked.includes(c.id)).reduce((x, c) => x + c.value, 0);
		// 8+2 = 10 is the exact (waste 0) cover; should beat 9+2=11, 9+8=17, etc.
		expect(sum).toBe(10);
		expect(picked.sort()).toEqual(['2D', '8D']);
	});

	it('prefers fewer cards on tie', () => {
		const s0 = newGame({ jesters: 0, handSize: 8 }, 1);
		const enemy = { ...s0.currentEnemy!, attack: 10 } as typeof s0.currentEnemy;
		const hand: Card[] = [
			{ id: 'TH', suit: 'hearts', rank: '10', value: 10 },
			{ id: '5D', suit: 'diamonds', rank: '5', value: 5 },
			{ id: '5C', suit: 'clubs', rank: '5', value: 5 }
		];
		const s: GameState = { ...s0, currentEnemy: enemy as GameState['currentEnemy'], hand, phase: 'damage' };
		const picked = suggestDiscards(s);
		// 10 alone (1 card, sum 10) is preferred over 5+5 (2 cards, sum 10).
		expect(picked).toEqual(['TH']);
	});
});

describe('jester', () => {
	it('cancels immunity and sets forced-play flag', () => {
		const s0 = newGame({ jesters: 1, handSize: 8 }, 99);
		// Find or inject a jester
		const jest: Card = { id: 'JEST1', suit: null, rank: 'JESTER', value: 0 };
		const s: GameState = { ...s0, hand: [jest, ...s0.hand.slice(1)] };
		const r = play(s, ['JEST1']);
		expect(r.state.immunityCancelled).toBe(true);
		expect(r.state.jesterEnemyChooses).toBe(true);
		expect(r.damageDealt).toBe(0);
	});
});
