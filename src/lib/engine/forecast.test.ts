import { describe, expect, it } from 'vitest';
import { newGame, play } from './game';
import { forecast } from './forecast';
import type { Card, GameState } from './types';

function rig(overrides: Partial<GameState>): GameState {
	const base = newGame({ jesters: 0, handSize: 8 }, 1);
	return { ...base, ...overrides } as GameState;
}

describe('forecast', () => {
	it('returns null when nothing selected', () => {
		const s = newGame({ jesters: 0, handSize: 8 }, 1);
		expect(forecast(s, [])).toBeNull();
	});

	it('matches play() damage for a single card', () => {
		const s0 = newGame({ jesters: 0, handSize: 8 }, 7);
		const enemy = { ...s0.currentEnemy!, suit: 'hearts' as const };
		const c: Card = { id: '5C', suit: 'clubs', rank: '5', value: 5 };
		const s = rig({ ...s0, currentEnemy: enemy, hand: [c, ...s0.hand.slice(1)] });
		const f = forecast(s, ['5C'])!;
		expect(f.damage).toBe(10); // club doubles
		const r = play(s, ['5C']);
		expect(r.damageDealt).toBe(f.damage);
	});

	it('previews shield against next attack', () => {
		const s0 = newGame({ jesters: 0, handSize: 8 }, 7);
		const enemy = { ...s0.currentEnemy!, suit: 'hearts' as const, maxHealth: 100 };
		const sp: Card = { id: '5S', suit: 'spades', rank: '5', value: 5 };
		const s = rig({ ...s0, currentEnemy: enemy, hand: [sp, ...s0.hand.slice(1)] });
		const f = forecast(s, ['5S'])!;
		expect(f.newShield).toBe(5);
		expect(f.newEnemyAtk).toBe(5); // Jack 10 ATK − 5 shield
	});

	it('previews exact-kill flag', () => {
		const s0 = newGame({ jesters: 0, handSize: 8 }, 7);
		const enemy = { ...s0.currentEnemy!, suit: 'clubs' as const, maxHealth: 10 };
		const c: Card = { id: 'TC', suit: 'clubs', rank: '10', value: 10 };
		const s = rig({ ...s0, currentEnemy: enemy, hand: [c, ...s0.hand.slice(1)] });
		const f = forecast(s, ['TC'])!;
		expect(f.defeated).toMatchObject({ exact: true });
		expect(f.enemyHpAfter).toBe(0);
	});

	it('previews diamond draw bounded by hand limit and tavern size', () => {
		const s0 = newGame({ jesters: 0, handSize: 8 }, 7);
		const enemy = { ...s0.currentEnemy!, suit: 'hearts' as const };
		const d: Card = { id: '5D', suit: 'diamonds', rank: '5', value: 5 };
		const s = rig({
			...s0,
			currentEnemy: enemy,
			hand: [d, ...s0.hand.slice(1, 4)] // 4-card hand including the diamond
		});
		const f = forecast(s, ['5D'])!;
		// hand 4 → 3 after play → can draw up to 5 → limit 8 means 5 → bounded by tavern
		expect(f.newHandSize).toBeGreaterThanOrEqual(4);
		expect(f.newHandSize).toBeLessThanOrEqual(8);
	});

	it('marks suppressed powers when royal is immune', () => {
		const s0 = newGame({ jesters: 0, handSize: 8 }, 7);
		const enemy = { ...s0.currentEnemy!, suit: 'spades' as const };
		const sp: Card = { id: '5S', suit: 'spades', rank: '5', value: 5 };
		const s = rig({ ...s0, currentEnemy: enemy, hand: [sp, ...s0.hand.slice(1)] });
		const f = forecast(s, ['5S'])!;
		expect(f.powers[0].suppressed).toBe(true);
		expect(f.newShield).toBe(0); // suppressed shield does not stack
	});
});
