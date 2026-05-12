import { browser } from '$app/environment';
import {
	canPayDamage,
	checkCombo,
	checkPlay,
	damageCheck,
	newGame,
	play,
	sel,
	suggestDiscards,
	takeDamage,
	useJester,
	type GameConfig,
	type GameState,
	type ResolveResult,
	type RuleId
} from './engine';
import { recordCompletedGame } from './history';
import { loadDailyAttempt, saveDailyAttempt } from './daily';

const SAVE_KEY = 'regicide:save:v1';
const SEEN_KEY = 'regicide:seen:v1';

function loadState(): GameState | null {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(SAVE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as GameState;
		// Migration: older saves don't have startedAt / endedAt. Backfill so the timer
		// doesn't show NaN and end-state screens don't read undefined.
		if (typeof parsed.startedAt !== 'number') parsed.startedAt = Date.now();
		if (parsed.endedAt === undefined) parsed.endedAt = null;
		return parsed;
	} catch {
		return null;
	}
}

function loadSeen(): Record<string, number> {
	if (!browser) return {};
	try {
		const raw = localStorage.getItem(SEEN_KEY);
		if (!raw) return {};
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

function saveState(state: GameState | null) {
	if (!browser) return;
	if (!state) {
		localStorage.removeItem(SAVE_KEY);
		return;
	}
	localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function saveSeen(seen: Record<string, number>) {
	if (!browser) return;
	localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
}

export type LastAction =
	| { kind: 'play'; result: ResolveResult }
	| { kind: 'damage'; discarded: number; sum: number }
	| { kind: 'newGame' }
	| { kind: 'jester'; remaining: number }
	| null;

function createGameStore() {
	let state = $state<GameState | null>(null);
	let selected = $state<string[]>([]);
	let lastAction = $state<LastAction>(null);
	let seenRules = $state<Record<string, number>>({});

	function init() {
		const loaded = loadState();
		state = loaded;
		seenRules = loadSeen();
	}

	function start(config: GameConfig, seed?: number) {
		const s = newGame(config, seed);
		state = s;
		selected = [];
		lastAction = { kind: 'newGame' };
		// Daily mode: bump the attempt counter and stage the in-progress record so
		// completion can write back the final outcome with the right attemptCount.
		if (config.mode === 'daily' && config.dailyDate) {
			const prior = loadDailyAttempt();
			const attemptCount =
				prior && prior.date === config.dailyDate ? prior.attemptCount + 1 : 1;
			saveDailyAttempt({
				date: config.dailyDate,
				status: 'in-progress',
				attemptCount
			});
		}
		saveState(s);
	}

	function abandon() {
		state = null;
		selected = [];
		lastAction = null;
		saveState(null);
	}

	/** Surrender the current run: transition into the 'lost' phase so the Defeat overlay
	 * surfaces with the final damage math instead of dumping the player back to setup. */
	function concede() {
		if (!state) return;
		if (state.phase === 'won' || state.phase === 'lost') return;
		state = { ...state, phase: 'lost', endedAt: Date.now() };
		selected = [];
		maybeRecordCompletion(state);
		saveState(state);
	}

	function toggleSelect(cardId: string) {
		if (!state) return;
		if (state.phase !== 'play' && state.phase !== 'damage') return;
		if (selected.includes(cardId)) {
			selected = selected.filter((id) => id !== cardId);
		} else {
			selected = [...selected, cardId];
		}
	}

	function clearSelection() {
		selected = [];
	}

	function replaceSelection(cardId: string) {
		selected = [cardId];
	}

	function commitPlay() {
		if (!state) return;
		if (selected.length === 0) return;
		const check = checkPlay(state, selected);
		if (!check.ok) return;
		const playedCards = state.hand.filter((c) => selected.includes(c.id));
		const comboCheck = checkCombo(playedCards);
		const result = play(state, selected);
		// If the enemy survived, immediately compute damage check.
		let next = result.state;
		if (next.phase === 'damage') next = damageCheck(next);
		state = next;
		lastAction = { kind: 'play', result: { ...result, state: next } };
		// Track rule firings
		const updates: RuleId[] = [];
		for (const a of result.activations) {
			if (a.suppressed) updates.push('suitImmunity');
			else if (a.suit === 'hearts') updates.push('heartsHeal');
			else if (a.suit === 'diamonds') updates.push('diamondsDraw');
			else if (a.suit === 'clubs') updates.push('clubsDouble');
			else if (a.suit === 'spades') updates.push('spadesShield');
		}
		if (comboCheck.ok) {
			if (comboCheck.kind === 'companion') updates.push('companion');
			else if (comboCheck.kind === 'sameRank') updates.push('sameRankCombo');
		}
		if (result.defeated) updates.push(result.defeated.exact ? 'exactKill' : 'overkill');
		bumpSeen(updates);
		selected = [];
		maybeRecordCompletion(state);
		saveState(state);
	}

	function commitDamage(cardIds: string[]) {
		if (!state) return;
		const next = takeDamage(state, cardIds);
		state = next;
		selected = [];
		const sum = cardIds.reduce((s, id) => {
			const c = state!.discardPile.find((x) => x.id === id);
			return s + (c?.value ?? 0);
		}, 0);
		lastAction = { kind: 'damage', discarded: cardIds.length, sum };
		bumpSeen(['damagePhase']);
		maybeRecordCompletion(state);
		saveState(state);
	}

	/** Solo Jester ability: discard hand and refill. Usable at the start of play or damage phase. */
	function activateJester() {
		if (!state) return;
		if (state.jestersRemaining <= 0) return;
		if (state.phase !== 'play' && state.phase !== 'damage') return;
		const next = useJester(state);
		state = next;
		selected = [];
		lastAction = { kind: 'jester', remaining: next.jestersRemaining };
		bumpSeen(['jesterAbility']);
		saveState(state);
	}

	function maybeRecordCompletion(s: GameState) {
		// recordCompletedGame is idempotent on startedAt so calling it twice on the same
		// finished game is safe — the second call replaces the existing record.
		if (s.phase !== 'won' && s.phase !== 'lost') return;
		const isDaily = s.config.mode === 'daily';
		const prior = isDaily ? loadDailyAttempt() : null;
		const attemptCount = prior?.attemptCount ?? 1;
		const record = recordCompletedGame(s, attemptCount);
		if (isDaily && s.config.dailyDate) {
			saveDailyAttempt({
				date: s.config.dailyDate,
				status: s.phase,
				attemptCount,
				recordRef: record?.startedAt
			});
		}
	}

	function bumpSeen(ids: RuleId[]) {
		const updated = { ...seenRules };
		for (const id of ids) updated[id] = (updated[id] ?? 0) + 1;
		seenRules = updated;
		saveSeen(updated);
	}

	function ruleSeen(id: RuleId): number {
		return seenRules[id] ?? 0;
	}

	return {
		get state() {
			return state;
		},
		get selected() {
			return selected;
		},
		get lastAction() {
			return lastAction;
		},
		get effectiveAttack() {
			return state ? sel.effectiveAttack(state) : 0;
		},
		get shield() {
			return state ? sel.shield(state) : 0;
		},
		get suggestedDiscards() {
			return state ? suggestDiscards(state) : [];
		},
		get canPay() {
			return state ? canPayDamage(state) : true;
		},
		init,
		start,
		abandon,
		concede,
		toggleSelect,
		clearSelection,
		replaceSelection,
		commitPlay,
		commitDamage,
		activateJester,
		ruleSeen
	};
}

export const game = createGameStore();
