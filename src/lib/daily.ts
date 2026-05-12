import { browser } from '$app/environment';

/** Local-time day key. Local time was an explicit product decision: globally synchronised
 *  midnights add support burden for nothing — if a player in Tokyo gets the puzzle 12 hours
 *  before someone in San Francisco, that's fine. */
export function todayKey(now: Date = new Date()): string {
	const y = now.getFullYear();
	const m = (now.getMonth() + 1).toString().padStart(2, '0');
	const d = now.getDate().toString().padStart(2, '0');
	return `${y}-${m}-${d}`;
}

/** Daily #1 = 2026-05-12. Each subsequent local day increments by one. */
export const DAILY_EPOCH_KEY = '2026-05-12';

/** Local-midnight UTC ms for a YYYY-MM-DD key. Date.UTC avoids the local-timezone offset
 *  drifting the difference (we only care about whole-day deltas). */
function midnightMs(key: string): number {
	const [y, m, d] = key.split('-').map((s) => parseInt(s, 10));
	return Date.UTC(y, m - 1, d);
}

export function dailyNumber(key: string): number {
	const days = Math.floor((midnightMs(key) - midnightMs(DAILY_EPOCH_KEY)) / 86_400_000);
	return days + 1;
}

/** Deterministic seed from the date key. FNV-1a 32-bit — overkill for what's needed but
 *  cheap and avoids hashing two near-identical date strings to nearby seeds. */
export function seedFor(key: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < key.length; i++) {
		h ^= key.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

const ATTEMPT_KEY = 'regicide:daily:v1';

export type DailyStatus = 'in-progress' | 'won' | 'lost';

export interface DailyAttempt {
	date: string;
	status: DailyStatus;
	attemptCount: number;
	/** startedAt of the GameRecord this attempt produced (only set when status !== 'in-progress'). */
	recordRef?: number;
}

/** Read today's daily attempt, or null if there is none / it's stale (yesterday's). Stale
 *  records are silently dropped so the caller doesn't have to special-case the rollover. */
export function loadDailyAttempt(now: Date = new Date()): DailyAttempt | null {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(ATTEMPT_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as DailyAttempt;
		if (parsed.date !== todayKey(now)) return null;
		return parsed;
	} catch {
		return null;
	}
}

export function saveDailyAttempt(attempt: DailyAttempt) {
	if (!browser) return;
	localStorage.setItem(ATTEMPT_KEY, JSON.stringify(attempt));
}

export function clearDailyAttempt() {
	if (!browser) return;
	localStorage.removeItem(ATTEMPT_KEY);
}
