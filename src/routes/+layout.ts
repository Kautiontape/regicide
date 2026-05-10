// Pure client-side SPA: no server, all logic runs in the browser. adapter-static
// needs every route to be either prerendered or to have a fallback; we pick both
// (prerender for the entry page, fallback in the adapter config for client routes).
export const ssr = false;
export const prerender = true;
