import type { GameState } from './engine';

export interface TutorialAdvice {
	/** Card IDs the tutorial wants the player to *play* this turn. Empty when the player has
	 *  no scripted move (post-T4, or outside tutorial mode). */
	play: string[];
	/** Card IDs the tutorial wants the player to *discard* this damage step. Empty when no
	 *  guidance applies. */
	discard: string[];
}

const NO_ADVICE: TutorialAdvice = { play: [], discard: [] };

/** Compute which cards the scripted tutorial currently recommends. Pure projection of game
 *  state — both the Tutorial overlay (for visual highlighting) and the Board (for bumping
 *  auto-pick toward the script-favourable choice) read this.
 *
 *  Returning IDs that aren't currently in the player's hand is harmless: callers filter by
 *  hand membership before rendering. */
export function tutorialAdvice(state: GameState | null): TutorialAdvice {
	if (!state || !state.config.tutorial) return NO_ADVICE;
	if (state.phase === 'won' || state.phase === 'lost') return NO_ADVICE;

	if (state.turn === 1 && state.phase === 'play') return { play: ['5S'], discard: [] };
	if (state.turn === 1 && state.phase === 'damage') return { play: [], discard: ['5C'] };
	if (state.turn === 2 && state.phase === 'play') return { play: ['4D'], discard: [] };
	if (state.turn === 2 && state.phase === 'damage') return { play: [], discard: ['5D'] };
	if (state.turn === 3 && state.phase === 'play') return { play: ['3C'], discard: [] };
	if (state.turn === 3 && state.phase === 'damage') return { play: [], discard: ['5H'] };
	if (state.turn === 4 && state.phase === 'play') return { play: ['AS', '4H'], discard: [] };
	return NO_ADVICE;
}
