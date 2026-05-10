<script lang="ts">
	import { onMount } from 'svelte';
	import { game } from '$lib/store.svelte';
	import { checkCombo, forecast, type Card as CardType } from '$lib/engine';
	import Card from './Card.svelte';
	import Royal from './Royal.svelte';
	import PhaseStrip from './PhaseStrip.svelte';
	import Log from './Log.svelte';
	import ResolveToast from './ResolveToast.svelte';
	import Forecast from './Forecast.svelte';
	import DamageMeter from './DamageMeter.svelte';
	import Legend from './Legend.svelte';
	import Tutorial from './Tutorial.svelte';
	import PilePeek from './PilePeek.svelte';

	const gs = $derived(game.state);
	const selected = $derived(game.selected);

	// Stable hand sort: suit (alternating colors for scanability) then rank ascending; jesters last.
	const SUIT_ORDER: Record<string, number> = { hearts: 0, clubs: 1, diamonds: 2, spades: 3 };
	const RANK_ORDER: Record<string, number> = {
		A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
		J: 11, Q: 12, K: 13, JESTER: 99
	};
	function sortHand(hand: CardType[]): CardType[] {
		return [...hand].sort((a, b) => {
			const sa = a.suit ? SUIT_ORDER[a.suit] : 99;
			const sb = b.suit ? SUIT_ORDER[b.suit] : 99;
			if (sa !== sb) return sa - sb;
			return RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
		});
	}
	const sortedHand = $derived(gs ? sortHand(gs.hand) : []);

	let hoverTip: string | null = $state(null);
	let openPile: 'tavern' | 'discard' | null = $state(null);

	// What's currently selected — is it a legal combo?
	const selectedCards = $derived(gs ? gs.hand.filter((c) => selected.includes(c.id)) : []);
	const combo = $derived(selected.length > 0 ? checkCombo(selectedCards) : null);

	// In play phase: which cards in hand are illegal to add to the current selection?
	function isAddable(c: CardType): boolean {
		if (!gs || gs.phase !== 'play') return true;
		if (selected.includes(c.id)) return true; // already selected → can deselect
		const candidate = [...selectedCards, c];
		return checkCombo(candidate).ok;
	}

	// Live forecast for the play phase.
	const fc = $derived(gs && gs.phase === 'play' ? forecast(gs, selected) : null);

	// In damage phase: what does the selection cover?
	const selectedSum = $derived(selectedCards.reduce((s, c) => s + c.value, 0));
	const damageOwed = $derived(game.effectiveAttack);
	const baseAttack = $derived(gs?.currentEnemy?.attack ?? 0);

	// In damage phase with selection empty, surface the auto-pick set as green outlines.
	const suggestedSet = $derived(
		gs && gs.phase === 'damage' && damageOwed > 0 && selected.length === 0
			? new Set(game.suggestedDiscards)
			: new Set<string>()
	);

	const hint = $derived(buildHint());

	function buildHint(): string {
		if (!gs) return '';
		if (gs.phase === 'won') return 'You defeated all 12 royals.';
		if (gs.phase === 'lost') return 'The royals win this round.';
		if (gs.phase === 'play') {
			if (selected.length === 0) return 'Pick a card to play, or a legal combo.';
			if (combo && !combo.ok) return combo.reason;
			return '';
		}
		if (gs.phase === 'damage') {
			if (damageOwed === 0) return 'No damage this turn — your shields covered it. End turn.';
			if (!game.canPay) return `Cannot cover ${damageOwed} damage. Game over.`;
			if (selectedSum >= damageOwed) return `Discard ${selectedCards.length} card(s) for ${selectedSum} (≥ ${damageOwed}).`;
			return `Need to discard cards summing ≥ ${damageOwed}. Currently ${selectedSum}.`;
		}
		return '';
	}

	function play() {
		game.commitPlay();
	}

	function takeDamage() {
		game.commitDamage(selected);
		// Selection is owned by the store; clear local references via store API.
	}

	function autoPickDiscards() {
		const ids = game.suggestedDiscards;
		game.clearSelection();
		for (const id of ids) game.toggleSelect(id);
	}

	function endTurnNoDamage() {
		game.commitDamage([]);
	}

	function newGame() {
		game.abandon();
	}

	function selectCard(c: CardType) {
		if (!gs) return;
		const isSel = selected.includes(c.id);
		if (gs.phase === 'play' && !isSel && !isAddable(c)) {
			// Clicking an invalid card swaps the selection to just this card.
			game.replaceSelection(c.id);
			return;
		}
		game.toggleSelect(c.id);
	}

	// Keyboard shortcuts: digit keys 1..9 toggle the corresponding hand slot.
	// Enter plays / discards. Escape clears selection.
	function onKey(e: KeyboardEvent) {
		if (!gs) return;
		// Ignore keypresses while typing in inputs/textareas.
		const target = e.target as HTMLElement | null;
		if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

		if (e.key === 'Escape') {
			game.clearSelection();
			return;
		}
		if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
			if (gs.phase === 'play' && combo && combo.ok) {
				e.preventDefault();
				play();
			} else if (gs.phase === 'damage') {
				e.preventDefault();
				if (damageOwed === 0) endTurnNoDamage();
				else if (selectedSum >= damageOwed) takeDamage();
			}
			return;
		}
		const n = parseInt(e.key, 10);
		if (Number.isFinite(n) && n >= 1 && n <= 9) {
			const idx = n - 1;
			if (idx < sortedHand.length) {
				e.preventDefault();
				selectCard(sortedHand[idx]);
			}
		}
	}

	onMount(() => {
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});
</script>

{#if gs}
	<div class="min-h-screen bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col">
		<!-- Top bar -->
		<header class="flex items-center justify-between px-6 py-3 border-b border-slate-800/60">
			<div class="flex items-center gap-4">
				<h1 class="font-bold tracking-tight text-lg">Regicide</h1>
				<div class="text-xs text-slate-400">
					Turn {gs.turn} · {gs.castleDeck.length + (gs.currentEnemy ? 1 : 0)} royal{gs.castleDeck.length === 0 ? '' : 's'} remain
				</div>
			</div>
			<button
				onclick={newGame}
				class="text-xs text-slate-400 hover:text-amber-300 underline-offset-2 hover:underline"
			>
				new game
			</button>
		</header>

		<!-- Phase strip -->
		<div class="py-3 border-b border-slate-800/40">
			<PhaseStrip phase={gs.phase} {hint} />
		</div>

		<!-- Main play area -->
		<main class="flex-1 flex">
			<!-- Center column -->
			<div class="flex-1 flex flex-col items-center justify-between p-6 gap-4 relative">
				{#if hoverTip}
					<div
						role="tooltip"
						class="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 max-w-sm px-4 py-3 rounded-lg bg-slate-900/95 border border-amber-400/40 text-slate-100 text-sm leading-snug shadow-2xl tooltip-fade"
					>
						{hoverTip}
					</div>
				{/if}

				{#if gs.currentEnemy}
					<Royal
						royal={gs.currentEnemy}
						shield={game.shield}
						immunityCancelled={gs.immunityCancelled}
						onhover={(t) => (hoverTip = t)}
					/>
				{:else if gs.phase === 'won'}
					<div class="text-3xl font-bold text-amber-300">VICTORY</div>
				{:else if gs.phase === 'lost'}
					<div class="text-3xl font-bold text-red-400">DEFEATED</div>
				{/if}

				<!-- Played cards this battle -->
				{#if gs.playedThisBattle.length > 0}
					<div class="flex flex-col items-center gap-1">
						<div class="text-xs text-slate-400 uppercase tracking-wider">Played this battle</div>
						<div class="flex gap-1 flex-wrap justify-center max-w-2xl">
							{#each gs.playedThisBattle as c (c.id)}
								<Card card={c} size="sm" disabled />
							{/each}
						</div>
					</div>
				{/if}

				<!-- Forecast / damage meter -->
				<div class="w-full px-2">
					{#if gs.phase === 'play' && fc}
						<Forecast
							forecast={fc}
							currentShield={game.shield}
							currentEnemyAtk={game.effectiveAttack}
						/>
					{:else if gs.phase === 'damage' && gs.currentEnemy}
						<DamageMeter
							owed={damageOwed}
							selected={selectedSum}
							baseAttack={baseAttack}
							shield={game.shield}
							canPay={game.canPay}
						/>
					{/if}
				</div>

				<!-- Hand -->
				<div class="flex flex-col items-center gap-3 w-full">
					<div class="flex items-center gap-2">
						{#if gs.phase === 'play'}
							<button
								onclick={play}
								disabled={!combo || !combo.ok}
								class="px-5 py-2 rounded-lg font-semibold transition-colors {combo && combo.ok
									? 'bg-amber-400 hover:bg-amber-300 text-slate-900'
									: 'bg-slate-800 text-slate-500 cursor-not-allowed'}"
							>
								Play
							</button>
						{:else if gs.phase === 'damage'}
							{#if damageOwed === 0}
								<button
									onclick={endTurnNoDamage}
									class="px-5 py-2 rounded-lg font-semibold bg-amber-400 hover:bg-amber-300 text-slate-900"
								>
									End turn
								</button>
							{:else if !game.canPay}
								<button
									onclick={() => game.abandon()}
									class="px-5 py-2 rounded-lg font-semibold bg-red-500 hover:bg-red-400 text-white"
								>
									Concede
								</button>
							{:else}
								<button
									onclick={autoPickDiscards}
									class="px-3 py-2 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 text-slate-200"
								>
									Auto-pick
								</button>
								<button
									onclick={takeDamage}
									disabled={selectedSum < damageOwed}
									class="px-5 py-2 rounded-lg font-semibold transition-colors {selectedSum >= damageOwed
										? 'bg-amber-400 hover:bg-amber-300 text-slate-900'
										: 'bg-slate-800 text-slate-500 cursor-not-allowed'}"
								>
									Discard
								</button>
							{/if}
						{:else if gs.phase === 'won' || gs.phase === 'lost'}
							<button
								onclick={newGame}
								class="px-5 py-2 rounded-lg font-semibold bg-amber-400 hover:bg-amber-300 text-slate-900"
							>
								New game
							</button>
						{/if}
					</div>

					<div class="flex items-end gap-3 justify-center pb-8 relative">
						<!-- Hand size badge -->
						<div class="absolute right-0 -top-2 flex items-center gap-1 text-xs text-slate-400">
							<span class="font-bold text-slate-200 text-base">{gs.hand.length}</span>
							<span>/ {gs.config.handSize}</span>
						</div>

						{#each sortedHand as c, i (c.id)}
							{@const isSel = selected.includes(c.id)}
							{@const inactive = gs.phase === 'play' && !isAddable(c)}
							<div class="flex flex-col items-center gap-1">
								<Card
									card={c}
									selected={isSel}
									disabled={gs.phase !== 'play' && gs.phase !== 'damage'}
									dim={inactive}
									emphasis={!isSel && suggestedSet.has(c.id) ? 'suggest' : null}
									onclick={() => selectCard(c)}
									onhover={(t) => (hoverTip = t)}
								/>
								{#if i < 9}
									<kbd
										class="text-[10px] font-mono px-1.5 py-0.5 rounded border {isSel
											? 'border-amber-400/70 text-amber-300'
											: 'border-slate-700 text-slate-500'}"
									>
										{i + 1}
									</kbd>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- Sidebar: deck counts + log -->
			<aside class="w-72 border-l border-slate-800/60 p-4 flex flex-col gap-4 bg-slate-950/40">
				<div class="grid grid-cols-2 gap-2 text-xs">
					<button
						type="button"
						onclick={() => (openPile = 'tavern')}
						class="bg-slate-800/60 hover:bg-slate-800 rounded p-2 text-left cursor-pointer transition-colors"
						title="Peek at the tavern (unordered)"
					>
						<div class="text-slate-400 flex items-center gap-1">
							<span>Tavern</span>
							<span class="text-slate-500">⊙</span>
						</div>
						<div class="text-xl font-bold">{gs.tavernDeck.length}</div>
					</button>
					<button
						type="button"
						onclick={() => (openPile = 'discard')}
						class="bg-slate-800/60 hover:bg-slate-800 rounded p-2 text-left cursor-pointer transition-colors"
						title="View the discard pile"
					>
						<div class="text-slate-400 flex items-center gap-1">
							<span>Discard</span>
							<span class="text-slate-500">⊙</span>
						</div>
						<div class="text-xl font-bold">{gs.discardPile.length}</div>
					</button>
					<div class="bg-slate-800/60 rounded p-2">
						<div class="text-slate-400">Hand</div>
						<div class="text-xl font-bold">{gs.hand.length} / {gs.config.handSize}</div>
					</div>
					<div class="bg-slate-800/60 rounded p-2">
						<div class="text-slate-400">Royals left</div>
						<div class="text-xl font-bold">{gs.castleDeck.length + (gs.currentEnemy ? 1 : 0)}</div>
					</div>
				</div>

				<Legend />

				<Log entries={gs.log} />
			</aside>
		</main>

		<!-- Resolve toast: shows the most recent play's activations + rule explanations -->
		<ResolveToast />
		<Tutorial />

		{#if openPile === 'tavern'}
			<PilePeek
				title="Tavern deck"
				cards={gs.tavernDeck}
				sorted
				hint="Cards left in the draw pile, shown in arbitrary order. Draw order is hidden."
				onclose={() => (openPile = null)}
			/>
		{:else if openPile === 'discard'}
			<PilePeek
				title="Discard pile"
				cards={gs.discardPile}
				hint="Most recent on top. ♥ heal returns cards from the top of this pile."
				onclose={() => (openPile = null)}
			/>
		{/if}
	</div>
{/if}

<style>
	@keyframes tooltip-in {
		from {
			opacity: 0;
			transform: translate(-50%, calc(-50% + 4px));
		}
		to {
			opacity: 1;
			transform: translate(-50%, -50%);
		}
	}
	:global(.tooltip-fade) {
		animation: tooltip-in 0.12s ease-out;
	}
</style>
