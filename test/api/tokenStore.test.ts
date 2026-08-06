import { describe, expect, it } from 'vitest'

import { clearAccessToken, getAccessToken, setAccessToken } from '@/api/tokenStore'

describe('tokenStore', () => {
	it('starts empty', () => {
		expect(getAccessToken()).toBeNull()
	})

	it('returns the token it was given', () => {
		setAccessToken('access-1')
		expect(getAccessToken()).toBe('access-1')
	})

	it('overwrites rather than appends, so a refresh replaces the expired token', () => {
		setAccessToken('access-1')
		setAccessToken('access-2')
		expect(getAccessToken()).toBe('access-2')
	})

	it('clears back to null', () => {
		setAccessToken('access-1')
		clearAccessToken()
		expect(getAccessToken()).toBeNull()
	})

	// The whole point of the module: nothing readable survives the tab. A regression here is an XSS
	// exfiltration path, so it is asserted rather than left to the doc comment.
	it('never writes the token to browser storage', () => {
		setAccessToken('access-1')
		expect(localStorage.length).toBe(0)
		expect(sessionStorage.length).toBe(0)
		expect(document.cookie).toBe('')
	})
})
