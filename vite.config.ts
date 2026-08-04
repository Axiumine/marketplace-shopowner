import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

/**
 * SPA, single origin.
 *
 * The four GraphQL endpoints are reached through same-origin paths (`/public-authorization`,
 * `/authenticated-resource`, …) that nginx proxies to the seven services. That is not a
 * convenience: the refresh token is a signed httpOnly cookie, and a cross-origin request would need
 * both `SameSite=None` on the cookie and a CORS allow-list on every service to carry it. Single origin
 * removes the whole problem, and `credentials: 'include'` in the fetch options is then enough.
 *
 * In development nginx is not in the picture, so the proxy table below stands in for it. The ports
 * are the ones in each service's `env` template; a service that is not running fails that one
 * endpoint and leaves the rest of the app working.
 *
 * `PORT` is read through `loadEnv` rather than hardcoded, so the `env` template stays the single
 * place the port is written — the same invariant every backend service holds, and the reason
 * `grep -m1 '^PORT=' <repo>/env` is trustworthy across the platform. The third argument is `''`
 * (no prefix filter) because `PORT` is a build-time-only variable and deliberately not `VITE_`-
 * prefixed: prefixing it would inline it into the client bundle, where it means nothing.
 */
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '')

	return {
		plugins: [react(), tailwindcss()],
		resolve: {
			alias: {
				'@': fileURLToPath(new URL('./src', import.meta.url)),
				'@gql': fileURLToPath(new URL('./src/gql', import.meta.url))
			}
		},
		server: {
			host: '127.0.0.1',
			port: Number(env.PORT ?? 3044),
			proxy: {
				'/public-authorization': 'http://127.0.0.1:4028',
				'/authenticated-authorization': 'http://127.0.0.1:4029',
				'/authenticated-resource': 'http://127.0.0.1:4026',
				'/logout': 'http://127.0.0.1:4030'
			}
		},
		build: {
			sourcemap: true
		}
	}
})
