import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useDebouncedValue } from '@/lib/useDebouncedValue'

beforeEach(() => {
	vi.useFakeTimers()
})

afterEach(() => {
	vi.useRealTimers()
})

const advance = (ms: number) => {
	act(() => {
		vi.advanceTimersByTime(ms)
	})
}

describe('useDebouncedValue', () => {
	it('returns the initial value immediately', () => {
		const { result } = renderHook(() => useDebouncedValue('ros', 300))
		expect(result.current).toBe('ros')
	})

	it('holds a new value back until the delay has elapsed', () => {
		const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), { initialProps: { value: 'ros' } })

		rerender({ value: 'rivers' })
		expect(result.current).toBe('ros')

		advance(299)
		expect(result.current).toBe('ros')

		advance(1)
		expect(result.current).toBe('rivers')
	})

	// The cleanup is what makes this a debounce rather than a queue of delayed updates: without it every
	// keystroke would settle in turn and the search box would fire one request per character, late.
	it('settles only on the last value when the input keeps changing', () => {
		const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), { initialProps: { value: 'r' } })

		rerender({ value: 'ro' })
		advance(200)
		rerender({ value: 'ros' })
		advance(200)
		rerender({ value: 'rivers' })
		advance(200)
		expect(result.current).toBe('r')

		advance(100)
		expect(result.current).toBe('rivers')
	})

	it('restarts the wait when the delay itself changes', () => {
		const { result, rerender } = renderHook(({ value, delay }) => useDebouncedValue(value, delay), {
			initialProps: { value: 'ros', delay: 300 }
		})

		rerender({ value: 'rivers', delay: 300 })
		advance(200)
		rerender({ value: 'rivers', delay: 1000 })
		advance(800)
		expect(result.current).toBe('ros')

		advance(200)
		expect(result.current).toBe('rivers')
	})

	it('clears the pending timer on unmount', () => {
		const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
		const { unmount } = renderHook(() => useDebouncedValue('ros', 300))

		unmount()
		expect(clearTimeoutSpy).toHaveBeenCalled()
	})
})
