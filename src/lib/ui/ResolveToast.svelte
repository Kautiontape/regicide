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
		class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md bg-slate-900/95 border border-amber-400/50 shadow-2xl rounded-lg p-4 animate-in"
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
	@keyframes fade-up {
		from {
			opacity: 0;
			transform: translate(-50%, 12px);
		}
		to {
			opacity: 1;
			transform: translate(-50%, 0);
		}
	}
	.animate-in {
		animation: fade-up 0.25s ease-out;
	}
</style>
