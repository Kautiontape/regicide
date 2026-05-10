import { browser } from '$app/environment';
import {
	canPayDamage,
	checkPlay,
	clearForcedPlay,
	damageCheck,
	newGame,
	pickForcedPlay,
	play,
	sel,
	suggestDiscards,
	takeDamage,
	type GameConfig,
	type GameState,
	type ResolveResult,
	type RuleId
} from './engine';
import { recordCompletedGame } from './history';

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
	| { kind: 'forced'; cardId: string }
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

	function start(config: GameConfig) {
		const s = newGame(config);
		state = s;
		selected = [];
		lastAction = { kind: 'newGame' };
		saveState(s);
	}

	function abandon() {
		state = null;
		selected = [];
		lastAction = null;
		saveState(null);
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
		if (result.defeated) updates.push(result.defeated.exact ? 'exactKill' : 'overkill');
		if (selected.length === 1 && state.hand.find((c) => c.id === selected[0])?.rank === 'JESTER') {
			updates.push('jesterPlayed');
		}
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
		// If a forced-play applies (post-jester), apply it on the next turn automatically.
		if (state.jesterEnemyChooses) {
			const forced = pickForcedPlay(state);
			if (forced) {
				bumpSeen(['jesterForcedPlay']);
				lastAction = { kind: 'forced', cardId: forced };
				selected = [forced];
				// Auto-commit the forced single-card play
				const result = play(state, [forced]);
				let n = result.state;
				if (n.phase === 'damage') n = damageCheck(n);
				n = clearForcedPlay(n);
				state = n;
				lastAction = { kind: 'play', result: { ...result, state: n } };
				selected = [];
			}
		}
		maybeRecordCompletion(state);
		saveState(state);
	}

	function maybeRecordCompletion(s: GameState) {
		// recordCompletedGame is idempotent on startedAt so calling it twice on the same
		// finished game is safe — the second call replaces the existing record.
		if (s.phase === 'won' || s.phase === 'lost') {
			recordCompletedGame(s);
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
		toggleSelect,
		clearSelection,
		replaceSelection,
		commitPlay,
		commitDamage,
		ruleSeen
	};
}

export const game = createGameStore();
