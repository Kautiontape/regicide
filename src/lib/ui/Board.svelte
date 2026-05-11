<script lang="ts">
	import { onMount } from 'svelte';
	import { game } from '$lib/store.svelte';
	import { checkCombo, forecast, RULE_TEXT, type Card as CardType, type RuleId } from '$lib/engine';
	import { tutorialAdvice } from '$lib/tutorial';
	import Card from './Card.svelte';
	import Royal from './Royal.svelte';
	import PhaseStrip from './PhaseStrip.svelte';
	import Log from './Log.svelte';
	import Forecast from './Forecast.svelte';
	import DamageMeter from './DamageMeter.svelte';
	import Legend from './Legend.svelte';
	import Tutorial from './Tutorial.svelte';
	import JesterTray from './JesterTray.svelte';
	import JesterIcon from './JesterIcon.svelte';
	import PilePeek from './PilePeek.svelte';
	import InfoSlot, { type InfoKind } from './InfoSlot.svelte';
	import Victory from './Victory.svelte';
	import Defeat from './Defeat.svelte';
	import Timer from './Timer.svelte';

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

	let openPile: 'tavern' | 'discard' | null = $state(null);
	let mobileSheet: 'log' | 'legend' | null = $state(null);
	let confirmNewGame = $state(false);
	// Lifted from JesterTray so this component can suppress its own keyboard shortcuts
	// while the Jester confirmation dialog is showing.
	let jesterOpen = $state(false);

	type SlotMsg = { kind: InfoKind; text: string; detail?: string };
	let infoOverride = $state<SlotMsg | null>(null);
	let infoTimer: number | null = null;

	function setOverride(m: SlotMsg, ttlMs = 4000) {
		infoOverride = m;
		if (infoTimer) clearTimeout(infoTimer);
		infoTimer = window.setTimeout(() => {
			infoOverride = null;
			infoTimer = null;
		}, ttlMs);
	}

	function clearOverride() {
		infoOverride = null;
		if (infoTimer) {
			clearTimeout(infoTimer);
			infoTimer = null;
		}
	}

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

	// Tutorial recommendations: amber pulsing outline on cards the script wants the player
	// to act on right now. Only IDs actually present in hand survive — the helper may name
	// cards that haven't been drawn yet (e.g. 4♥ at the start of T2 before the diamond draw).
	const advice = $derived(gs ? tutorialAdvice(gs) : { play: [], discard: [] });
	const recommendedSet = $derived(() => {
		if (!gs) return new Set<string>();
		const handIds = new Set(gs.hand.map((c) => c.id));
		const ids = gs.phase === 'play' ? advice.play : gs.phase === 'damage' ? advice.discard : [];
		return new Set(ids.filter((id) => handIds.has(id)));
	});

	// During play, cards matching the royal's still-active immune suit won't trigger powers.
	const suppressedSuit = $derived(
		gs && gs.currentEnemy && !gs.immunityCancelled && gs.phase === 'play'
			? gs.currentEnemy.suit
			: null
	);

	const SUIT_RULE: Record<string, string> = {
		hearts: '♥ Heal: returns that many cards from discard to the bottom of the tavern.',
		diamonds: '♦ Draw: draw that many cards (capped at hand size).',
		clubs: '♣ Double: this attack deals double damage.',
		spades: "♠ Shield: reduce the royal's attack by that much for the rest of the battle."
	};

	function describeCard(c: CardType): SlotMsg {
		const rankLabel = c.rank === '10' ? '10' : c.rank;
		return {
			kind: 'card',
			text: `${rankLabel} of ${c.suit} · value ${c.value}`,
			detail: c.suit ? SUIT_RULE[c.suit] : undefined
		};
	}

	function describeRoyal(): SlotMsg | null {
		if (!gs?.currentEnemy) return null;
		const r = gs.currentEnemy;
		const rankLabel = r.rank === 'J' ? 'Jack' : r.rank === 'Q' ? 'Queen' : 'King';
		const remainingHP = r.maxHealth - r.damageTaken;
		const eff = Math.max(0, r.attack - game.shield);
		const detail = gs.immunityCancelled
			? 'Immunity has been cancelled by a Jester.'
			: `Immune to ${r.suit} — powers from ${r.suit} cards do not activate.`;
		return {
			kind: 'royal',
			text: `${rankLabel} of ${r.suit} · HP ${remainingHP}/${r.maxHealth} · ATK ${eff}`,
			detail
		};
	}

	function describeResolve(): SlotMsg | null {
		const a = game.lastAction;
		if (!a || a.kind !== 'play') return null;
		const result = a.result;
		const parts: string[] = [];
		for (const act of result.activations) {
			if (act.suppressed) {
				parts.push(`${act.suit} suppressed (immunity)`);
				continue;
			}
			let id: RuleId;
			if (act.suit === 'hearts') id = 'heartsHeal';
			else if (act.suit === 'diamonds') id = 'diamondsDraw';
			else if (act.suit === 'clubs') id = 'clubsDouble';
			else id = 'spadesShield';
			parts.push(RULE_TEXT[id].short);
		}
		if (result.defeated) {
			parts.push(result.defeated.exact ? '★ exact kill' : 'royal defeated');
		}
		if (parts.length === 0) return null;
		return { kind: 'resolve', text: parts.join(' · ') };
	}

	const computedSlot = $derived<SlotMsg>(buildSlot());

	function buildSlot(): SlotMsg {
		if (!gs) return { kind: 'prompt', text: '' };
		if (gs.phase === 'won') return { kind: 'success', text: 'You defeated all 12 royals.' };
		if (gs.phase === 'lost') return { kind: 'warn', text: 'The royals win this round.' };
		if (gs.phase === 'play') {
			if (selected.length === 0) return { kind: 'prompt', text: 'Pick a card to play, or a legal combo.' };
			if (combo && !combo.ok) return { kind: 'warn', text: combo.reason };
			if (selectedCards.length === 1) return describeCard(selectedCards[0]);
			if (combo && combo.ok) {
				return {
					kind: 'prompt',
					text: `Combo of ${selectedCards.length} ready`,
					detail: 'Press Play to commit.'
				};
			}
		}
		if (gs.phase === 'damage') {
			if (damageOwed === 0) return { kind: 'success', text: 'No damage this turn — your shields covered it. End turn.' };
			if (!game.canPay) return { kind: 'warn', text: `Cannot cover ${damageOwed} damage. Game over.` };
			if (selectedSum >= damageOwed)
				return {
					kind: 'success',
					text: `Discard ${selectedCards.length} card${selectedCards.length === 1 ? '' : 's'} for ${selectedSum} (≥ ${damageOwed}).`
				};
			return {
				kind: 'prompt',
				text: `Need to discard cards summing ≥ ${damageOwed}.`,
				detail: `Currently ${selectedSum}.`
			};
		}
		return { kind: 'prompt', text: '' };
	}

	const slot = $derived<SlotMsg>(infoOverride ?? computedSlot);

	// React to play resolutions: write to slot for a few seconds.
	$effect(() => {
		const msg = describeResolve();
		// We trigger on changes in lastAction. The dependency comes from describeResolve reading game.lastAction.
		if (msg) {
			setOverride(msg, 3500);
		}
	});

	// When selection changes, clear card/royal overrides so the computed slot (which
	// already describes the selected card) is what shows, not a stale hover preview.
	$effect(() => {
		// Read selected to register the dependency.
		selected.length;
		if (infoOverride?.kind === 'card' || infoOverride?.kind === 'royal') {
			clearOverride();
		}
	});

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

	// Header button doubles as "Concede" during a live game and "new game" once the run
	// has resolved. A running game asks for confirmation before surrendering; a finished
	// game just resets to the setup screen.
	const headerButtonMode = $derived<'concede' | 'reset'>(
		gs && (gs.phase === 'play' || gs.phase === 'damage') ? 'concede' : 'reset'
	);

	function headerButtonClick() {
		if (headerButtonMode === 'reset') {
			game.abandon();
			return;
		}
		confirmNewGame = true;
	}

	function confirmAbandon() {
		confirmNewGame = false;
		// Concede transitions into the 'lost' phase so the player sees the Defeat overlay
		// with the final damage math instead of being dumped back to setup.
		game.concede();
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

		// When the Jester confirmation dialog is showing, it owns all keyboard input —
		// ignore everything here so we don't simultaneously clear selection, play a combo,
		// etc., based on the same keystroke.
		if (jesterOpen) return;
		if (e.key === 'Escape') {
			if (confirmNewGame) {
				confirmNewGame = false;
				return;
			}
			if (mobileSheet) {
				mobileSheet = null;
				return;
			}
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
		// `0` is reserved for the Jester — JesterTray handles it (opens the confirmation
		// dialog rather than activating directly so the player can't burn it accidentally).
		if (e.key === '0') return;
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
	<div class="board-root bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col">
		<!-- Top bar -->
		<header class="flex items-center justify-between px-3 sm:px-6 py-2 sm:py-3 border-b border-slate-800/60 gap-2">
			<div class="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
				<h1 class="font-bold tracking-tight text-base sm:text-lg">Regicide</h1>
				<div class="text-[11px] sm:text-xs text-slate-400 truncate flex items-center gap-1.5 sm:gap-2">
					<span class="hidden sm:inline">Turn {gs.turn}</span><span class="sm:hidden">T{gs.turn}</span>
					<span class="text-slate-600">·</span>
					<Timer startedAt={gs.startedAt} endedAt={gs.endedAt} />
					<span class="text-slate-600 hidden sm:inline">·</span>
					<span class="hidden sm:inline">{gs.castleDeck.length + (gs.currentEnemy ? 1 : 0)} royal{gs.castleDeck.length === 0 ? '' : 's'} left</span>
				</div>
			</div>
			<div class="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
				<!-- Mobile: open Log/Legend sheet -->
				<button
					onclick={() => (mobileSheet = mobileSheet === 'legend' ? null : 'legend')}
					class="md:hidden text-slate-400 hover:text-amber-300 w-8 h-8 rounded text-sm border border-slate-800/80 flex items-center justify-center"
					aria-label="Show powers and rules"
					title="Powers"
				>
					?
				</button>
				<button
					onclick={() => (mobileSheet = mobileSheet === 'log' ? null : 'log')}
					class="md:hidden text-slate-400 hover:text-amber-300 w-8 h-8 rounded text-sm border border-slate-800/80 flex items-center justify-center"
					aria-label="Show log"
					title="Log"
				>
					≡
				</button>
				<button
					onclick={headerButtonClick}
					class="whitespace-nowrap flex-shrink-0
						md:text-xs md:underline-offset-2 md:hover:underline
						w-8 h-8 md:w-auto md:h-auto rounded md:rounded-none border md:border-0 border-slate-800/80
						flex items-center justify-center text-base md:text-xs
						{headerButtonMode === 'concede'
							? 'text-red-300 hover:text-red-200'
							: 'text-slate-400 hover:text-amber-300'}"
					aria-label={headerButtonMode === 'concede' ? 'Concede' : 'New game'}
					title={headerButtonMode === 'concede' ? 'Concede' : 'New game'}
				>
					{#if headerButtonMode === 'concede'}
						<span class="md:hidden" aria-hidden="true">⚑</span>
						<span class="hidden md:inline">concede</span>
					{:else}
						<span class="md:hidden" aria-hidden="true">↻</span>
						<span class="hidden md:inline">new game</span>
					{/if}
				</button>
			</div>
		</header>

		<!-- Mobile compact stats strip -->
		<div class="md:hidden grid grid-cols-4 gap-1 px-2 py-1.5 border-b border-slate-800/40 text-[11px]">
			<button
				type="button"
				onclick={() => (openPile = 'tavern')}
				class="bg-slate-800/60 active:bg-slate-700 rounded px-2 py-1 text-left"
			>
				<div class="text-slate-400 leading-tight">Tavern ⊙</div>
				<div class="text-base font-bold leading-tight">{gs.tavernDeck.length}</div>
			</button>
			<button
				type="button"
				onclick={() => (openPile = 'discard')}
				class="bg-slate-800/60 active:bg-slate-700 rounded px-2 py-1 text-left"
			>
				<div class="text-slate-400 leading-tight">Discard ⊙</div>
				<div class="text-base font-bold leading-tight">{gs.discardPile.length}</div>
			</button>
			<div class="bg-slate-800/60 rounded px-2 py-1">
				<div class="text-slate-400 leading-tight">Hand</div>
				<div class="text-base font-bold leading-tight">{gs.hand.length}/{gs.config.handSize}</div>
			</div>
			<div class="bg-slate-800/60 rounded px-2 py-1">
				<div class="text-slate-400 leading-tight">Royals</div>
				<div class="text-base font-bold leading-tight">{gs.castleDeck.length + (gs.currentEnemy ? 1 : 0)}</div>
			</div>
		</div>

		<!-- Phase strip -->
		<div class="py-2 sm:py-3 border-b border-slate-800/40">
			<PhaseStrip phase={gs.phase} />
		</div>

		<!-- Persistent info slot — hint + card/royal description + resolve summary all live here -->
		<div class="pt-2 sm:pt-3 pb-1 sm:pb-2">
			<InfoSlot kind={slot.kind} text={slot.text} detail={slot.detail} />
		</div>

		<!-- Main play area -->
		<main class="flex-1 flex flex-col md:flex-row min-h-0">
			<!-- Phantom left spacer to balance the right-hand sidebar so the center column
				 sits in the middle of the viewport on desktop. -->
			<div class="hidden md:block w-72 flex-shrink-0" aria-hidden="true"></div>

			<!-- Center column. justify-start + mt-auto on the hand row anchors play+hand to the
				 bottom while the upper sections keep stable positions, even as forecast/played
				 sections appear or disappear. -->
			<div class="flex-1 flex flex-col items-center justify-start px-2 py-2 sm:p-6 gap-2 sm:gap-4 relative min-h-0">
				{#if gs.currentEnemy}
					<Royal
						royal={gs.currentEnemy}
						shield={game.shield}
						immunityCancelled={gs.immunityCancelled}
						onhover={(t) => {
							// Hover/tap on the royal pushes its description into the info slot.
							if (t) {
								const m = describeRoyal();
								if (m) setOverride(m, 6000);
							} else if (infoOverride?.kind === 'royal') {
								clearOverride();
							}
						}}
					/>
				{/if}
				<!-- End-state overlays sit on top of whatever was on the board so the player
					 still sees the royal that beat them along with the damage math. -->
				{#if gs.phase === 'won'}
					<Victory state={gs} onNewGame={() => game.abandon()} />
				{:else if gs.phase === 'lost'}
					<Defeat state={gs} onNewGame={() => game.abandon()} />
				{/if}

				<!-- Played cards this battle -->
				{#if gs.playedThisBattle.length > 0}
					<div class="flex flex-col items-center gap-0.5 sm:gap-1">
						<div class="hidden sm:block text-xs text-slate-400 uppercase tracking-wider">Played this battle</div>
						<div class="flex gap-1 flex-wrap justify-center max-w-[92vw] md:max-w-2xl">
							{#each gs.playedThisBattle as c (c.id)}
								<Card card={c} size="sm" disabled />
							{/each}
						</div>
					</div>
				{/if}

				<!-- Forecast / damage meter — fixed min-height so the play button and hand below
					 don't reflow when a forecast appears or disappears. -->
				<div class="w-full px-1 sm:px-2 min-h-[7rem] sm:min-h-[7.5rem] flex items-center">
					{#if gs.phase === 'play' && fc && selected.length > 0}
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

				<!-- Hand. mt-auto pushes the action button + hand to the bottom of the column,
					 keeping their positions stable as upper sections (forecast, played pile) change. -->
				<div class="mt-auto flex flex-col items-center gap-2 sm:gap-3 w-full">
					<div class="flex items-center gap-2">
						{#if game.shield > 0}
							<div
								class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-400/40 text-blue-200 text-sm font-semibold"
								title="Shield blocks {game.shield} damage from the royal each turn this battle"
								aria-label="Shield {game.shield}"
							>
								<span class="text-base leading-none">♠</span>
								<span class="font-bold">{game.shield}</span>
							</div>
						{/if}
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
									onclick={() => game.concede()}
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
								onclick={() => game.abandon()}
								class="px-5 py-2 rounded-lg font-semibold bg-amber-400 hover:bg-amber-300 text-slate-900"
							>
								New game
							</button>
						{/if}
						<!-- Hand size — sits to the right of the action button so the count is
							 visible at the moment the player is choosing what to play. Top stats
							 strip is far enough away that you'd lose your eyeline. -->
						<div class="flex items-baseline gap-1 text-xs text-slate-400 ml-1" aria-label="Hand size">
							<span class="font-bold text-slate-200 text-base leading-none">{gs.hand.length}</span>
							<span class="leading-none">/ {gs.config.handSize}</span>
						</div>
					</div>

					<div class="w-full md:w-auto relative">
						<!-- Hand container: horizontal scroll on overflow. pt-5 leaves room for both
							 the -translate-y-2 lift on selected cards AND the tutorial recommendation
							 pulse halo (overflow-x-auto clips overflow-y too per CSS spec, so any
							 box-shadow extending above the cards needs to fit in this padding). -->
						<div class="flex items-end gap-2 sm:gap-3 justify-start md:justify-center pt-5 pb-2 sm:pt-5 sm:pb-8 overflow-x-auto md:overflow-visible px-3 md:px-0 scroll-smooth hand-scroll snap-x">
							{#if sortedHand.length === 0 && (gs.phase === 'play' || gs.phase === 'damage') && gs.jestersRemaining > 0}
								<!-- Empty-hand placeholder. We replace the hand row with a Jester-shaped slot
									 because an invisible empty area gave players no signal about what to do
									 next when they ran out of cards but still had a Jester to spend. -->
								<div class="flex flex-col items-center gap-2 mx-auto">
									<button
										type="button"
										onclick={() => (jesterOpen = true)}
										aria-label="Hand empty — use a Jester to deal a fresh hand"
										class="empty-jester-card w-16 h-24 sm:w-20 sm:h-28 rounded-lg shadow-md font-semibold cursor-pointer relative bg-gradient-to-br from-purple-500 to-pink-500 text-white"
									>
										<div class="absolute top-1 left-1 text-[10px] font-bold tracking-wide">JEST</div>
										<div class="absolute bottom-1 right-1 text-[10px] font-bold tracking-wide rotate-180">JEST</div>
										<div class="absolute inset-0 flex items-center justify-center text-amber-200">
											<JesterIcon size="2.25rem" />
										</div>
									</button>
									<div class="text-xs text-slate-300 text-center max-w-[14rem]">
										Hand is empty. Tap to use a Jester and deal a fresh hand.
									</div>
								</div>
							{:else}
								{#each sortedHand as c, i (c.id)}
									{@const isSel = selected.includes(c.id)}
									{@const inactive = gs.phase === 'play' && !isAddable(c)}
									<div class="flex flex-col items-center gap-1 flex-shrink-0 snap-start">
										<Card
											card={c}
											selected={isSel}
											disabled={gs.phase !== 'play' && gs.phase !== 'damage'}
											dim={inactive}
											suppressed={c.suit !== null &&
												c.suit === suppressedSuit &&
												c.rank !== 'JESTER'}
											emphasis={!isSel && recommendedSet().has(c.id)
											? 'recommend'
											: !isSel && suggestedSet.has(c.id)
												? 'suggest'
												: null}
											onclick={() => selectCard(c)}
											onhover={(t) => {
												// Hover/long-press on a hand card writes its description into the info slot.
												if (t) setOverride(describeCard(c), 5000);
												else if (infoOverride?.kind === 'card') clearOverride();
											}}
										/>
										{#if i < 9}
											<kbd
												class="hidden md:block text-[10px] font-mono px-1.5 py-0.5 rounded border {isSel
													? 'border-amber-400/70 text-amber-300'
													: 'border-slate-700 text-slate-500'}"
											>
												{i + 1}
											</kbd>
										{/if}
									</div>
								{/each}
							{/if}
						</div>
					</div>
				</div>
			</div>

			<!-- Sidebar: deck counts + log (desktop only) -->
			<aside class="hidden md:flex w-72 border-l border-slate-800/60 p-4 flex-col gap-4 bg-slate-950/40">
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

		<Tutorial />
		<JesterTray bind:open={jesterOpen} />

		<!-- Mobile slide-up sheet for log / legend -->
		{#if mobileSheet}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="md:hidden fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm"
				onclick={() => (mobileSheet = null)}
			></div>
			<div
				class="md:hidden fixed inset-x-0 bottom-0 z-50 max-h-[70vh] bg-slate-900 border-t border-slate-700 rounded-t-2xl p-4 shadow-2xl flex flex-col gap-3 sheet-up"
			>
				<div class="flex items-center justify-between">
					<div class="text-base font-bold text-amber-300 capitalize">
						{mobileSheet === 'log' ? 'Log' : 'Powers & rules'}
					</div>
					<button
						type="button"
						onclick={() => (mobileSheet = null)}
						class="text-slate-400 hover:text-slate-100 text-xl leading-none px-2"
						aria-label="Close"
					>
						✕
					</button>
				</div>
				<div class="flex-1 overflow-y-auto min-h-0 flex flex-col gap-3">
					{#if mobileSheet === 'legend'}
						<Legend />
					{:else}
						<Log entries={gs.log} />
					{/if}
				</div>
			</div>
		{/if}

		{#if confirmNewGame}
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
			<div
				class="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
				role="dialog"
				aria-modal="true"
				aria-labelledby="confirm-new-game-title"
				tabindex="-1"
				onclick={() => (confirmNewGame = false)}
			>
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div
					class="max-w-sm w-full bg-slate-900 border border-slate-700 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4"
					onclick={(e) => e.stopPropagation()}
					role="presentation"
				>
					<div>
						<div id="confirm-new-game-title" class="text-lg font-bold text-amber-300">Concede this run?</div>
						<div class="text-sm text-slate-300 mt-1">
							You'll surrender on turn {gs.turn} with {gs.castleDeck.length + (gs.currentEnemy ? 1 : 0)} royal{gs.castleDeck.length === 0 ? '' : 's'} remaining.
						</div>
					</div>
					<div class="flex gap-2 justify-end">
						<button
							type="button"
							onclick={() => (confirmNewGame = false)}
							class="px-4 py-2 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 text-slate-200"
						>
							Cancel
						</button>
						<button
							type="button"
							onclick={confirmAbandon}
							class="px-4 py-2 rounded-lg text-sm bg-red-500 hover:bg-red-400 text-white font-semibold"
						>
							Concede
						</button>
					</div>
				</div>
			</div>
		{/if}

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
	/* On tall-enough mobile/desktop screens, lock to a single viewport so the play
	   surface never scrolls. Very short screens (e.g. iPhone SE landscape) fall back
	   to natural height and allow page scroll. */
	:global(.board-root) {
		min-height: 100dvh;
	}
	@media (min-height: 700px) {
		:global(.board-root) {
			height: 100dvh;
			overflow: hidden;
		}
	}

	@keyframes sheet-up {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}
	:global(.sheet-up) {
		animation: sheet-up 0.2s ease-out;
	}

	/* Slim, dark scrollbar for hand on mobile so it doesn't dominate visually */
	:global(.hand-scroll) {
		scrollbar-width: thin;
		scrollbar-color: rgba(148, 163, 184, 0.3) transparent;
	}
	:global(.hand-scroll::-webkit-scrollbar) {
		height: 4px;
	}
	:global(.hand-scroll::-webkit-scrollbar-thumb) {
		background: rgba(148, 163, 184, 0.3);
		border-radius: 2px;
	}
</style>
