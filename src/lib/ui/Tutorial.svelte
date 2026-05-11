<script lang="ts">
	import { onMount } from 'svelte';
	import { game } from '$lib/store.svelte';
	import type { RuleId } from '$lib/engine';

	/* ───────── persistence ───────── */

	const DONE_KEY = 'regicide:tutorialDone:v1';
	const ACKED_KEY = 'regicide:tutorialAcked:v1';

	function loadAcked(): Set<string> {
		if (typeof localStorage === 'undefined') return new Set();
		try {
			const raw = localStorage.getItem(ACKED_KEY);
			if (!raw) return new Set();
			const arr = JSON.parse(raw);
			if (!Array.isArray(arr)) return new Set();
			return new Set(arr.filter((x) => typeof x === 'string'));
		} catch {
			return new Set();
		}
	}

	function saveAcked(set: Set<string>) {
		if (typeof localStorage === 'undefined') return;
		localStorage.setItem(ACKED_KEY, JSON.stringify([...set]));
	}

	function markTutorialDone() {
		if (typeof localStorage === 'undefined') return;
		localStorage.setItem(DONE_KEY, '1');
	}

	let acked = $state<Set<string>>(new Set());

	onMount(() => {
		acked = loadAcked();
	});

	function ack(id: string) {
		const next = new Set(acked);
		next.add(id);
		acked = next;
		saveAcked(next);
	}

	/** Mark every rule the scripted Jack-of-Hearts run already taught the player as
	 *  acknowledged, so the contextual one-shots don't re-explain them after the tutorial. */
	function ackTutorialCoveredRules() {
		const covered = ['spadesShield', 'diamondsDraw', 'clubsDouble', 'companion', 'suitImmunity', 'exactKill'];
		const next = new Set(acked);
		for (const id of covered) next.add(`rule:${id}`);
		next.add('script:end');
		acked = next;
		saveAcked(next);
	}

	/* ───────── prompt definitions ───────── */

	type Prompt = {
		id: string;
		title: string;
		body: string;
		/** Optional callback fired on dismiss in addition to the standard ack. */
		onDismiss?: () => void;
	};

	const gs = $derived(game.state);
	const inTutorial = $derived(!!gs?.config.tutorial);
	/** True only while the scripted run is still in progress. config.tutorial stays set for
	 *  the whole game, but once the End message is dismissed the player should get the full
	 *  contextual-prompt experience like any normal run. */
	const tutorialActive = $derived(inTutorial && !acked.has('script:end'));

	/** Rule-firing one-shots: each shows once when seenRules transitions from 0 → 1. The acked
	 *  set persists across games so the player only sees each lesson the first time the rule
	 *  ever fires for them. */
	function ruleOneShot(rule: RuleId, prompt: Omit<Prompt, 'id'>): Prompt | null {
		const id = `rule:${rule}`;
		if (acked.has(id)) return null;
		if (game.ruleSeen(rule) === 0) return null;
		return { id, ...prompt };
	}

	/* ───────── scripted prompts (tutorial mode only) ───────── */

	function scriptedPrompt(): Prompt | null {
		if (!gs || !inTutorial) return null;
		if (gs.phase === 'won' || gs.phase === 'lost') return null;
		// Scripted prompts are gated on the ack set so each step only shows once per game.
		const skip = (id: string) => acked.has(id);

		// Once the Jack falls, run the wrap-up — but only after the three rule one-shots that
		// fire on T4 (companion, suitImmunity, exactKill) have each been acknowledged. Letting
		// the End message preempt them would skip the scripted teaching beats.
		const jackDown = gs.turn >= 5 || (gs.currentEnemy && gs.currentEnemy.rank !== 'J');
		if (jackDown) {
			const t4Lessons = ['rule:companion', 'rule:suitImmunity', 'rule:exactKill'];
			const allAcked = t4Lessons.every((id) => acked.has(id));
			if (!allAcked) return null;
			if (acked.has('script:end')) return null;
			return {
				id: 'script:end',
				title: "You're ready",
				body: "That's the core loop. Eleven royals to go, and the deck won't be this kind to you. Good luck.",
				onDismiss: () => {
					markTutorialDone();
					ackTutorialCoveredRules();
				}
			};
		}

		if (gs.turn === 1 && gs.phase === 'play' && !skip('script:t1-pre')) {
			return {
				id: 'script:t1-pre',
				title: 'Welcome to Regicide',
				body: 'Tap a card to select it. Try the 5 of Spades.'
			};
		}
		if (gs.turn === 1 && gs.phase === 'damage' && !skip('script:t1-damage')) {
			return {
				id: 'script:t1-damage',
				title: '♠ Shield',
				body:
					"Nice. That's your ♠ Shield, absorbing 5 damage from the Jack for the rest of the fight. " +
					'Each spade you play adds more shield on top. Jack swings back for 10. Your shield ' +
					'soaks 5. Discard cards summing to at least 5 to cover the rest.',
			};
		}
		if (gs.turn === 2 && gs.phase === 'play' && !skip('script:t2-pre')) {
			return { id: 'script:t2-pre', title: 'Draw a hand', body: 'Try the 4 of Diamonds next.' };
		}
		if (gs.turn === 2 && gs.phase === 'damage' && !skip('script:t2-damage')) {
			return {
				id: 'script:t2-damage',
				title: '♦ Draw',
				body:
					"♦ Draw 4. Hand's back up to full, and your shield from last turn is still active. " +
					'Jack attacks for 10 again, but your shield brings it down to 5.',
			};
		}
		if (gs.turn === 3 && gs.phase === 'play' && !skip('script:t3-pre')) {
			return { id: 'script:t3-pre', title: 'Hit harder', body: 'Now the 3 of Clubs.' };
		}
		if (gs.turn === 3 && gs.phase === 'damage' && !skip('script:t3-damage')) {
			return {
				id: 'script:t3-damage',
				title: '♣ Double',
				body:
					'♣ doubles your damage. That 3 just hit for 6. Save your big clubs for your hardest hits.',
			};
		}
		if (gs.turn === 4 && gs.phase === 'play' && !skip('script:t4-pre')) {
			return {
				id: 'script:t4-pre',
				title: 'Big finish',
				body: 'Select both the Ace of Spades and the 4 of Hearts.'
			};
		}
		return null;
	}

	/* ───────── reactive prompts (always-on, condition-driven) ───────── */

	function reactivePrompt(): Prompt | null {
		if (!gs) return null;
		if (gs.phase === 'damage' && !game.canPay) {
			if (gs.jestersRemaining > 0 && !acked.has('reactive:jester-forced')) {
				return {
					id: 'reactive:jester-forced',
					title: 'Last chance',
					body: "You can't cover this hit. Use a Jester now or you lose."
				};
			}
			// canPay false + no jesters means the engine will already have transitioned to lost
			// by the next render; the cant-pay one-shot still gives one final beat.
		}
		return null;
	}

	/* ───────── contextual one-shots ───────── */

	function contextualPrompt(): Prompt | null {
		if (!gs) return null;

		// New royal tier — surface as the player enters the play phase against them, so the
		// stat reminder lands before they pick cards.
		if (gs.phase === 'play' && gs.currentEnemy?.rank === 'Q' && !acked.has('royal:queen')) {
			return {
				id: 'royal:queen',
				title: 'Queen',
				body: 'Queen incoming. 30 HP, 15 attack. Bigger discard piles now, so hearts heal for more.'
			};
		}
		if (gs.phase === 'play' && gs.currentEnemy?.rank === 'K' && !acked.has('royal:king')) {
			return {
				id: 'royal:king',
				title: 'King',
				body: 'King. 40 HP, 20 attack. Last one standing.'
			};
		}

		// Selection-time hint: same-rank combo. Fires the moment a legal multi-card selection
		// appears, before commit, so the player notices it as a choice rather than as a fact.
		// Suppressed while the script is still running — the player is following turn-specific
		// instructions and shouldn't get a curveball mid-script.
		if (!tutorialActive && gs.phase === 'play' && game.selected.length >= 2 && !acked.has('hint:sameRankPicked')) {
			const sel = gs.hand.filter((c) => game.selected.includes(c.id));
			if (sel.length >= 2 && sel.every((c) => c.rank === sel[0].rank) && sel[0].rank !== 'A') {
				const sum = sel.reduce((s, c) => s + c.value, 0);
				if (sum <= 10) {
					return {
						id: 'hint:sameRankPicked',
						title: 'Same-rank combo',
						body:
							'These play as one card. Damage sums and every suit power triggers. ' +
							'Press Play to commit.'
					};
				}
			}
		}

		// Rule-firing one-shots (after a play has resolved). Order matters: most "wow" rules first.
		const order: Array<[RuleId, Omit<Prompt, 'id'>]> = [
			[
				'companion',
				{
					title: 'Animal Companion',
					body:
						'Aces are Animal Companions. Pair one with any card and both suit powers ' +
						'trigger. Damage sums together.',
				}
			],
			[
				'suitImmunity',
				{
					title: 'Suit immunity',
					body: "That power didn't trigger. Royals are immune to their own suit.",
				}
			],
			[
				'exactKill',
				{
					title: 'Exact kill',
					body:
						'Exact kill! The royal goes face-down on top of the tavern. The next diamond ' +
						'you draw brings them back to your hand.',
				}
			],
			[
				'overkill',
				{
					title: 'Overkill',
					body: 'Defeated by overkill. The royal heads to the discard pile instead of the top of the tavern.'
				}
			],
			[
				'sameRankCombo',
				{
					title: 'Same-rank combo',
					body: 'These play as one big card. Damage sums and every suit power triggers.'
				}
			],
			[
				'heartsHeal',
				{
					title: '♥ Hearts heal',
					body: '♥ heals! Shuffles the discard, then slides that many cards under the tavern.'
				}
			],
			[
				'jesterAbility',
				{
					title: 'Jester ability',
					body:
						'A Jester clears your hand and deals you a new one. Handy when you' +
						"'re stuck — you've got a limited supply, so spend them wisely."
				}
			]
		];
		// While the script is still running, only the T4 lessons (companion / immunity /
		// exactKill) should be allowed to surface as contextual prompts. Everything else —
		// overkill from a deviating play, sameRankCombo from an experimental selection, etc.
		// — would otherwise interrupt the script with off-topic teaching beats. Those rules
		// will resurface naturally on later plays once the End message is dismissed.
		const T4_LESSONS: RuleId[] = ['companion', 'suitImmunity', 'exactKill'];
		for (const [rule, prompt] of order) {
			if (tutorialActive && !T4_LESSONS.includes(rule)) continue;
			const p = ruleOneShot(rule, prompt);
			if (p) return p;
		}

		// Cant-pay terminal beat — only when the engine hasn't yet flipped to 'lost' (it will
		// next tick, but we show this as a heads-up). Once 'lost' is set, the Defeat overlay
		// takes over.
		if (gs.phase === 'damage' && !game.canPay && gs.jestersRemaining === 0 && !acked.has('reactive:cant-pay')) {
			return {
				id: 'reactive:cant-pay',
				title: 'Game over',
				body: "Your hand can't cover the damage. The royals win this round."
			};
		}

		return null;
	}

	/* ───────── selection ─────────
	 * Priority: scripted (tutorial only) → reactive → contextual. */

	const current = $derived<Prompt | null>(scriptedPrompt() ?? reactivePrompt() ?? contextualPrompt());

	function dismiss() {
		const c = current;
		if (!c) return;
		ack(c.id);
		c.onDismiss?.();
	}
</script>

{#if current}
	<!-- Mobile: anchored above the action row + hand (~13rem) so it doesn't overlap
		 either the header/stats area at top or the play button/cards at the bottom.
		 Desktop: bottom-right corner. -->
	<div
		class="fixed z-40 bg-slate-900/95 border border-amber-400/60 rounded-xl p-3 sm:p-4 shadow-2xl tutorial-fade
			left-2 right-2 max-w-none
			bottom-[calc(13rem+env(safe-area-inset-bottom,0px))]
			md:left-auto md:right-6 md:bottom-6 md:max-w-sm"
	>
		<div class="flex items-start gap-3">
			<div class="text-amber-300 text-xl leading-none mt-0.5">✦</div>
			<div class="flex-1">
				<div class="font-bold text-amber-300 mb-1 text-sm sm:text-base">{current.title}</div>
				<div class="text-xs sm:text-sm text-slate-200 leading-snug">{current.body}</div>
			</div>
			<button
				type="button"
				onclick={dismiss}
				title="Got it"
				class="shrink-0 rounded px-2.5 py-1 text-xs font-semibold leading-none bg-amber-400 text-slate-900 hover:bg-amber-300"
				aria-label="Acknowledge"
			>
				OK
			</button>
		</div>
	</div>
{/if}

<style>
	@keyframes tutorial-in {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	:global(.tutorial-fade) {
		animation: tutorial-in 0.25s ease-out;
	}
</style>
