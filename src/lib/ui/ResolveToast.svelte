<script lang="ts">
	import { game } from '$lib/store.svelte';
	import { RULE_TEXT } from '$lib/engine';
	import type { RuleId } from '$lib/engine';

	let visible = $state(false);
	let lines = $state<{ id: RuleId; verbose: boolean }[]>([]);

	let timer: number | null = null;

	$effect(() => {
		const a = game.lastAction;
		if (!a || a.kind !== 'play') return;
		const result = a.result;
		const next: { id: RuleId; verbose: boolean }[] = [];
		for (const act of result.activations) {
			if (act.suppressed) {
				next.push({ id: 'suitImmunity', verbose: game.ruleSeen('suitImmunity') < 2 });
				continue;
			}
			let id: RuleId;
			if (act.suit === 'hearts') id = 'heartsHeal';
			else if (act.suit === 'diamonds') id = 'diamondsDraw';
			else if (act.suit === 'clubs') id = 'clubsDouble';
			else id = 'spadesShield';
			next.push({ id, verbose: game.ruleSeen(id) < 3 });
		}
		if (result.defeated) {
			const id: RuleId = result.defeated.exact ? 'exactKill' : 'overkill';
			next.push({ id, verbose: game.ruleSeen(id) < 2 });
		}
		if (next.length === 0) return;
		lines = next;
		visible = true;
		if (timer) clearTimeout(timer);
		timer = window.setTimeout(() => (visible = false), 3500);
	});
</script>

{#if visible && lines.length > 0}
	<div
		class="fixed left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-1.5rem)] sm:w-auto
			top-[42%] sm:top-auto sm:bottom-6
			bg-slate-900/95 border border-amber-400/50 shadow-2xl rounded-lg p-3 sm:p-4 animate-in"
	>
		<div class="space-y-2">
			{#each lines as line}
				<div class="text-sm">
					<span class="font-semibold text-amber-300">{RULE_TEXT[line.id].short}</span>
					{#if line.verbose}
						<div class="text-slate-300 text-xs leading-snug mt-0.5">
							{RULE_TEXT[line.id].long}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	.animate-in {
		animation: fade-in 0.2s ease-out;
	}
</style>
