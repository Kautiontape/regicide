import { describe, expect, it } from 'vitest';
import { DAILY_EPOCH_KEY, dailyNumber, seedFor, todayKey } from './daily';

describe('todayKey', () => {
	it('formats local-time YYYY-MM-DD with zero-padded month/day', () => {
		const d = new Date(2026, 0, 5); // Jan 5
		expect(todayKey(d)).toBe('2026-01-05');
	});

	it('uses local components, not UTC ones', () => {
		// 2026-05-12 23:30 in a local zone could be 2026-05-13 in UTC; we want the local key.
		const d = new Date(2026, 4, 12, 23, 30);
		expect(todayKey(d)).toBe('2026-05-12');
	});
});

describe('dailyNumber', () => {
	it('treats the launch epoch as Daily #1', () => {
		expect(dailyNumber(DAILY_EPOCH_KEY)).toBe(1);
	});

	it('increments by one per calendar day', () => {
		expect(dailyNumber('2026-05-13')).toBe(2);
		expect(dailyNumber('2026-05-22')).toBe(11);
	});

	it('rolls correctly across month boundaries', () => {
		// epoch 2026-05-12 → 2026-06-12 = 31 days later → #32
		expect(dailyNumber('2026-06-12')).toBe(32);
	});
});

describe('seedFor', () => {
	it('is deterministic for the same date key', () => {
		expect(seedFor('2026-05-12')).toBe(seedFor('2026-05-12'));
	});

	it('returns distinct seeds for adjacent days (no near-collision)', () => {
		const a = seedFor('2026-05-12');
		const b = seedFor('2026-05-13');
		const c = seedFor('2026-05-14');
		expect(a).not.toBe(b);
		expect(b).not.toBe(c);
		expect(a).not.toBe(c);
	});

	it('returns a 32-bit unsigned integer', () => {
		const s = seedFor('2026-05-12');
		expect(Number.isInteger(s)).toBe(true);
		expect(s).toBeGreaterThanOrEqual(0);
		expect(s).toBeLessThan(2 ** 32);
	});
});
