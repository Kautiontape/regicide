<script lang="ts">
	import { game } from '$lib/store.svelte';
	import JesterIcon from './JesterIcon.svelte';

	const gs = $derived(game.state);
	const remaining = $derived(gs?.jestersRemaining ?? 0);
	const phase = $derived(gs?.phase ?? 'play');
	const canUse = $derived(remaining > 0 && (phase === 'play' || phase === 'damage'));

	let open = $state(false);

	function toggle() {
		if (!canUse) return;
		open = !open;
	}

	function close() {
		open = false;
	}

	function activate() {
		if (!canUse) return;
		game.activateJester();
		open = false;
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			e.preventDefault();
			close();
		}
	}
</script>

<svelte:window onkeydown={onKey} />

{#if gs && remaining > 0}
	<!-- Peek tabs: one per remaining Jester, mostly hidden off the left edge. Tapping any tab
		 opens the panel. -->
	<div class="jester-edge fixed left-0 z-30 flex flex-col gap-2 pointer-events-none"
		style="bottom: calc(13rem + env(safe-area-inset-bottom, 0px));">
		{#each Array.from({ length: remaining }) as _, i (i)}
			<button
				type="button"
				onclick={toggle}
				disabled={!canUse}
				aria-label="Use Jester ability ({remaining} remaining)"
				title="Tap to view the Jester ability"
				class="jester-peek pointer-events-auto"
				class:disabled={!canUse}
			>
				<JesterIcon size="1.5rem" class="jester-peek-icon" />
			</button>
		{/each}
	</div>

	{#if open}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="jester-title"
			tabindex="-1"
			onclick={close}
		>
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div
				class="max-w-sm w-full bg-slate-900 border border-amber-400/60 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 jester-pop"
				onclick={(e) => e.stopPropagation()}
				role="presentation"
			>
				<!-- Big Jester card preview -->
				<div class="flex items-center gap-4">
					<div
						class="relative w-20 h-28 sm:w-24 sm:h-36 rounded-xl shadow-xl bg-gradient-to-br from-purple-500 to-pink-500 text-amber-200 font-semibold flex-shrink-0"
						aria-hidden="true"
					>
						<div class="absolute top-1 left-1 text-[10px] font-bold tracking-wide text-white">JEST</div>
						<div class="absolute bottom-1 right-1 text-[10px] font-bold tracking-wide text-white rotate-180">JEST</div>
						<div class="absolute inset-0 flex items-center justify-center">
							<JesterIcon size="3.25rem" />
						</div>
					</div>
					<div class="min-w-0">
						<div id="jester-title" class="text-lg sm:text-xl font-bold text-amber-300">
							Jester ability
						</div>
						<div class="text-xs sm:text-sm text-slate-400 mt-0.5">
							{remaining} of {gs.config.jesters} remaining
						</div>
					</div>
				</div>

				<div class="text-sm text-slate-200 leading-snug space-y-2">
					<p>
						<strong class="text-amber-200">Discard your entire hand</strong>
						and refill from the tavern (up to {gs.config.handSize} cards). One-shot.
					</p>
					<p class="text-xs text-slate-400">
						Use it at the start of your turn (before playing) or before taking damage.
						Does <em>not</em> cancel the royal's immunity.
					</p>
				</div>

				<div class="flex gap-2 justify-end">
					<button
						type="button"
						onclick={close}
						class="px-4 py-2 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 text-slate-200"
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={activate}
						disabled={!canUse}
						class="px-4 py-2 rounded-lg text-sm font-semibold transition-colors {canUse
							? 'bg-amber-400 hover:bg-amber-300 text-slate-900'
							: 'bg-slate-800 text-slate-500 cursor-not-allowed'}"
					>
						Use Jester
					</button>
				</div>
			</div>
		</div>
	{/if}
{/if}

<style>
	/* The peek tab sits flush with the left edge and only a sliver of star pokes out. Tap
	   target is the full ~40px square so it's reachable on touch. */
	:global(.jester-peek) {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		width: 2.5rem;
		height: 3rem;
		padding-right: 0.35rem;
		background: linear-gradient(90deg, rgba(168, 85, 247, 0.95), rgba(236, 72, 153, 0.95));
		border: 1px solid rgba(251, 191, 36, 0.5);
		border-left: none;
		border-top-right-radius: 0.75rem;
		border-bottom-right-radius: 0.75rem;
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
		transform: translateX(-1.25rem);
		transition: transform 0.18s ease-out, filter 0.18s ease-out;
		cursor: pointer;
		color: #fde68a;
	}
	:global(.jester-peek-icon) {
		filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.45));
	}
	@media (hover: hover) {
		:global(.jester-peek:hover) {
			transform: translateX(-0.25rem);
		}
	}
	:global(.jester-peek:active) {
		transform: translateX(-0.25rem);
	}
	:global(.jester-peek.disabled) {
		filter: grayscale(0.7);
		cursor: not-allowed;
	}

	@keyframes jester-pop-in {
		from {
			opacity: 0;
			transform: scale(0.92) translateY(8px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}
	:global(.jester-pop) {
		animation: jester-pop-in 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.15) both;
	}
</style>
