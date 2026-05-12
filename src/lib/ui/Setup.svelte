<script lang="ts">
	import { game } from '$lib/store.svelte';
	import { loadHistory, summarize, formatDuration, tierFor, type Tier } from '$lib/history';

	const TIER_LABEL: Record<Tier, string> = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' };
	const TIER_CLASSES: Record<Tier, string> = {
		gold: 'bg-amber-500/15 text-amber-300 ring-amber-400/40',
		silver: 'bg-slate-400/15 text-slate-200 ring-slate-300/40',
		bronze: 'bg-orange-500/15 text-orange-300 ring-orange-400/40'
	};

	// Canonical solo Regicide ships with 2 Jester abilities; tier comparison only applies at 2.
	const STARTING_JESTERS = 2 as const;

	const DATE_FMT = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

	let showHistory = $state(false);
	let history = $state(loadHistory());
	let confirmReset = $state(false);
	const summary = $derived(summarize(history));

	// First-time player = no recorded games AND no prior tutorial dismissal. The two checks
	// are belt-and-braces: clearing history doesn't re-trigger the tutorial nag, and skipping
	// the tutorial without ever finishing a game also doesn't.
	let firstTime = $state(true);
	$effect(() => {
		if (typeof localStorage === 'undefined') return;
		const tutorialDone = localStorage.getItem('regicide:tutorialDone:v1') === '1';
		firstTime = !tutorialDone && history.length === 0;
	});

	function start(tutorial: boolean) {
		// Mark the tutorial seen the moment the player commits to a path. Skipping counts the
		// same as completing — they've made an informed choice and shouldn't be nagged again.
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('regicide:tutorialDone:v1', '1');
		}
		game.start({ jesters: STARTING_JESTERS, handSize: 8, tutorial });
	}

	function resetAllData() {
		if (typeof localStorage === 'undefined') return;
		// Wipe every key the app owns. Iterating instead of removing known keys means future
		// keys (e.g. settings, daily-seed bookmarks) get cleaned up here automatically too.
		const toRemove: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key && key.startsWith('regicide:')) toRemove.push(key);
		}
		for (const key of toRemove) localStorage.removeItem(key);
		// Reload so every component (store, tutorial state, history list) re-initialises from
		// the now-empty storage instead of holding stale in-memory copies.
		location.reload();
	}
</script>

<div class="min-h-screen flex items-center justify-center p-6">
	<div class="max-w-md w-full bg-slate-900/80 border border-slate-700 rounded-2xl p-8 shadow-2xl">
		<h1 class="text-4xl font-bold tracking-tight text-white mb-1">Regicide</h1>
		<p class="text-slate-400 mb-6">Solo. A standard 52-card deck. Twelve royals. Don't die.</p>

		<div class="space-y-3">
			{#if firstTime}
				<button
					type="button"
					onclick={() => start(true)}
					class="w-full bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold py-3 rounded-lg transition-colors"
				>
					Start Tutorial
				</button>
				<button
					type="button"
					onclick={() => start(false)}
					class="w-full text-sm text-slate-400 hover:text-amber-300 underline-offset-2 hover:underline py-1"
				>
					Skip tutorial and play
				</button>
			{:else}
				<button
					type="button"
					onclick={() => start(false)}
					class="w-full bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold py-3 rounded-lg transition-colors"
				>
					Begin
				</button>
				<button
					type="button"
					onclick={() => start(true)}
					class="w-full text-xs text-slate-500 hover:text-amber-300 underline-offset-2 hover:underline py-1"
				>
					Replay tutorial
				</button>
			{/if}
		</div>

		<div class="mt-6 text-xs text-slate-500 leading-relaxed border-t border-slate-800 pt-4">
			<p class="mb-1">Solo. Twelve royals stand between you and the throne.</p>
			<p>♥ heal · ♦ draw · ♣ double damage · ♠ shield.</p>
		</div>

		{#if summary.wins === 0 && !firstTime}
			<!-- Returning player with no wins yet — surface the reset on its own so the only way
				 to recover from a corrupted state isn't to dig into devtools. -->
			<div class="mt-6 border-t border-slate-800 pt-4 flex justify-end">
				<button
					type="button"
					onclick={() => (confirmReset = true)}
					class="text-xs text-slate-500 hover:text-red-300 underline-offset-2 hover:underline"
				>
					reset all data
				</button>
			</div>
		{/if}

		{#if summary.wins > 0}
			<div class="mt-6 border-t border-slate-800 pt-4">
				<div class="flex items-center justify-between mb-3">
					<div class="text-sm font-medium text-slate-200">History</div>
					<div class="flex items-center gap-3">
						<button
							type="button"
							onclick={() => (confirmReset = true)}
							class="text-xs text-slate-500 hover:text-red-300 underline-offset-2 hover:underline"
						>
							reset
						</button>
						<button
							type="button"
							onclick={() => (showHistory = !showHistory)}
							class="text-xs text-slate-400 hover:text-amber-300 underline-offset-2 hover:underline"
						>
							{showHistory ? 'hide' : `${history.length} game${history.length === 1 ? '' : 's'}`}
						</button>
					</div>
				</div>
				<div class="grid grid-cols-3 gap-2 text-xs">
					<div class="bg-slate-800/60 rounded p-2">
						<div class="text-slate-400 text-[10px] uppercase tracking-wider">Wins</div>
						<div class="text-base font-bold text-amber-300">{summary.wins}</div>
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
							{@const tier = tierFor(r)}
							<div
								class="flex items-center justify-between gap-2 text-xs bg-slate-800/40 border border-slate-700/60 rounded px-2.5 py-1.5"
							>
								<div class="flex items-center gap-2 min-w-0">
									<span class="text-slate-500 font-mono tabular-nums w-12 shrink-0">
										{DATE_FMT.format(r.completedAt)}
									</span>
									<span class="text-amber-300 font-bold" aria-label="Victory">W</span>
									<span class="text-slate-300">
										{r.turns}T
										<span class="text-slate-500">·</span>
										<span class="font-mono tabular-nums">{formatDuration(r.elapsedMs)}</span>
									</span>
								</div>
								{#if tier}
									<span
										class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ring-1 text-[10px] font-semibold tracking-wide whitespace-nowrap {TIER_CLASSES[tier]}"
									>
										<span aria-hidden="true">★</span>
										{TIER_LABEL[tier]}
									</span>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

{#if confirmReset}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="confirm-reset-title"
		tabindex="-1"
		onclick={() => (confirmReset = false)}
	>
		<div
			class="max-w-sm w-full bg-slate-900 border border-slate-700 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4"
			onclick={(e) => e.stopPropagation()}
			role="presentation"
		>
			<div>
				<div id="confirm-reset-title" class="text-lg font-bold text-amber-300">Reset all data?</div>
				<div class="text-sm text-slate-300 mt-1">
					Wipes your win history, tutorial progress, and any in-progress game. You'll see the
					tutorial entry next time. This cannot be undone.
				</div>
			</div>
			<div class="flex gap-2 justify-end">
				<button
					type="button"
					onclick={() => (confirmReset = false)}
					class="px-4 py-2 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 text-slate-200"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={resetAllData}
					class="px-4 py-2 rounded-lg text-sm bg-red-500 hover:bg-red-400 text-white font-semibold"
				>
					Reset
				</button>
			</div>
		</div>
	</div>
{/if}
