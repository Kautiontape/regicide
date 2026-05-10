<script lang="ts">
	import { onMount } from 'svelte';
	import { game } from '$lib/store.svelte';

	type StepId = 'pickCard' | 'play' | 'damage' | 'defeat' | 'done';

	interface Step {
		id: StepId;
		title: string;
		/** Body text used on touch devices (no keyboard mentions). */
		touch: string;
		/** Body text used on hover-capable devices (includes keyboard shortcuts). */
		desktop: string;
	}

	const STEPS: Step[] = [
		{
			id: 'pickCard',
			title: 'Welcome to Regicide',
			touch:
				'Tap a card in your hand. Try a small one — the value is the damage. Suit symbols (♥ ♦ ♣ ♠) trigger powers when the royal isn\'t immune.',
			desktop:
				'Tap a card in your hand (or press 1–8). Try a small one — the value is the damage. Suit symbols (♥ ♦ ♣ ♠) trigger powers when the royal isn\'t immune.'
		},
		{
			id: 'play',
			title: 'Now play it',
			touch:
				'Tap Play. The forecast shows exactly what will happen — damage dealt, the royal\'s HP after, and how hard it hits back.',
			desktop:
				'Press Enter or Space (or click Play). The forecast shows exactly what will happen — damage dealt, the royal\'s HP after, and how hard it hits back.'
		},
		{
			id: 'damage',
			title: 'Take the counter-attack',
			touch:
				'Royal hits back. Pick cards whose total ≥ the damage owed. Auto-pick suggests the minimum-waste set (green outlines). Tap Discard when ready.',
			desktop:
				'Royal hits back. Pick cards whose total ≥ the damage owed. Auto-pick suggests the minimum-waste set (green outlines). Press Enter to discard.'
		},
		{
			id: 'defeat',
			title: 'Defeat a royal',
			touch:
				'Reduce HP to 0 to defeat. Exact damage puts it on top of the tavern deck — your next draw is a known good card. Otherwise it goes to discard for ♥ to recover.',
			desktop:
				'Reduce HP to 0 to defeat. Exact damage puts it on top of the tavern deck — your next draw is a known good card. Otherwise it goes to discard for ♥ to recover.'
		},
		{
			id: 'done',
			title: 'You\'ve got it',
			touch:
				'Twelve royals to go. Combos: an Ace + any one card, or same-rank cards summing ≤ 10. Watch for ♠ shields and ♣ doubles. Good luck!',
			desktop:
				'Twelve royals to go. Combos: an Ace + any one card, or same-rank cards summing ≤ 10. Watch for ♠ shields and ♣ doubles. Good luck!'
		}
	];

	const DISMISS_KEY = 'regicide:tutorialDone:v1';

	let dismissed = $state(false);
	let isTouch = $state(false);

	onMount(() => {
		// Detect coarse pointer (touch). Used to pick the right body copy — no point telling
		// a phone user to "press Enter" or "press 1-8".
		if (typeof window !== 'undefined' && window.matchMedia) {
			const mq = window.matchMedia('(pointer: coarse)');
			isTouch = mq.matches;
			const fn = (e: MediaQueryListEvent) => (isTouch = e.matches);
			mq.addEventListener('change', fn);
			return () => mq.removeEventListener('change', fn);
		}
	});

	$effect(() => {
		if (typeof localStorage === 'undefined') return;
		dismissed = localStorage.getItem(DISMISS_KEY) === '1';
	});

	const gs = $derived(game.state);

	// Determine current step based on game state.
	const currentStep = $derived<StepId | null>(determine());

	function determine(): StepId | null {
		if (!gs || !gs.config.tutorial || dismissed) return null;
		if (gs.phase === 'won' || gs.phase === 'lost') return null;
		if (gs.turn === 1 && gs.phase === 'play' && game.selected.length === 0) return 'pickCard';
		if (gs.turn === 1 && gs.phase === 'play' && game.selected.length > 0) return 'play';
		if (gs.phase === 'damage' && gs.turn <= 3) return 'damage';
		if (gs.castleDeck.length === 11 && gs.turn >= 2 && gs.phase === 'play') return 'defeat';
		if (gs.castleDeck.length === 10 && gs.turn >= 3) return 'done';
		return null;
	}

	const step = $derived(STEPS.find((s) => s.id === currentStep));
	const body = $derived(step ? (isTouch ? step.touch : step.desktop) : '');

	function dismissPermanently() {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(DISMISS_KEY, '1');
		}
		dismissed = true;
	}
</script>

{#if step}
	<!-- Mobile: anchored above the action row + hand (~13rem) so it doesn't overlap
		 either the header/stats area at top or the play button/cards at the bottom.
		 Desktop: bottom-right corner as before. -->
	<div
		class="fixed z-40 bg-slate-900/95 border border-amber-400/60 rounded-xl p-3 sm:p-4 shadow-2xl tutorial-fade
			left-2 right-2 max-w-none
			bottom-[calc(13rem+env(safe-area-inset-bottom,0px))]
			md:left-auto md:right-6 md:bottom-6 md:max-w-sm"
	>
		<div class="flex items-start gap-3">
			<div class="text-amber-300 text-xl leading-none mt-0.5">✦</div>
			<div class="flex-1">
				<div class="font-bold text-amber-300 mb-1 text-sm sm:text-base">{step.title}</div>
				<div class="text-xs sm:text-sm text-slate-200 leading-snug">{body}</div>
			</div>
			<button
				type="button"
				onclick={dismissPermanently}
				title="Dismiss tutorial"
				class="text-slate-400 hover:text-slate-200 text-base leading-none px-1"
				aria-label="Dismiss tutorial"
			>
				✕
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
