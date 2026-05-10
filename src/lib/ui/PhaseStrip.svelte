<script lang="ts">
	import type { Phase } from '$lib/engine';

	interface Props {
		phase: Phase;
		hint: string;
	}
	let { phase, hint }: Props = $props();

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

<div class="flex flex-col gap-2 items-center">
	<div class="flex items-center gap-2 text-sm">
		{#each steps as step, i}
			<div
				class="px-3 py-1 rounded-full transition-colors {isActive(step.id)
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
	<div class="text-xs text-slate-300 italic min-h-4">{hint}</div>
</div>
