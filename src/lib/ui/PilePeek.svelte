<script lang="ts">
	import type { Card as CardType } from '$lib/engine';
	import Card from './Card.svelte';

	interface Props {
		title: string;
		cards: CardType[];
		/** When true, sorts the cards by suit then rank for an unordered view (tavern). */
		sorted?: boolean;
		/** Subtitle / hint shown below the title. */
		hint?: string;
		onclose: () => void;
	}

	let { title, cards, sorted = false, hint, onclose }: Props = $props();

	const SUIT_ORDER: Record<string, number> = { hearts: 0, clubs: 1, diamonds: 2, spades: 3 };
	const RANK_ORDER: Record<string, number> = {
		A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
		J: 11, Q: 12, K: 13, JESTER: 99
	};

	const display = $derived.by(() => {
		if (!sorted) return [...cards].reverse(); // pile order: most recent (top) first
		return [...cards].sort((a, b) => {
			const sa = a.suit ? SUIT_ORDER[a.suit] : 99;
			const sb = b.suit ? SUIT_ORDER[b.suit] : 99;
			if (sa !== sb) return sa - sb;
			return RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
		});
	});

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			onclose();
		}
	}
</script>

<svelte:window onkeydown={onKey} />

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	class="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6"
	role="dialog"
	aria-modal="true"
	aria-label={title}
	onclick={onclose}
	tabindex="-1"
>
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="max-w-3xl w-full max-h-[85vh] sm:max-h-[80vh] bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col gap-3"
		onclick={(e) => e.stopPropagation()}
		role="document"
	>
		<div class="flex items-start justify-between">
			<div>
				<div class="text-lg font-bold text-amber-300">{title}</div>
				{#if hint}<div class="text-xs text-slate-400 mt-0.5">{hint}</div>{/if}
				<div class="text-xs text-slate-500 mt-0.5">{cards.length} card{cards.length === 1 ? '' : 's'}</div>
			</div>
			<button
				type="button"
				onclick={onclose}
				class="text-slate-400 hover:text-slate-100 text-xl leading-none px-2"
				title="Close (Esc)"
			>
				✕
			</button>
		</div>

		<div class="flex-1 overflow-y-auto pr-1">
			{#if display.length === 0}
				<div class="text-sm text-slate-500 italic py-8 text-center">empty</div>
			{:else}
				<div class="flex gap-1.5 flex-wrap">
					{#each display as c (c.id)}
						<Card card={c} size="sm" disabled />
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
