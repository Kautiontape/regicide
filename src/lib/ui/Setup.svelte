<script lang="ts">
	import { game } from '$lib/store.svelte';
	import { loadHistory, summarize, formatDuration } from '$lib/history';

	const JESTERS_KEY = 'regicide:jesters:v1';

	let jesters: 0 | 1 | 2 = $state(0);
	let tutorial = $state(true);
	let showHistory = $state(false);
	let history = $state(loadHistory());
	const summary = $derived(summarize(history));

	$effect(() => {
		if (typeof localStorage === 'undefined') return;
		// Restore previously chosen jester count so a fresh "new game" doesn't reset to 0.
		const saved = localStorage.getItem(JESTERS_KEY);
		const n = saved === null ? null : parseInt(saved, 10);
		if (n === 0 || n === 1 || n === 2) jesters = n;
		// Default the tutorial to off if the player has dismissed it before.
		if (localStorage.getItem('regicide:tutorialDone:v1') === '1') tutorial = false;
	});

	function pickJesters(n: 0 | 1 | 2) {
		jesters = n;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(JESTERS_KEY, String(n));
		}
	}

	function start() {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(JESTERS_KEY, String(jesters));
		}
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
							onclick={() => pickJesters(n as 0 | 1 | 2)}
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

		{#if summary.total > 0}
			<div class="mt-6 border-t border-slate-800 pt-4">
				<div class="flex items-center justify-between mb-3">
					<div class="text-sm font-medium text-slate-200">History</div>
					<button
						type="button"
						onclick={() => (showHistory = !showHistory)}
						class="text-xs text-slate-400 hover:text-amber-300 underline-offset-2 hover:underline"
					>
						{showHistory ? 'hide' : `${history.length} game${history.length === 1 ? '' : 's'}`}
					</button>
				</div>
				<div class="grid grid-cols-3 gap-2 text-xs">
					<div class="bg-slate-800/60 rounded p-2">
						<div class="text-slate-400 text-[10px] uppercase tracking-wider">Wins</div>
						<div class="text-base font-bold text-amber-300">
							{summary.wins}
							<span class="text-[11px] text-slate-400 font-normal">/ {summary.total}</span>
						</div>
					</div>
					<div class="bg-slate-800/60 rounded p-2">
						<div class="text-slate-400 text-[10px] uppercase tracking-wider">Best turns</div>
						<div class="text-base font-bold text-slate-200">
							{summary.bestTurns ?? '—'}
						</div>
					</div>
					<div class="bg-slate-800/60 rounded p-2">
						<div class="text-slate-400 text-[10px] uppercase tracking-wider">Best time</div>
						<div class="text-base font-bold text-slate-200 font-mono tabular-nums">
							{summary.bestTimeMs === null ? '—' : formatDuration(summary.bestTimeMs)}
						</div>
					</div>
				</div>

				{#if showHistory}
					<div class="mt-3 max-h-60 overflow-y-auto space-y-1.5 pr-1">
						{#each [...history].reverse() as r (r.startedAt)}
							<div
								class="flex items-center justify-between gap-2 text-xs bg-slate-800/40 border border-slate-700/60 rounded px-2.5 py-1.5"
							>
								<div class="flex items-center gap-2 min-w-0">
									{#if r.outcome === 'won'}
										<span class="text-amber-300 font-bold">W</span>
									{:else}
										<span class="text-red-400 font-bold">L</span>
									{/if}
									<span class="text-slate-300">
										{r.turns}T
										<span class="text-slate-500">·</span>
										<span class="font-mono tabular-nums">{formatDuration(r.elapsedMs)}</span>
										<span class="text-slate-500">·</span>
										{r.jesters}J
									</span>
								</div>
								<div class="text-slate-500 text-[11px] whitespace-nowrap">
									{r.outcome === 'lost' ? `${r.royalsDefeated}/12 royals` : ''}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
