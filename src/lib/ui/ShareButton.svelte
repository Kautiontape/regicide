<script lang="ts">
	import { buildShareText, shareOrCopy } from '$lib/share';
	import type { GameRecord } from '$lib/history';

	interface Props {
		record: GameRecord;
		/** Compact "Q♥"-style label for the enemy that finished the run; only used on losses. */
		lastEnemy?: string;
		/** Tailwind classes for the button — lets the host screen match its own visual weight
		 *  (full-width amber on Victory, smaller on Defeat). Defaults to a sensible neutral. */
		class?: string;
	}
	let { record, lastEnemy, class: klass = '' }: Props = $props();

	let toast = $state<string | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | null = null;

	async function share() {
		const text = buildShareText(record, lastEnemy);
		const result = await shareOrCopy(text);
		// Native share sheets handle their own feedback, so we only flash the local toast for
		// the clipboard path. 'failed' is rare enough that we just leave the user a hint.
		if (result === 'copied') showToast('Copied to clipboard');
		else if (result === 'failed') showToast('Could not share');
	}

	function showToast(text: string) {
		toast = text;
		if (toastTimer) clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = null), 1800);
	}
</script>

<div class="relative inline-flex flex-col items-stretch gap-1 {klass}">
	<button
		type="button"
		onclick={share}
		class="px-4 py-2 rounded-lg font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 ring-1 ring-slate-700 transition-colors flex items-center justify-center gap-2"
	>
		<span aria-hidden="true">↗</span>
		<span>Share result</span>
	</button>
	{#if toast}
		<div
			class="absolute -bottom-7 left-1/2 -translate-x-1/2 text-xs text-amber-300 whitespace-nowrap"
			role="status"
			aria-live="polite"
		>
			{toast}
		</div>
	{/if}
</div>
