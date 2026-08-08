import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
	clearPendingEmail,
	clearSession,
	getPendingEmail,
	getSession,
	setPendingEmail,
	setSession,
	subscribeSession,
	useSession
} from '@/auth/session'

/**
 * ⚠️ An email and nothing else. The operator app's identity carries an `_id` because
 * `infoAdminAfterLogin` answers with one; the ShopOwner resource service has no "who am I" query at
 * all, so the only thing this app ever learns about the owner is the address they typed into the
 * sign-in form.
 */
const OWNER = { email: 'owner@marketplace.test' }

describe('the session store', () => {
	it('starts empty', () => {
		expect(getSession()).toBeNull()
	})

	it('holds the identity it was given', () => {
		setSession(OWNER)
		expect(getSession()).toEqual(OWNER)
	})

	// The shape a session restored from the refresh cookie has: authenticated, and nameless. It is a
	// session all the same — the distinction the app branches on is null versus non-null, never the email.
	it('holds a session that could not name the owner', () => {
		setSession({ email: null })
		expect(getSession()).toEqual({ email: null })
		expect(getSession()).not.toBeNull()
	})

	it('clears back to null', () => {
		setSession(OWNER)
		clearSession()
		expect(getSession()).toBeNull()
	})

	it('notifies every subscriber on set and on clear', () => {
		const first = vi.fn()
		const second = vi.fn()
		subscribeSession(first)
		subscribeSession(second)

		setSession(OWNER)
		expect(first).toHaveBeenCalledTimes(1)
		expect(second).toHaveBeenCalledTimes(1)

		clearSession()
		expect(first).toHaveBeenCalledTimes(2)
		expect(second).toHaveBeenCalledTimes(2)
	})

	it('stops notifying an unsubscribed listener', () => {
		const listener = vi.fn()
		const unsubscribe = subscribeSession(listener)
		unsubscribe()

		setSession(OWNER)
		expect(listener).not.toHaveBeenCalled()
	})

	// ⚠️ Nothing is persisted, and this asserts it. Backing the session store with `localStorage` is the
	// obvious way to survive a reload, and it leaves the last owner's address readable by anything
	// running on the origin long after they signed out. The reload path is served by refreshing from the
	// httpOnly cookie instead — see `LoadingPage`.
	it('persists nothing', () => {
		setSession(OWNER)
		expect(localStorage.length).toBe(0)
		expect(sessionStorage.length).toBe(0)
	})
})

describe('useSession', () => {
	it('renders the current identity and re-renders on every change', () => {
		const { result } = renderHook(() => useSession())
		expect(result.current).toBeNull()

		act(() => {
			setSession(OWNER)
		})
		expect(result.current).toEqual(OWNER)

		act(() => {
			clearSession()
		})
		expect(result.current).toBeNull()
	})

	it('unsubscribes on unmount, so an update after teardown is not a React warning', () => {
		const { unmount } = renderHook(() => useSession())
		unmount()

		expect(() => {
			setSession(OWNER)
		}).not.toThrow()
	})
})

/**
 * The address the sign-in form hands to `/loading`, which has no counterpart in the operator app —
 * there the bootstrap screen asks `infoAdminAfterLogin` who the operator is, and nothing has to be
 * carried across the navigation.
 */
describe('the pending email', () => {
	it('starts empty', () => {
		expect(getPendingEmail()).toBeNull()
	})

	/*
	 * ⚠️ Read twice, answered twice. `/loading` establishes the session from inside an effect and React
	 * runs every effect twice under StrictMode, so a read that cleared would let the second run overwrite
	 * the session with a nameless one — the owner would sign in and immediately lose their name from the
	 * sidebar. The clearing belongs to `useLogout` and to nothing else.
	 */
	it('survives being read', () => {
		setPendingEmail('owner@marketplace.test')

		expect(getPendingEmail()).toBe('owner@marketplace.test')
		expect(getPendingEmail()).toBe('owner@marketplace.test')
	})

	it('takes the address of the most recent sign-in', () => {
		setPendingEmail('first@marketplace.test')
		setPendingEmail('second@marketplace.test')

		expect(getPendingEmail()).toBe('second@marketplace.test')
	})

	it('clears back to null', () => {
		setPendingEmail('owner@marketplace.test')
		clearPendingEmail()

		expect(getPendingEmail()).toBeNull()
	})

	// It is not part of the session store: clearing one must not clear the other, or signing in again
	// after a failed bootstrap would find the address already gone.
	it('is untouched by the session store', () => {
		setPendingEmail('owner@marketplace.test')

		setSession(OWNER)
		expect(getPendingEmail()).toBe('owner@marketplace.test')

		clearSession()
		expect(getPendingEmail()).toBe('owner@marketplace.test')
	})

	// A module variable, so it leaves nothing behind either — the whole reason it is not a search param
	// is that the address must not reach the browser history or an access log.
	it('persists nothing', () => {
		setPendingEmail('owner@marketplace.test')

		expect(localStorage.length).toBe(0)
		expect(sessionStorage.length).toBe(0)
	})
})
