<script lang="ts">
	import { game } from '$lib/store.svelte';

	type StepId = 'pickCard' | 'play' | 'damage' | 'defeat' | 'done';

	interface Step {
		id: StepId;
		title: string;
		body: string;
	}

	const STEPS: Step[] = [
		{
			id: 'pickCard',
			title: 'Welcome to Regicide',
			body: 'Tap a card in your hand (or press 1–8). Try a small one — the value is the damage. Suit symbols (♥ ♦ ♣ ♠) trigger powers when the royal isn\'t immune.'
		},
		{
			id: 'play',
			title: 'Now play it',
			body: 'Press Enter or Space (or click Play). The forecast above shows exactly what will happen — damage dealt, the royal\'s HP after, and how hard it hits back.'
		},
		{
			id: 'damage',
			title: 'Take the counter-attack',
			body: 'The royal hits back. Pick cards whose total ≥ the damage owed. Auto-pick suggests the minimum-waste set (green outlines). Press Enter to discard.'
		},
		{
			id: 'defeat',
			title: 'Defeat a royal',
			body: 'Reduce HP to 0 to defeat. Exact damage puts it on top of the tavern deck — your next draw is a known good card. Otherwise it goes to discard for ♥ to recover.'
		},
		{
			id: 'done',
			title: 'You\'ve got it',
			body: 'Twelve royals to go. Combos: an Ace + any one card, or same-rank cards summing ≤ 10. Watch for ♠ shields and ♣ doubles. Good luck!'
		}
	];

	const DISMISS_KEY = 'regicide:tutorialDone:v1';

	let dismissed = $state(false);

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

	function dismissPermanently() {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(DISMISS_KEY, '1');
		}
		dismissed = true;
	}
</script>

{#if step}
	<div
		class="fixed bottom-6 right-6 z-40 max-w-sm bg-slate-900/95 border border-amber-400/60 rounded-xl p-4 shadow-2xl tutorial-fade"
	>
		<div class="flex items-start gap-3">
			<div class="text-amber-300 text-xl leading-none mt-0.5">✦</div>
			<div class="flex-1">
				<div class="font-bold text-amber-300 mb-1">{step.title}</div>
				<div class="text-sm text-slate-200 leading-snug">{step.body}</div>
			</div>
			<button
				type="button"
				onclick={dismissPermanently}
				title="Dismiss tutorial"
				class="text-slate-500 hover:text-slate-200 text-xs"
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
