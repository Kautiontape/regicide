<script lang="ts">
	import type { Forecast } from '$lib/engine';

	interface Props {
		forecast: Forecast | null;
		currentShield: number;
		currentEnemyAtk: number;
	}

	let { forecast, currentShield, currentEnemyAtk }: Props = $props();

	const SUIT_COLOR: Record<string, string> = {
		hearts: 'text-red-300',
		diamonds: 'text-amber-300',
		clubs: 'text-emerald-300',
		spades: 'text-blue-300'
	};

	const shieldDelta = $derived(forecast ? forecast.newShield - currentShield : 0);
	const atkDelta = $derived(forecast ? forecast.newEnemyAtk - currentEnemyAtk : 0);
</script>

{#if forecast}
	<div class="bg-slate-900/85 border border-slate-700 rounded-xl p-2 sm:p-3 max-w-2xl w-full mx-auto shadow-lg">
		{#if !forecast.combo.ok}
			<div class="text-xs sm:text-sm text-red-300 italic">
				⚠ {forecast.combo.reason}
			</div>
		{:else}
			<div class="grid grid-cols-3 gap-1.5 sm:gap-2 text-sm">
				<!-- Damage block -->
				<div class="flex flex-col items-center justify-center bg-slate-800/60 rounded-lg p-1.5 sm:p-2">
					<div class="text-[10px] uppercase tracking-wider text-slate-400">Damage</div>
					<div class="flex items-baseline gap-1">
						<span class="text-xl sm:text-2xl font-bold text-red-300">{forecast.damage}</span>
						{#if forecast.damage !== forecast.rawDamage}
							<span class="text-[10px] sm:text-xs text-slate-400 line-through">{forecast.rawDamage}</span>
						{/if}
					</div>
					<div class="text-[10px] text-slate-400 text-center leading-tight">
						{#if forecast.defeated}
							<span class="text-amber-300 font-semibold">
								{forecast.defeated.exact ? '★ EXACT' : 'DEFEAT'}
							</span>
						{:else}
							→ HP {forecast.enemyHpAfter}
						{/if}
					</div>
				</div>

				<!-- Shield / next ATK preview -->
				<div class="flex flex-col items-center justify-center bg-slate-800/60 rounded-lg p-1.5 sm:p-2">
					<div class="text-[10px] uppercase tracking-wider text-slate-400 text-center">Next atk</div>
					{#if forecast.defeated}
						<div class="text-xl sm:text-2xl font-bold text-emerald-300">—</div>
						<div class="text-[10px] text-slate-400 text-center leading-tight">no counter</div>
					{:else}
						<div class="flex items-baseline gap-1">
							<span class="text-xl sm:text-2xl font-bold text-red-300">{forecast.newEnemyAtk}</span>
							{#if atkDelta !== 0}
								<span class="text-[10px] sm:text-xs text-blue-300">({atkDelta > 0 ? '+' : ''}{atkDelta})</span>
							{/if}
						</div>
						<div class="text-[10px] text-slate-400 text-center leading-tight">
							shield {forecast.newShield}
							{#if shieldDelta > 0}<span class="text-blue-300">+{shieldDelta}</span>{/if}
						</div>
					{/if}
				</div>

				<!-- Hand / deck preview -->
				<div class="flex flex-col items-center justify-center bg-slate-800/60 rounded-lg p-1.5 sm:p-2">
					<div class="text-[10px] uppercase tracking-wider text-slate-400 text-center">After</div>
					<div class="text-xs text-slate-200">
						hand <span class="font-semibold">{forecast.newHandSize}</span>
					</div>
					<div class="text-[10px] text-slate-400 text-center leading-tight">
						T{forecast.newTavernSize} · D{forecast.newDiscardSize}
					</div>
				</div>
			</div>

			{#if forecast.powers.length > 0}
				<div class="mt-2 pt-2 border-t border-slate-700/60 flex flex-wrap gap-x-4 gap-y-1 justify-center text-xs">
					{#each forecast.powers as p}
						<span
							class="{p.suppressed
								? 'line-through text-slate-500'
								: SUIT_COLOR[p.suit]}"
						>
							{p.summary}
						</span>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
{/if}
