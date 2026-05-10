<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		startedAt: number;
		/** When set, the timer freezes at this timestamp (game over → endedAt). */
		endedAt?: number | null;
		/** When false, the timer freezes at the most recent tick. Ignored if endedAt is set. */
		running?: boolean;
	}
	let { startedAt, endedAt = null, running = true }: Props = $props();

	let now = $state(Date.now());
	let interval: number | null = null;

	onMount(() => {
		// Tick once a second. Cheap; no need for rAF here since we only show mm:ss.
		interval = window.setInterval(() => {
			if (running && endedAt === null) now = Date.now();
		}, 1000);
		return () => {
			if (interval !== null) clearInterval(interval);
		};
	});

	const elapsedMs = $derived(Math.max(0, (endedAt ?? now) - startedAt));

	function fmt(ms: number): string {
		const totalSec = Math.floor(ms / 1000);
		const h = Math.floor(totalSec / 3600);
		const m = Math.floor((totalSec % 3600) / 60);
		const s = totalSec % 60;
		const pad = (n: number) => n.toString().padStart(2, '0');
		return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
	}

	const label = $derived(fmt(elapsedMs));
</script>

<span class="font-mono tabular-nums" title="Match elapsed time">{label}</span>
