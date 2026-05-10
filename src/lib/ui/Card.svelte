<script lang="ts">
	import type { Card } from '$lib/engine';

	interface Props {
		card: Card;
		size?: 'sm' | 'md' | 'lg';
		selected?: boolean;
		disabled?: boolean;
		dim?: boolean;
		/** Visual emphasis: 'suggest' = green outline (auto-pick recommendation). */
		emphasis?: 'suggest' | null;
		/** Optional tooltip text. If omitted, generated from suit/rank. Passed to onhover. */
		tooltip?: string;
		onclick?: () => void;
		/** Called with the tooltip text on hover/focus, and null on leave/blur. */
		onhover?: (text: string | null) => void;
	}

	let {
		card,
		size = 'md',
		selected = false,
		disabled = false,
		dim = false,
		emphasis = null,
		tooltip,
		onclick,
		onhover
	}: Props = $props();

	const dims = {
		sm: 'w-12 h-[68px] text-[10px]',
		md: 'w-16 h-24 text-xs',
		lg: 'w-24 h-36 text-base'
	};
	const pipSize = { sm: 'text-base', md: 'text-2xl', lg: 'text-4xl' };

	const SUIT_GLYPH: Record<string, string> = {
		hearts: '♥',
		diamonds: '♦',
		clubs: '♣',
		spades: '♠'
	};

	const SUIT_RULE: Record<string, string> = {
		hearts: '♥ Heal: shuffle that many cards from discard into the bottom of the tavern.',
		diamonds: '♦ Draw: draw that many cards (capped at hand size).',
		clubs: '♣ Double: this attack deals double damage.',
		spades: '♠ Shield: reduce the royal\'s attack by that much for the rest of the battle.'
	};

	const isRed = $derived(card.suit === 'hearts' || card.suit === 'diamonds');
	const isJester = $derived(card.rank === 'JESTER');

	const rankLabel = $derived(card.rank === '10' ? '10' : card.rank);

	const generatedTip = $derived(
		isJester
			? 'Jester (value 0): cancels the royal\'s immunity. In solo, your next play is randomly chosen from your hand.'
			: card.suit
				? `${rankLabel} of ${card.suit} (value ${card.value}). ${SUIT_RULE[card.suit]}`
				: ''
	);
	const tipText = $derived(tooltip ?? generatedTip);

	function handleClick() {
		if (disabled) return;
		onclick?.();
	}

	function notifyHover(on: boolean) {
		onhover?.(on ? tipText : null);
	}
</script>

<button
	type="button"
	onclick={handleClick}
	onmouseenter={() => notifyHover(true)}
	onmouseleave={() => notifyHover(false)}
	onfocus={() => notifyHover(true)}
	onblur={() => notifyHover(false)}
	class="relative {dims[size]} rounded-lg shadow-md font-semibold transition-all select-none cursor-pointer
		{isJester ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white' : 'bg-white'}
		{isRed && !isJester ? 'text-red-600' : ''}
		{!isRed && !isJester ? 'text-slate-900' : ''}
		{selected ? 'ring-4 ring-amber-400 -translate-y-2 shadow-xl' : 'hover:-translate-y-1'}
		{!selected && emphasis === 'suggest' ? 'ring-2 ring-emerald-400/80' : ''}
		{disabled ? 'opacity-40 cursor-not-allowed' : ''}
		{dim && !selected ? 'opacity-30 grayscale hover:translate-y-0' : ''}"
	disabled={disabled && !selected}
	aria-label="{rankLabel} of {card.suit ?? 'jester'}"
>
	{#if isJester}
		<div class="absolute inset-0 flex items-center justify-center {pipSize[size]}">★</div>
		<div class="absolute top-1 left-1 text-[10px] font-bold tracking-wide">JEST</div>
	{:else}
		<div class="absolute top-1 left-1 leading-none">
			<div class="font-bold">{rankLabel}</div>
			<div>{SUIT_GLYPH[card.suit!]}</div>
		</div>
		<div class="absolute inset-0 flex items-center justify-center {pipSize[size]}">
			{SUIT_GLYPH[card.suit!]}
		</div>
		<div class="absolute bottom-1 right-1 leading-none rotate-180">
			<div class="font-bold">{rankLabel}</div>
			<div>{SUIT_GLYPH[card.suit!]}</div>
		</div>
	{/if}
</button>
