import { browser } from '$app/environment';
import type { GameState, LogEntry } from './engine';

const HISTORY_KEY = 'regicide:history:v1';
const MAX_RECORDS = 200;

export interface GameRecord {
	outcome: 'won' | 'lost';
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

export interface HistorySummary {
	total: number;
	wins: number;
	losses: number;
	winRate: number;
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
		return parsed as GameRecord[];
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

/** Build and persist a record from a completed game. Returns the record (or null if the
 *  game isn't actually completed). */
export function recordCompletedGame(state: GameState): GameRecord | null {
	if (state.phase !== 'won' && state.phase !== 'lost') return null;
	const completedAt = state.endedAt ?? Date.now();
	const elapsedMs = Math.max(0, completedAt - state.startedAt);
	const stats = statsFromLog(state.log);
	const record: GameRecord = {
		outcome: state.phase,
		jesters: state.config.jesters,
		handSize: state.config.handSize,
		turns: state.turn,
		elapsedMs,
		startedAt: state.startedAt,
		completedAt,
		...stats
	};
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
	const total = records.length;
	const wins = records.filter((r) => r.outcome === 'won').length;
	const losses = total - wins;
	const winRecords = records.filter((r) => r.outcome === 'won');
	const bestTurns =
		winRecords.length === 0 ? null : Math.min(...winRecords.map((r) => r.turns));
	const bestTimeMs =
		winRecords.length === 0 ? null : Math.min(...winRecords.map((r) => r.elapsedMs));
	const totalTimeMs = records.reduce((s, r) => s + r.elapsedMs, 0);
	return {
		total,
		wins,
		losses,
		winRate: total === 0 ? 0 : wins / total,
		bestTurns,
		bestTimeMs,
		totalTimeMs
	};
}

export function formatDuration(ms: number): string {
	const totalSec = Math.floor(ms / 1000);
	const h = Math.floor(totalSec / 3600);
	const m = Math.floor((totalSec % 3600) / 60);
	const s = totalSec % 60;
	const pad = (n: number) => n.toString().padStart(2, '0');
	return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
