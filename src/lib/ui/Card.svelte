<script lang="ts">
	import type { Card } from '$lib/engine';

	interface Props {
		card: Card;
		size?: 'sm' | 'md' | 'lg';
		selected?: boolean;
		disabled?: boolean;
		dim?: boolean;
		/**
		 * The royal is immune to this card's suit, so its power won't activate.
		 * Surfaces a small ⊘ badge plus a slight desaturation; the card still attacks for value.
		 */
		suppressed?: boolean;
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
		suppressed = false,
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

	let longPressTimer: number | null = null;
	let longPressFired = false;
	const LONG_PRESS_MS = 450;

	function notifyHover(on: boolean) {
		onhover?.(on ? tipText : null);
	}

	function handleClick() {
		if (disabled) return;
		// Suppress the click that follows a long-press release on touch.
		if (longPressFired) {
			longPressFired = false;
			return;
		}
		onclick?.();
	}

	function onPointerDown(e: PointerEvent) {
		if (disabled) return;
		// Long-press is a touch-only affordance. Mouse and pen use standard click.
		if (e.pointerType !== 'touch') return;
		longPressFired = false;
		clearLongPress();
		longPressTimer = window.setTimeout(() => {
			longPressFired = true;
			notifyHover(true);
		}, LONG_PRESS_MS);
	}

	function onPointerEnd(e: PointerEvent) {
		if (e.pointerType !== 'touch') return;
		clearLongPress();
		if (longPressFired) {
			// Hide the tooltip a beat after release so the user can read it as they release.
			window.setTimeout(() => notifyHover(false), 100);
		}
	}

	function clearLongPress() {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
	}

	function onFocus(e: FocusEvent) {
		// Only fire tooltip on keyboard focus — not on the focus that follows a tap on touch.
		const t = e.target as HTMLElement;
		if (t && typeof t.matches === 'function' && t.matches(':focus-visible')) {
			notifyHover(true);
		}
	}
</script>

<button
	type="button"
	onclick={handleClick}
	onmouseenter={() => notifyHover(true)}
	onmouseleave={() => notifyHover(false)}
	onpointerdown={onPointerDown}
	onpointerup={onPointerEnd}
	onpointercancel={onPointerEnd}
	onpointerleave={onPointerEnd}
	oncontextmenu={(e) => e.preventDefault()}
	onfocus={onFocus}
	onblur={() => notifyHover(false)}
	class="card-touch relative {dims[size]} rounded-lg shadow-md font-semibold transition-all select-none cursor-pointer
		{isJester ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white' : 'bg-white'}
		{isRed && !isJester ? 'text-red-600' : ''}
		{!isRed && !isJester ? 'text-slate-900' : ''}
		{selected ? 'ring-4 ring-amber-400 -translate-y-2 shadow-xl' : 'card-lift'}
		{!selected && emphasis === 'suggest' ? 'ring-2 ring-emerald-400/80' : ''}
		{disabled ? 'opacity-40 cursor-not-allowed' : ''}
		{dim && !selected ? 'opacity-30 grayscale' : ''}"
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
	{#if suppressed}
		<!-- Royal is immune to this card's suit. The card still attacks for value, but the
			 suit power won't fire. Overlay a red X across the center pip so it reads as
			 "this aspect won't activate" without making the whole card look unplayable. -->
		<div
			class="absolute inset-0 flex items-center justify-center pointer-events-none"
			title="The royal is immune to this suit — the card still attacks, but its power won't fire"
			aria-label="{card.suit} power suppressed by royal immunity"
		>
			<svg viewBox="0 0 24 24" class="suit-x w-2/3 h-2/3 stroke-red-600 drop-shadow" fill="none" stroke-width="3" stroke-linecap="round">
				<line x1="5" y1="5" x2="19" y2="19" />
				<line x1="19" y1="5" x2="5" y2="19" />
			</svg>
		</div>
	{/if}
</button>

<style>
	/* Suppress iOS long-press text-selection callout and Android long-press menu. */
	:global(.card-touch) {
		-webkit-touch-callout: none;
		-webkit-user-select: none;
		user-select: none;
		touch-action: manipulation;
	}
	:global(.card-touch *) {
		-webkit-user-select: none;
		user-select: none;
		pointer-events: none;
	}
	/* Hover-lift only on devices that actually have hover (mouse/trackpad).
	   Touch taps would otherwise trigger the lift, which feels laggy. */
	@media (hover: hover) {
		:global(.card-lift:hover) {
			transform: translateY(-0.25rem);
		}
	}

	/* Suppressed-suit X overlay drawn slightly larger than the pip so the strokes read
	   even on the smallest card size without being so big they swallow the whole card. */
	:global(.suit-x) {
		filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.4));
	}
</style>
