import { browser } from '$app/environment';
import type { GameMode, GameState, LogEntry } from './engine';

const HISTORY_KEY = 'regicide:history:v1';
const MAX_RECORDS = 200;

export interface GameRecord {
	/** Normal-mode losses are still excluded; daily losses are persisted so the player can
	 *  see "got to the Queen on Daily #34". */
	outcome: 'won' | 'lost';
	mode: GameMode;
	/** YYYY-MM-DD key from daily.ts, only set when mode === 'daily'. Lets the history list
	 *  surface the puzzle number without recomputing it. */
	dailyDate?: string;
	/** True when the run used the scripted tutorial deck (deck.ts:buildTutorialTavern). The
	 *  share text and history list mark these so a tutorial-assisted win is visibly distinct
	 *  from one earned on a fresh shuffle. */
	tutorial: boolean;
	/** Daily mode only: 1 for the first attempt of the day, 2+ if the player chose to
	 *  retry. Always 1 in normal mode. */
	attemptCount: number;
	jesters: 0 | 1 | 2;
	handSize: number;
	turns: number;
	elapsedMs: number;
	startedAt: number;
	completedAt: number;
	// Stats derived from log at completion
	damageDealt: number;
	damageTaken: number;
	exactKills: number;
	healed: number;
	drawn: number;
	shielded: number;
	/** Count of solo Jester abilities activated during the run. 0 = no rescues. */
	jestersUsed: number;
	royalsDefeated: number;
}

export type Tier = 'gold' | 'silver' | 'bronze';

/** Bronze/Silver/Gold tier from the official solo rules: 0 Jesters used = Gold, 1 = Silver,
 *  2 = Bronze. Only meaningful for victories with the canonical 2-Jester variant — fewer
 *  starting Jesters changes the difficulty floor and makes the tier comparison meaningless. */
export function tierFor(
	record: Pick<GameRecord, 'jesters' | 'jestersUsed'> & { outcome?: GameRecord['outcome'] }
): Tier | null {
	if (record.outcome === 'lost') return null;
	if (record.jesters !== 2) return null;
	if (record.jestersUsed === 0) return 'gold';
	if (record.jestersUsed === 1) return 'silver';
	return 'bronze';
}

export interface HistorySummary {
	wins: number;
	bestTurns: number | null;
	bestTimeMs: number | null;
	totalTimeMs: number;
}

export function loadHistory(): GameRecord[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(HISTORY_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		// Migrate legacy records: pre-mode records were all normal-mode wins with no tutorial
		// tracking, so backfill those defaults only when the field is missing.
		return (parsed as Array<Partial<GameRecord> & { outcome: string }>)
			.filter((r) => r.outcome === 'won' || (r.outcome === 'lost' && r.mode === 'daily'))
			.map((r): GameRecord => {
				const rec = r as GameRecord;
				return {
					...rec,
					mode: rec.mode ?? 'normal',
					tutorial: rec.tutorial ?? false,
					attemptCount: rec.attemptCount ?? 1
				};
			});
	} catch {
		return [];
	}
}

function saveHistory(records: GameRecord[]) {
	if (!browser) return;
	localStorage.setItem(HISTORY_KEY, JSON.stringify(records.slice(-MAX_RECORDS)));
}

export function clearHistory() {
	if (!browser) return;
	localStorage.removeItem(HISTORY_KEY);
}

function statsFromLog(log: LogEntry[]) {
	let damageDealt = 0;
	let damageTaken = 0;
	let exactKills = 0;
	let healed = 0;
	let drawn = 0;
	let shielded = 0;
	let jestersUsed = 0;
	let royalsDefeated = 0;
	for (const e of log) {
		if (e.kind === 'damage') {
			const m = e.text.match(/Dealt (\d+) damage/);
			if (m) damageDealt += parseInt(m[1], 10);
		} else if (e.kind === 'defeat') {
			royalsDefeated++;
			if (/exact/i.test(e.text)) exactKills++;
		} else if (e.kind === 'discard') {
			const m = e.text.match(/for (\d+)/);
			if (m) damageTaken += parseInt(m[1], 10);
		} else if (e.kind === 'heal') {
			const m = e.text.match(/healed (\d+)/);
			if (m) healed += parseInt(m[1], 10);
		} else if (e.kind === 'draw') {
			const m = e.text.match(/drew (\d+)/);
			if (m) drawn += parseInt(m[1], 10);
		} else if (e.kind === 'shield') {
			const m = e.text.match(/\+(\d+)/);
			if (m) shielded += parseInt(m[1], 10);
		} else if (e.kind === 'jester') {
			jestersUsed++;
		}
	}
	return {
		damageDealt,
		damageTaken,
		exactKills,
		healed,
		drawn,
		shielded,
		jestersUsed,
		royalsDefeated
	};
}

/** Pure projection of a completed (or finished-but-unrecorded) GameState into a GameRecord.
 *  Used both by recordCompletedGame and by the Victory/Defeat overlays so they can hand a
 *  fully-formed record to the share button without re-deriving any of the math themselves. */
export function buildRecord(state: GameState, attemptCount = 1): GameRecord {
	const completedAt = state.endedAt ?? Date.now();
	const elapsedMs = Math.max(0, completedAt - state.startedAt);
	const stats = statsFromLog(state.log);
	const outcome: GameRecord['outcome'] = state.phase === 'won' ? 'won' : 'lost';
	return {
		outcome,
		mode: state.config.mode ?? 'normal',
		dailyDate: state.config.dailyDate,
		tutorial: state.config.tutorial === true,
		attemptCount,
		jesters: state.config.jesters,
		handSize: state.config.handSize,
		turns: state.turn,
		elapsedMs,
		startedAt: state.startedAt,
		completedAt,
		...stats
	};
}

/** Build and persist a record from a completed game. Daily losses are persisted; normal-mode
 *  losses are intentionally dropped (only victories show up in the normal history list). */
export function recordCompletedGame(state: GameState, attemptCount = 1): GameRecord | null {
	if (state.phase !== 'won' && state.phase !== 'lost') return null;
	const mode: GameMode = state.config.mode ?? 'normal';
	if (state.phase === 'lost' && mode !== 'daily') return null;
	const record = buildRecord(state, attemptCount);
	const all = loadHistory();
	// De-dupe: if a record with the same startedAt already exists, replace it instead of
	// appending. Defends against double-recording when the store fires effects twice.
	const idx = all.findIndex((r) => r.startedAt === record.startedAt);
	if (idx >= 0) all[idx] = record;
	else all.push(record);
	saveHistory(all);
	return record;
}

export function summarize(records: GameRecord[]): HistorySummary {
	// Best-turn / best-time stats only consider victories — a loss has no meaningful "best"
	// to compete against. Total time still includes losses so the time-played counter is honest.
	const wonRecords = records.filter((r) => r.outcome === 'won');
	const wins = wonRecords.length;
	const bestTurns = wins === 0 ? null : Math.min(...wonRecords.map((r) => r.turns));
	const bestTimeMs = wins === 0 ? null : Math.min(...wonRecords.map((r) => r.elapsedMs));
	const totalTimeMs = records.reduce((s, r) => s + r.elapsedMs, 0);
	return { wins, bestTurns, bestTimeMs, totalTimeMs };
}

export function formatDuration(ms: number): string {
	const totalSec = Math.floor(ms / 1000);
	const h = Math.floor(totalSec / 3600);
	const m = Math.floor((totalSec % 3600) / 60);
	const s = totalSec % 60;
	const pad = (n: number) => n.toString().padStart(2, '0');
	return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
