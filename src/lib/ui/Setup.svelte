<script lang="ts">
	import { game } from '$lib/store.svelte';
	import { loadHistory, summarize, formatDuration, tierFor, type Tier } from '$lib/history';
	import {
		dailyNumber,
		loadDailyAttempt,
		seedFor,
		todayKey,
		type DailyAttempt
	} from '$lib/daily';
	import ShareButton from './ShareButton.svelte';

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
	let confirmRetry = $state(false);
	let dailyAttempt = $state<DailyAttempt | null>(null);
	const summary = $derived(summarize(history));
	const dailyTodayNumber = $derived(dailyNumber(todayKey()));
	const dailyRecord = $derived(
		dailyAttempt?.recordRef
			? history.find((r) => r.startedAt === dailyAttempt!.recordRef) ?? null
			: null
	);

	// First-time player = no recorded games AND no prior tutorial dismissal. The two checks
	// are belt-and-braces: clearing history doesn't re-trigger the tutorial nag, and skipping
	// the tutorial without ever finishing a game also doesn't.
	let firstTime = $state(true);
	let tutorialDone = $state(false);
	$effect(() => {
		if (typeof localStorage === 'undefined') return;
		tutorialDone = localStorage.getItem('regicide:tutorialDone:v1') === '1';
		firstTime = !tutorialDone && history.length === 0;
		dailyAttempt = loadDailyAttempt();
	});

	function start(tutorial: boolean) {
		// Mark the tutorial seen the moment the player commits to a path. Skipping counts the
		// same as completing — they've made an informed choice and shouldn't be nagged again.
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('regicide:tutorialDone:v1', '1');
		}
		game.start({ jesters: STARTING_JESTERS, handSize: 8, tutorial, mode: 'normal' });
	}

	function startDaily() {
		// Daily forces tutorial off — the scripted hand would make scores incomparable. The
		// tutorial-done flag flips so a player who chose "skip tutorial and play daily" as
		// their first interaction won't see the tutorial entry on the next visit.
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('regicide:tutorialDone:v1', '1');
		}
		const date = todayKey();
		game.start(
			{
				jesters: STARTING_JESTERS,
				handSize: 8,
				tutorial: false,
				mode: 'daily',
				dailyDate: date
			},
			seedFor(date)
		);
	}

	function retryDaily() {
		confirmRetry = false;
		startDaily();
	}

</script>

<div class="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
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
				<button
					type="button"
					onclick={startDaily}
					class="w-full text-xs text-slate-500 hover:text-amber-300 underline-offset-2 hover:underline py-1"
				>
					Skip tutorial and play today's daily
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

		{#if tutorialDone}
			<!-- Daily card: shared puzzle, one canonical attempt per day, replays allowed but flagged
				 in the share text. Hidden until the player has made it through (or skipped) the
				 tutorial — daily-mode cheese-protection only matters once they actually know the rules. -->
			<div class="mt-6 border-t border-slate-800 pt-4">
				<div class="flex items-baseline justify-between mb-2">
					<div class="text-sm font-semibold text-amber-300">Daily Challenge</div>
					<div class="text-xs text-slate-500">#{dailyTodayNumber}</div>
				</div>
				{#if !dailyAttempt}
					<p class="text-xs text-slate-400 mb-3">
						Same hand as everyone else today. One run — try to climb as far as you can.
					</p>
					<button
						type="button"
						onclick={startDaily}
						class="w-full bg-slate-800 hover:bg-slate-700 ring-1 ring-amber-400/40 text-amber-200 font-semibold py-2.5 rounded-lg transition-colors"
					>
						Play today's daily
					</button>
				{:else if dailyAttempt.status === 'in-progress'}
					<!-- Surfaces only if the GameState was wiped out from under an in-progress daily
						 (rare). Normal in-progress dailies route to the Board automatically. -->
					<p class="text-xs text-slate-400 mb-3">
						You have an unfinished daily. Restarting will count as attempt
						{dailyAttempt.attemptCount + 1}.
					</p>
					<button
						type="button"
						onclick={() => (confirmRetry = true)}
						class="w-full bg-slate-800 hover:bg-slate-700 ring-1 ring-amber-400/40 text-amber-200 font-semibold py-2.5 rounded-lg transition-colors"
					>
						Restart daily
					</button>
				{:else}
					{@const tier = dailyRecord ? tierFor(dailyRecord) : null}
					<div
						class="bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 mb-3 flex items-center justify-between gap-2"
					>
						<div class="flex items-center gap-2 min-w-0 text-xs">
							{#if dailyAttempt.status === 'won'}
								<span class="text-amber-300 font-bold">W</span>
							{:else}
								<span class="text-red-300 font-bold">L</span>
							{/if}
							{#if dailyRecord}
								<span class="text-slate-300">
									{dailyAttempt.status === 'won'
										? `${dailyRecord.turns}T`
										: `${dailyRecord.royalsDefeated}/12`}
									<span class="text-slate-500">·</span>
									<span class="font-mono tabular-nums">{formatDuration(dailyRecord.elapsedMs)}</span>
								</span>
							{/if}
							{#if dailyAttempt.attemptCount > 1}
								<span class="text-slate-500" title="Retry attempt">🔁{dailyAttempt.attemptCount}</span>
							{/if}
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
					<div class="flex gap-2">
						{#if dailyRecord}
							<ShareButton record={dailyRecord} class="flex-1" />
						{/if}
						<button
							type="button"
							onclick={() => (confirmRetry = true)}
							class="px-3 py-2 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 ring-1 ring-slate-700"
							title="Replay today's daily — counts as a retry on your share text"
						>
							↻ Try again
						</button>
					</div>
				{/if}
			</div>
		{/if}

		<div class="mt-6 text-xs text-slate-500 leading-relaxed border-t border-slate-800 pt-4">
			<p class="mb-1">Solo. Twelve royals stand between you and the throne.</p>
			<p>♥ heal · ♦ draw · ♣ double damage · ♠ shield.</p>
		</div>

		{#if history.length > 0}
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
									{#if r.outcome === 'won'}
										<span class="text-amber-300 font-bold" aria-label="Victory">W</span>
									{:else}
										<span class="text-red-300 font-bold" aria-label="Defeat">L</span>
									{/if}
									<span class="text-slate-300">
										{r.outcome === 'won' ? `${r.turns}T` : `${r.royalsDefeated}/12`}
										<span class="text-slate-500">·</span>
										<span class="font-mono tabular-nums">{formatDuration(r.elapsedMs)}</span>
									</span>
									{#if r.mode === 'daily' && r.dailyDate}
										<span class="text-amber-300/70 text-[10px] font-semibold whitespace-nowrap"
											>D#{dailyNumber(r.dailyDate)}</span
										>
									{/if}
									{#if r.tutorial}
										<span title="Tutorial assist">📖</span>
									{/if}
									{#if r.attemptCount > 1}
										<span title="Retry attempt">🔁</span>
									{/if}
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

	<p class="max-w-md text-center text-xs text-slate-500 leading-relaxed">
		Unofficial digital adaptation of Regicide by Paul Abrahams, published by
		<a
			href="https://www.badgersfrommars.com/regicide"
			target="_blank"
			rel="noopener"
			class="text-amber-400/80 hover:text-amber-300 underline-offset-2 hover:underline"
		>Badgers from Mars</a>. Used under
		<a
			href="https://creativecommons.org/licenses/by/4.0/"
			target="_blank"
			rel="noopener"
			class="text-amber-400/80 hover:text-amber-300 underline-offset-2 hover:underline"
		>CC BY 4.0</a>. Buy a physical copy to support them.
	</p>
</div>

{#if confirmRetry}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="confirm-retry-title"
		tabindex="-1"
		onclick={() => (confirmRetry = false)}
	>
		<div
			class="max-w-sm w-full bg-slate-900 border border-slate-700 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4"
			onclick={(e) => e.stopPropagation()}
			role="presentation"
		>
			<div>
				<div id="confirm-retry-title" class="text-lg font-bold text-amber-300">Replay today's daily?</div>
				<div class="text-sm text-slate-300 mt-1">
					Your previous attempt will be overwritten, and your share text will be marked with 🔁.
					Tomorrow's puzzle resets the counter.
				</div>
			</div>
			<div class="flex gap-2 justify-end">
				<button
					type="button"
					onclick={() => (confirmRetry = false)}
					class="px-4 py-2 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 text-slate-200"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={retryDaily}
					class="px-4 py-2 rounded-lg text-sm bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold"
				>
					Try again
				</button>
			</div>
		</div>
	</div>
{/if}

