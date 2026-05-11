<script lang="ts">
	/** Stylised three-pointed jester hat with bells. Uses currentColor so it inherits
	 *  whatever text colour the surrounding element sets. */
	interface Props {
		/** Width/height in any CSS length unit. Defaults to 1em so it scales with surrounding text. */
		size?: string;
		class?: string;
		ariaLabel?: string;
	}
	let { size = '1em', class: cls = '', ariaLabel }: Props = $props();
</script>

<svg
	viewBox="0 0 24 24"
	width={size}
	height={size}
	fill="currentColor"
	role={ariaLabel ? 'img' : undefined}
	aria-hidden={ariaLabel ? undefined : true}
	aria-label={ariaLabel}
	class={cls}
>
	<!-- Three-pointed jester hat. Each pip is a triangle, the line beneath is the band. -->
	<path d="M4.2 17.5 L7 6.5 L10 14.8 L12 4 L14 14.8 L17 6.5 L19.8 17.5 Z" />
	<!-- Bells at each peak tip. -->
	<circle cx="7" cy="6.5" r="1.5" />
	<circle cx="12" cy="4" r="1.5" />
	<circle cx="17" cy="6.5" r="1.5" />
	<!-- Hat band -->
	<rect x="3.5" y="17.5" width="17" height="2.6" rx="0.6" />
</svg>
