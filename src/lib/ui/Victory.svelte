<script lang="ts">
	import type { GameState } from '$lib/engine';
	import { buildRecord, formatDuration, tierFor, type Tier } from '$lib/history';
	import { dailyNumber, loadDailyAttempt } from '$lib/daily';
	import ShareButton from './ShareButton.svelte';

	interface Props {
		state: GameState;
		onNewGame: () => void;
	}
	let { state, onNewGame }: Props = $props();

	const elapsedMs = $derived(
		Math.max(0, (state.endedAt ?? Date.now()) - state.startedAt)
	);

	const dailyAttempt = $derived(state.config.mode === 'daily' ? loadDailyAttempt() : null);
	const record = $derived(buildRecord(state, dailyAttempt?.attemptCount ?? 1));
	const isDaily = $derived(state.config.mode === 'daily');

	type Stats = {
		turns: number;
		damageDealt: number;
		damageTaken: number;
		exactKills: number;
		healed: number;
		drawn: number;
		shielded: number;
		jestersUsed: number;
	};

	function deriveStats(s: GameState): Stats {
		let damageDealt = 0;
		let damageTaken = 0;
		let exactKills = 0;
		let healed = 0;
		let drawn = 0;
		let shielded = 0;
		let jestersUsed = 0;
		for (const e of s.log) {
			if (e.kind === 'damage') {
				const m = e.text.match(/Dealt (\d+) damage/);
				if (m) damageDealt += parseInt(m[1], 10);
			} else if (e.kind === 'defeat') {
				if (/exact/i.test(e.text)) exactKills++;
			} else if (e.kind === 'discard') {
				// "Discarded N card(s) for X to cover Y damage."
				const m = e.text.match(/for (\d+)/);
				if (m) damageTaken += parseInt(m[1], 10);
			} else if (e.kind === 'heal') {
				const m = e.text.match(/healed (\d+)/);
				if (m) healed += parseInt(m[1], 10);
			} else if (e.kind === 'draw') {
				// "♦ drew N." — only ♦ Diamonds draws cards now (no end-of-turn refill).
				const m = e.text.match(/drew (\d+)/);
				if (m) drawn += parseInt(m[1], 10);
			} else if (e.kind === 'shield') {
				const m = e.text.match(/\+(\d+)/);
				if (m) shielded += parseInt(m[1], 10);
			} else if (e.kind === 'jester') {
				jestersUsed++;
			}
		}
		return {
			turns: s.turn,
			damageDealt,
			damageTaken,
			exactKills,
			healed,
			drawn,
			shielded,
			jestersUsed
		};
	}

	const stats = $derived(deriveStats(state));

	type TierStyle = { name: string; color: string; ring: string };
	const TIER_STYLE: Record<Tier, TierStyle> = {
		gold: { name: 'Gold Victory', color: 'text-amber-300', ring: 'ring-amber-400/60' },
		silver: { name: 'Silver Victory', color: 'text-slate-200', ring: 'ring-slate-300/50' },
		bronze: { name: 'Bronze Victory', color: 'text-orange-300', ring: 'ring-orange-400/50' }
	};
	const tier = $derived<TierStyle | null>(
		(() => {
			const t = tierFor({ jesters: state.config.jesters, jestersUsed: stats.jestersUsed });
			return t ? TIER_STYLE[t] : null;
		})()
	);

	// 24 confetti particles with deterministic offsets/colors so the animation is repeatable
	// and not too noisy. Mostly amber/blue/red/emerald to match the game's palette.
	const PALETTE = ['#fbbf24', '#60a5fa', '#f87171', '#34d399', '#f5f5f5'];
	const particles = Array.from({ length: 24 }, (_, i) => ({
		x: (i * 37) % 100, // 0..100 percent
		delay: ((i * 53) % 100) / 100, // 0..1s
		duration: 2.4 + ((i * 17) % 100) / 100,
		drift: ((i * 29) % 60) - 30, // -30..30 px horizontal drift
		rot: (i * 23) % 360,
		color: PALETTE[i % PALETTE.length],
		size: 6 + (i % 4) * 2 // 6..12px
	}));
</script>

<div
	class="fixed inset-0 z-40 flex flex-col items-center justify-center p-6 overflow-hidden bg-slate-950/85 backdrop-blur-sm"
	role="status"
	aria-live="polite"
>
	<!-- Confetti layer -->
	<div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
		{#each particles as p, i (i)}
			<span
				class="confetti"
				style="
					left: {p.x}%;
					width: {p.size}px;
					height: {p.size * 0.4}px;
					background: {p.color};
					animation-delay: {p.delay}s;
					animation-duration: {p.duration}s;
					--drift: {p.drift}px;
					--rot: {p.rot}deg;
				"
			></span>
		{/each}
	</div>

	<div class="relative flex flex-col items-center gap-4 sm:gap-6 max-w-md w-full">
		<div class="text-center">
			<div class="text-4xl sm:text-5xl font-bold text-amber-300 tracking-tight victory-pop">
				Victory
			</div>
			{#if isDaily && state.config.dailyDate}
				<div class="mt-1 text-xs text-amber-300/80 font-semibold tracking-wide">
					Daily #{dailyNumber(state.config.dailyDate)}{#if record.attemptCount > 1}
						<span class="text-slate-500"> · 🔁 attempt {record.attemptCount}</span>
					{/if}
				</div>
			{/if}
			{#if tier}
				<div
					class="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-slate-900/70 ring-1 {tier.ring} {tier.color} text-xs sm:text-sm font-semibold tracking-wide"
				>
					<span aria-hidden="true">★</span>
					<span>{tier.name}</span>
				</div>
			{/if}
			<div class="text-sm sm:text-base text-slate-300 mt-2">
				All 12 royals defeated in {stats.turns} turn{stats.turns === 1 ? '' : 's'}
				<span class="text-slate-500">·</span>
				<span class="font-mono tabular-nums text-slate-200">{formatDuration(elapsedMs)}</span>
			</div>
			{#if record.tutorial}
				<div class="text-xs text-slate-500 mt-1">📖 with tutorial</div>
			{/if}
		</div>

		<div class="grid grid-cols-2 gap-2 sm:gap-3 w-full">
			<div class="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2">
				<div class="text-[10px] uppercase tracking-wider text-slate-400">Damage dealt</div>
				<div class="text-xl font-bold text-red-300">{stats.damageDealt}</div>
			</div>
			<div class="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2">
				<div class="text-[10px] uppercase tracking-wider text-slate-400">Damage taken</div>
				<div class="text-xl font-bold text-slate-200">{stats.damageTaken}</div>
			</div>
			<div class="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2">
				<div class="text-[10px] uppercase tracking-wider text-slate-400">Exact kills</div>
				<div class="text-xl font-bold text-amber-300">{stats.exactKills}</div>
			</div>
			<div class="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2">
				<div class="text-[10px] uppercase tracking-wider text-slate-400">♥ Healed</div>
				<div class="text-xl font-bold text-red-300">{stats.healed}</div>
			</div>
			<div class="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2">
				<div class="text-[10px] uppercase tracking-wider text-slate-400">♦ Drawn</div>
				<div class="text-xl font-bold text-amber-200">{stats.drawn}</div>
			</div>
			<div class="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2">
				<div class="text-[10px] uppercase tracking-wider text-slate-400">♠ Shield</div>
				<div class="text-xl font-bold text-blue-300">{stats.shielded}</div>
			</div>
		</div>

		{#if stats.jestersUsed > 0}
			<div class="text-xs text-slate-400">
				{stats.jestersUsed} jester{stats.jestersUsed === 1 ? '' : 's'} used
			</div>
		{/if}

		<div class="mt-2 flex flex-wrap gap-2 items-center justify-center">
			<ShareButton {record} />
			<button
				type="button"
				onclick={onNewGame}
				class="px-6 py-3 rounded-lg font-bold bg-amber-400 hover:bg-amber-300 text-slate-900 transition-colors"
			>
				New game
			</button>
		</div>
	</div>
</div>

<style>
	@keyframes pop-in {
		0% {
			opacity: 0;
			transform: scale(0.6);
		}
		60% {
			transform: scale(1.08);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}
	:global(.victory-pop) {
		animation: pop-in 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
	}

	@keyframes confetti-fall {
		from {
			transform: translate3d(0, -10vh, 0) rotate(0deg);
			opacity: 0;
		}
		15% {
			opacity: 0.95;
		}
		100% {
			transform: translate3d(var(--drift, 0), 110vh, 0) rotate(calc(var(--rot, 360deg) + 360deg));
			opacity: 0;
		}
	}
	:global(.confetti) {
		position: absolute;
		top: 0;
		display: block;
		border-radius: 1px;
		opacity: 0;
		animation-name: confetti-fall;
		animation-iteration-count: infinite;
		animation-timing-function: linear;
		will-change: transform, opacity;
	}
</style>
