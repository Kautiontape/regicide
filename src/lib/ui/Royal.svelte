<script lang="ts">
	import type { Royal } from '$lib/engine';

	interface Props {
		royal: Royal;
		shield: number;
		immunityCancelled: boolean;
		onhover?: (text: string | null) => void;
	}

	let { royal, shield, immunityCancelled, onhover }: Props = $props();

	const SUIT_GLYPH: Record<string, string> = {
		hearts: '♥',
		diamonds: '♦',
		clubs: '♣',
		spades: '♠'
	};

	const isRed = $derived(royal.suit === 'hearts' || royal.suit === 'diamonds');
	const remainingHP = $derived(royal.maxHealth - royal.damageTaken);
	const hpPct = $derived(Math.max(0, (remainingHP / royal.maxHealth) * 100));
	const effectiveAttack = $derived(Math.max(0, royal.attack - shield));
	const rankLabel = $derived(royal.rank === 'J' ? 'Jack' : royal.rank === 'Q' ? 'Queen' : 'King');

	const tipText = $derived(
		`${rankLabel} of ${royal.suit}. HP ${remainingHP}/${royal.maxHealth} · ATK ${effectiveAttack}. ` +
			(immunityCancelled
				? 'A Jester knocked out this royal\'s immunity.'
				: `Immune to ${royal.suit} — those cards still hit, but their powers fizzle.`) +
			' Defeat by reducing HP to 0; exact damage places it on top of the tavern deck.'
	);

	function notifyHover(on: boolean) {
		onhover?.(on ? tipText : null);
	}

	function onClick() {
		// Tap shows the tooltip; tapping the tooltip itself dismisses it (handled by parent).
		notifyHover(true);
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			notifyHover(true);
		}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
	class="royal-touch flex flex-col items-center gap-1.5 sm:gap-3 cursor-pointer select-none"
	role="button"
	tabindex="0"
	aria-label={tipText}
	onmouseenter={() => notifyHover(true)}
	onmouseleave={() => notifyHover(false)}
	onclick={onClick}
	onkeydown={onKey}
	oncontextmenu={(e) => e.preventDefault()}
>
	<!-- Card -->
	<div
		class="relative w-24 h-36 sm:w-40 sm:h-60 rounded-xl shadow-2xl bg-white border-4 {isRed
			? 'text-red-600 border-red-200'
			: 'text-slate-900 border-slate-300'}"
	>
		<div class="absolute top-1 left-1 sm:top-2 sm:left-2 leading-tight">
			<div class="font-bold text-base sm:text-2xl">{royal.rank}</div>
			<div class="text-sm sm:text-xl">{SUIT_GLYPH[royal.suit]}</div>
		</div>
		<div class="absolute inset-0 flex flex-col items-center justify-center gap-1">
			<div class="text-4xl sm:text-7xl">{SUIT_GLYPH[royal.suit]}</div>
			<div class="text-[9px] sm:text-sm uppercase tracking-widest font-semibold">{rankLabel}</div>
		</div>
		<div class="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 leading-tight rotate-180">
			<div class="font-bold text-base sm:text-2xl">{royal.rank}</div>
			<div class="text-sm sm:text-xl">{SUIT_GLYPH[royal.suit]}</div>
		</div>
	</div>

	<!-- HP bar -->
	<div class="w-36 sm:w-48">
		<div class="flex justify-between text-xs text-slate-200 mb-1">
			<span>HP</span>
			<span>{remainingHP} / {royal.maxHealth}</span>
		</div>
		<div class="h-2 bg-slate-700 rounded-full overflow-hidden">
			<div
				class="h-full bg-gradient-to-r from-red-500 to-red-400 transition-all"
				style="width: {hpPct}%"
			></div>
		</div>
	</div>

	<!-- Stats row -->
	<div class="flex gap-3 text-xs">
		<div class="px-2 py-1 rounded bg-slate-800 text-slate-200">
			<span class="text-red-400 font-bold">⚔ {effectiveAttack}</span>
			{#if shield > 0}<span class="text-blue-300 ml-1">(−{shield})</span>{/if}
		</div>
		{#if !immunityCancelled}
			<div class="px-2 py-1 rounded bg-slate-800 text-slate-200" title="Royal is immune to its own suit">
				<span class="text-slate-400">immune</span>
				<span class="font-bold {isRed ? 'text-red-400' : 'text-slate-100'}">{SUIT_GLYPH[royal.suit]}</span>
			</div>
		{:else}
			<div class="px-2 py-1 rounded bg-amber-900/40 text-amber-200 border border-amber-500/40">
				immunity off
			</div>
		{/if}
	</div>
</div>

<style>
	/* Suppress iOS long-press text-selection callout and Android long-press menu. */
	:global(.royal-touch) {
		-webkit-touch-callout: none;
		-webkit-user-select: none;
		user-select: none;
		touch-action: manipulation;
	}
</style>
