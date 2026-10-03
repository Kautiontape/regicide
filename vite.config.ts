/// <reference types="vitest/config" />
import adapter from '@sveltejs/adapter-static';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) => filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// itch.io serves an HTML game from a per-build subpath
			// (html.itch.zone/html/<id>/index.html), so absolute /_app/ URLs
			// resolve against the CDN root and 404 into a blank page. Relative asset
			// paths work there and are equally correct at the nginx root. Safe here
			// because the app is a single route — a relative path only misresolves
			// when the fallback is served from a nested URL, which never happens.
			paths: { relative: true },
			// Relative assets get the files loading, but the client router still matches
			// window.location.pathname against the route table and 404s on itch's
			// /html/<id>/index.html. Hash routing takes the pathname out of the decision
			// entirely. Costs a "#" in the address bar, which for a one-route game is
			// the whole downside.
			router: { type: 'hash' },

			// Static SPA build: the whole app ships as one fallback index.html plus a
			// client runtime. nginx serves build/ directly and routes unknown paths
			// back through index.html.
			adapter: adapter({
				pages: 'build',
				assets: 'build',
				fallback: 'index.html',
				precompress: false,
				strict: true
			})
		})
	],
	server: {
		host: '0.0.0.0',
		port: 5173,
		strictPort: true,
		allowedHosts: ['.ts.net', 'localhost', 'barret']
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'node'
	}
});
