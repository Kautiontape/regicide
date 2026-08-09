<script lang="ts">
	import { onMount } from 'svelte';
	import { game } from '$lib/store.svelte';
	import Setup from '$lib/ui/Setup.svelte';
	import Board from '$lib/ui/Board.svelte';

	onMount(() => {
		game.init();
	});
</script>

<svelte:head>
	<title>Paper Crowns</title>
</svelte:head>

{#if game.state}
	<Board />
{:else}
	<Setup />
{/if}
