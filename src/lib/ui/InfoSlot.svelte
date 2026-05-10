<script lang="ts" module>
	export type InfoKind = 'prompt' | 'card' | 'royal' | 'resolve' | 'warn' | 'success';
</script>

<script lang="ts">
	interface Props {
		kind: InfoKind;
		text: string;
		detail?: string;
	}
	let { kind, text, detail }: Props = $props();

	const META: Record<InfoKind, { icon: string; tone: string; ring: string }> = {
		prompt: { icon: '✦', tone: 'text-slate-400', ring: 'border-slate-700/50' },
		card: { icon: 'ⓘ', tone: 'text-blue-300', ring: 'border-blue-500/40' },
		royal: { icon: '♛', tone: 'text-amber-300', ring: 'border-amber-500/40' },
		resolve: { icon: '★', tone: 'text-amber-300', ring: 'border-amber-400/50' },
		warn: { icon: '⚠', tone: 'text-red-300', ring: 'border-red-500/40' },
		success: { icon: '✓', tone: 'text-emerald-300', ring: 'border-emerald-400/40' }
	};
	const meta = $derived(META[kind] ?? META.prompt);
</script>

<div class="px-3 sm:px-4 w-full flex justify-center">
	<div
		class="max-w-2xl w-full h-16 sm:h-[4.5rem] overflow-hidden bg-slate-900/50 border {meta.ring} rounded-lg px-3 py-1.5 sm:py-2 transition-colors flex items-center"
	>
		{#if text}
			<div class="flex items-start gap-2 text-xs sm:text-sm leading-snug w-full overflow-hidden">
				<span class="{meta.tone} flex-shrink-0 mt-0.5 w-4 text-center">{meta.icon}</span>
				<div class="flex-1 text-left min-w-0 overflow-hidden">
					<div class="text-slate-200 line-clamp-1">{text}</div>
					{#if detail}
						<div class="text-slate-400 text-[11px] sm:text-xs mt-0.5 leading-snug line-clamp-2">{detail}</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>
