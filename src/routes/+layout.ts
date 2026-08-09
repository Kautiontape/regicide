// Pure client-side SPA: no server, all logic runs in the browser.
//
// No `ssr` / `prerender` exports here on purpose. svelte.config.js sets
// router.type = 'hash' so the build survives itch.io serving the game from
// /html/<id>/index.html, and SvelteKit rejects page options under hash routing
// — everything is client-rendered from the adapter's fallback page by
// definition, which is exactly what those two exports used to ask for.
export {};
