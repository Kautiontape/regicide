<script lang="ts">
	import type { GameState } from '$lib/engine';
	import { formatDuration } from '$lib/history';

	interface Props {
		state: GameState;
		onNewGame: () => void;
	}
	let { state, onNewGame }: Props = $props();

	const elapsedMs = $derived(
		Math.max(0, (state.endedAt ?? Date.now()) - state.startedAt)
	);

	const enemy = $derived(state.currentEnemy);
	const baseAttack = $derived(enemy?.attack ?? 0);
	const shield = $derived(
		state.playedThisBattle.filter((c) => c.suit === 'spades').reduce((s, c) => s + c.value, 0)
	);
	const damageOwed = $derived(Math.max(0, baseAttack - shield));
	const handTotal = $derived(state.hand.reduce((s, c) => s + c.value, 0));
	const shortBy = $derived(Math.max(0, damageOwed - handTotal));
	const royalsRemaining = $derived(state.castleDeck.length + (enemy ? 1 : 0));

	function rankName(r: 'J' | 'Q' | 'K') {
		return r === 'J' ? 'Jack' : r === 'Q' ? 'Queen' : 'King';
	}
</script>

<div
	class="fixed inset-0 z-40 flex flex-col items-center justify-center p-6 overflow-hidden bg-slate-950/85 backdrop-blur-sm"
	role="status"
	aria-live="polite"
>
	<div class="relative flex flex-col items-center gap-4 sm:gap-5 max-w-md w-full">
		<div class="text-center">
			<div class="text-4xl sm:text-5xl font-bold text-red-400 tracking-tight defeat-pop">
				Defeated
			</div>
			<div class="text-sm sm:text-base text-slate-300 mt-1">
				{#if enemy}
					The {rankName(enemy.rank)} of {enemy.suit} hits harder than you can block.
				{:else}
					The royals win this round.
				{/if}
			</div>
		</div>

		<!-- Damage math: shows exactly why this play could not be defended. -->
		{#if enemy}
			<div class="w-full bg-slate-900/70 border border-slate-700 rounded-xl p-4 flex flex-col gap-1.5 text-sm sm:text-base">
				<div class="flex justify-between text-slate-300">
					<span>Royal attack</span>
					<span class="font-mono text-red-300 font-bold">{baseAttack}</span>
				</div>
				{#if shield > 0}
					<div class="flex justify-between text-slate-400">
						<span>− Shield</span>
						<span class="font-mono text-blue-300">{shield}</span>
					</div>
				{/if}
				<div class="flex justify-between text-slate-200 border-t border-slate-700 pt-1.5 mt-0.5">
					<span class="font-semibold">Damage owed</span>
					<span class="font-mono font-bold text-red-300">{damageOwed}</span>
				</div>
				<div class="flex justify-between text-slate-300 mt-2">
					<span>Max defense (full hand)</span>
					<span class="font-mono text-slate-200 font-bold">{handTotal}</span>
				</div>
				{#if shortBy > 0}
					<div class="flex justify-between text-red-300 border-t border-slate-700 pt-1.5 mt-0.5">
						<span class="font-semibold">Short by</span>
						<span class="font-mono font-bold">{shortBy}</span>
					</div>
				{/if}
			</div>
		{/if}

		<div class="text-xs text-slate-400 text-center">
			{royalsRemaining} royal{royalsRemaining === 1 ? '' : 's'} still standing
			<span class="text-slate-600">·</span>
			<span class="font-mono tabular-nums">{formatDuration(elapsedMs)}</span>
		</div>

		<button
			type="button"
			onclick={onNewGame}
			class="mt-2 px-6 py-3 rounded-lg font-bold bg-amber-400 hover:bg-amber-300 text-slate-900 transition-colors"
		>
			New game
		</button>
	</div>
</div>

<style>
	@keyframes defeat-pop {
		0% {
			opacity: 0;
			transform: translateY(-8px);
		}
		100% {
			opacity: 1;
			transform: translateY(0);
		}
	}
	:global(.defeat-pop) {
		animation: defeat-pop 0.35s ease-out both;
	}
</style>
