<script lang="ts">
	import { game } from '$lib/store.svelte';

	let jesters: 0 | 1 | 2 = $state(0);
	let tutorial = $state(true);

	$effect(() => {
		if (typeof localStorage === 'undefined') return;
		// Default the tutorial to off if the player has dismissed it before.
		if (localStorage.getItem('regicide:tutorialDone:v1') === '1') tutorial = false;
	});

	function start() {
		game.start({ jesters, handSize: 8, tutorial });
	}
</script>

<div class="min-h-screen flex items-center justify-center p-6">
	<div class="max-w-md w-full bg-slate-900/80 border border-slate-700 rounded-2xl p-8 shadow-2xl">
		<h1 class="text-4xl font-bold tracking-tight text-white mb-1">Regicide</h1>
		<p class="text-slate-400 mb-6">Solo. A standard 52-card deck. Twelve royals. Don't die.</p>

		<div class="space-y-5">
			<div>
				<div class="text-sm font-medium text-slate-200 mb-2">Difficulty (Jesters)</div>
				<div class="grid grid-cols-3 gap-2">
					{#each [0, 1, 2] as n}
						<button
							type="button"
							onclick={() => (jesters = n as 0 | 1 | 2)}
							class="rounded-lg py-2 text-sm transition-colors {jesters === n
								? 'bg-amber-400 text-slate-900 font-semibold'
								: 'bg-slate-800 text-slate-300 hover:bg-slate-700'}"
						>
							{n} Jester{n === 1 ? '' : 's'}
						</button>
					{/each}
				</div>
				<div class="text-xs text-slate-500 mt-2">
					{#if jesters === 0}Hardest: no immunity-canceling.{/if}
					{#if jesters === 1}One Jester to break a royal's immunity once.{/if}
					{#if jesters === 2}Easiest: two Jesters to break immunities.{/if}
				</div>
			</div>

			<label class="flex items-center gap-2 text-sm text-slate-200 cursor-pointer select-none">
				<input
					type="checkbox"
					bind:checked={tutorial}
					class="w-4 h-4 rounded accent-amber-400"
				/>
				<span>Tutorial mode <span class="text-slate-500 text-xs">— guided callouts on the first 2-3 turns</span></span>
			</label>

			<button
				type="button"
				onclick={start}
				class="w-full bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold py-3 rounded-lg transition-colors"
			>
				Begin
			</button>
		</div>

		<div class="mt-6 text-xs text-slate-500 leading-relaxed border-t border-slate-800 pt-4">
			<p class="mb-1">First turn? Play a single card to attack the Jack. Suits do things:</p>
			<p>♥ heal · ♦ draw · ♣ double damage · ♠ shield. Tooltips will explain as you go.</p>
		</div>
	</div>
</div>
