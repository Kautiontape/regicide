<script lang="ts">
	import type { LogEntry } from '$lib/engine';

	interface Props {
		entries: LogEntry[];
	}
	let { entries }: Props = $props();

	const recent = $derived(entries.slice(-30).reverse());

	const ICON: Record<LogEntry['kind'], string> = {
		play: '▶',
		yield: '⏭',
		jester: '★',
		heal: '♥',
		draw: '♦',
		shield: '♠',
		double: '♣',
		damage: '⚔',
		defeat: '✓',
		newRoyal: '👑',
		win: '🏆',
		lose: '💀',
		discard: '–'
	};

	const COLOR: Partial<Record<LogEntry['kind'], string>> = {
		heal: 'text-red-400',
		draw: 'text-amber-300',
		shield: 'text-blue-300',
		double: 'text-emerald-300',
		damage: 'text-red-300',
		defeat: 'text-amber-300',
		newRoyal: 'text-amber-200',
		win: 'text-amber-300',
		lose: 'text-red-400',
		jester: 'text-purple-300'
	};
</script>

<div class="flex-1 flex flex-col gap-1 overflow-hidden">
	<div class="text-xs uppercase tracking-wider text-slate-400">Log</div>
	<div class="flex-1 overflow-y-auto text-xs space-y-1 pr-1">
		{#each recent as e}
			<div class="flex gap-2 {COLOR[e.kind] ?? 'text-slate-300'}">
				<span class="opacity-70 w-4 text-center">{ICON[e.kind]}</span>
				<span class="flex-1 leading-snug">{e.text}</span>
			</div>
		{/each}
	</div>
</div>
