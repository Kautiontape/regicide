<script lang="ts">
	const rows = [
		{ glyph: '♥', name: 'Heart', color: 'text-red-300', text: 'Heal: shuffle that many cards from discard back into the bottom of the tavern.' },
		{ glyph: '♦', name: 'Diamond', color: 'text-amber-300', text: 'Draw that many cards (capped at hand size).' },
		{ glyph: '♣', name: 'Club', color: 'text-emerald-300', text: 'Damage ×2 for this attack.' },
		{ glyph: '♠', name: 'Spade', color: 'text-blue-300', text: 'Shield: reduce the royal\'s attack by that much for the rest of the battle. Stacks.' }
	];
</script>

<div class="flex flex-col gap-1">
	<div class="text-xs uppercase tracking-wider text-slate-400">Powers</div>
	<div class="space-y-1.5 text-xs">
		{#each rows as r}
			<div class="flex items-start gap-2 leading-snug">
				<span class="{r.color} font-bold w-4 text-center flex-shrink-0 suit-glyph">{r.glyph}</span>
				<span class="text-slate-300">{r.text}</span>
			</div>
		{/each}
		<div class="text-[11px] text-slate-500 pt-1 border-t border-slate-800/60 mt-1">
			Royals are immune to their own suit. The Jesters on the screen edge are one-shot
			rescues — discard your hand and refill (does not cancel immunity).
		</div>
	</div>
</div>

<style>
	/* Force text-style (mono-color, font-controlled) rendering so all four suit glyphs
	   are the same size and baseline. Without this, browsers may render some (♥ ♦)
	   as emoji and others (♣ ♠) as text, breaking alignment and ignoring CSS color. */
	.suit-glyph {
		font-variant-emoji: text;
		font-feature-settings: 'ss01';
		line-height: 1.25;
	}
</style>
