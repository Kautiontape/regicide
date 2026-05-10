<script lang="ts">
	interface Props {
		owed: number;
		selected: number;
		baseAttack: number;
		shield: number;
		canPay: boolean;
	}

	let { owed, selected, baseAttack, shield, canPay }: Props = $props();

	const covered = $derived(Math.min(selected, owed));
	const pct = $derived(owed === 0 ? 100 : Math.min(100, (selected / owed) * 100));
	const enough = $derived(selected >= owed);
</script>

<div class="bg-slate-900/85 border border-slate-700 rounded-xl p-3 max-w-2xl w-full mx-auto shadow-lg">
	<div class="flex items-center justify-between text-xs text-slate-400 mb-1">
		<div>
			Royal hits for <span class="text-red-300 font-semibold">{baseAttack}</span>
			{#if shield > 0}
				<span class="text-blue-300">− {shield} shield</span>
				= <span class="text-red-300 font-semibold">{owed}</span>
			{/if}
		</div>
		<div>
			{#if owed === 0}
				<span class="text-emerald-300 font-semibold">Fully shielded</span>
			{:else if !canPay}
				<span class="text-red-400 font-semibold">Cannot cover</span>
			{:else}
				<span class={enough ? 'text-emerald-300 font-semibold' : 'text-slate-200'}>
					{selected} / {owed}
				</span>
			{/if}
		</div>
	</div>
	<div class="h-2 bg-slate-800 rounded-full overflow-hidden">
		<div
			class="h-full transition-all rounded-full {enough
				? 'bg-emerald-400'
				: 'bg-amber-400'}"
			style="width: {pct}%"
		></div>
	</div>
</div>
