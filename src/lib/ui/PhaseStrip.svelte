<script lang="ts">
	import type { Phase } from '$lib/engine';

	interface Props {
		phase: Phase;
	}
	let { phase }: Props = $props();

	const steps: { id: Phase | 'resolve'; label: string }[] = [
		{ id: 'play', label: '1. Play' },
		{ id: 'resolve', label: '2. Resolve' },
		{ id: 'damage', label: '3. Take damage' }
	];

	function isActive(id: Phase | 'resolve') {
		if (id === 'resolve') return false;
		return id === phase;
	}
</script>

<div class="flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm px-2">
	{#each steps as step, i}
		<div
			class="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full transition-colors {isActive(step.id)
				? 'bg-amber-400 text-slate-900 font-semibold'
				: 'bg-slate-800 text-slate-400'}"
		>
			{step.label}
		</div>
		{#if i < steps.length - 1}
			<span class="text-slate-600">›</span>
		{/if}
	{/each}
</div>
