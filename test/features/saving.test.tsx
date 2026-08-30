import { zodResolver } from '@hookform/resolvers/zod'
import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { TextField } from '@/components/ui/TextField'
import type { RegisterSection } from '@/features/saving'
import { SaveChanges, saveValidated, useSavableSection, useSaving } from '@/features/saving'

/**
 * A stand-in for one editable block of the companies page.
 *
 * It owns its own dirtiness and clears it on a successful save, which is exactly what the real forms do
 * through react-hook-form's `reset` — and it is what makes "Changes saved." reachable at all, since
 * the message is shown only for a save nothing has superseded.
 *
 * `save` is deliberately re-created on every render, closing over the current state. That is the shape
 * the real sections have — their `save` reads the form, so it changes on every keystroke — and it is
 * what the hook's `saveRef` indirection exists to survive.
 */
const Section = ({
	id,
	register,
	outcome = true,
	order,
	waitFor
}: {
	id: string
	register: RegisterSection
	outcome?: boolean
	order: string[]
	waitFor?: Promise<void> | undefined
}) => {
	const [changed, setChanged] = useState(false)

	useSavableSection(id, register, changed, async () => {
		order.push(id)
		await waitFor
		if (outcome) setChanged(false)
		return outcome
	})

	return (
		<button
			type="button"
			onClick={() => {
				setChanged((previous) => !previous)
			}}
		>
			{`touch ${id}`}
		</button>
	)
}

const Page = ({
	ids,
	outcomes = {},
	order,
	waitFor
}: {
	ids: readonly string[]
	outcomes?: Record<string, boolean>
	order: string[]
	waitFor?: Promise<void> | undefined
}) => {
	const { register, saveAll, changed } = useSaving()
	const [visible, setVisible] = useState(ids)

	return (
		<>
			{visible.map((id) => (
				<Section key={id} id={id} register={register} outcome={outcomes[id] ?? true} order={order} waitFor={waitFor} />
			))}
			<button
				type="button"
				onClick={() => {
					setVisible((previous) => previous.slice(0, -1))
				}}
			>
				unmount last
			</button>
			<SaveChanges changed={changed} saveAll={saveAll} />
		</>
	)
}

/**
 * A section whose id can be swapped under it, and which is dirty from the moment it mounts.
 *
 * The point of it is the unregistration: `useSavableSection` has to forget the id it is *currently*
 * registered under, not the one it happened to mount with.
 */
const SectionId = ({ id, register }: { id: string; register: RegisterSection }) => {
	useSavableSection(id, register, true, async () => true)

	return null
}

const PageId = ({ id, mounted }: { id: string; mounted: boolean }) => {
	const { register, saveAll, changed } = useSaving()

	return (
		<>
			{mounted ? <SectionId id={id} register={register} /> : null}
			<SaveChanges changed={changed} saveAll={saveAll} />
		</>
	)
}

const save = () => screen.getByRole('button', { name: 'Save' })

describe('useSaving', () => {
	// ⚠️ The reason here is *not* the admin app's. `funCompanyUpdate` checks `matchedCount`, so a save
	// that changes nothing answers 200 on this tier — the gate is about not writing, and not showing
	// "Changes saved." over a page nobody edited, rather than about dodging a 500.
	it('keeps the button disabled while nothing has been touched', () => {
		render(<Page ids={['a', 'b']} order={[]} />)

		expect(save()).toBeDisabled()
	})

	it('enables the button as soon as one section is dirty, and disables it again when it is not', async () => {
		render(<Page ids={['a', 'b']} order={[]} />)

		await userEvent.click(screen.getByRole('button', { name: 'touch b' }))
		expect(save()).toBeEnabled()

		await userEvent.click(screen.getByRole('button', { name: 'touch b' }))
		expect(save()).toBeDisabled()
	})

	// The page is dirty while *any* section is: cleaning one of two must not disarm the button for the
	// other, which is what a single boolean instead of a set of ids would do.
	it('stays enabled while another section is still dirty', async () => {
		render(<Page ids={['a', 'b']} order={[]} />)

		await userEvent.click(screen.getByRole('button', { name: 'touch a' }))
		await userEvent.click(screen.getByRole('button', { name: 'touch b' }))
		await userEvent.click(screen.getByRole('button', { name: 'touch a' }))

		expect(save()).toBeEnabled()
	})

	/*
	 * Clean sections are asked too. Each one decides which of its own writes to send — the personalData has
	 * four mutations behind one form — and a registry that skipped them would have to know which mutation
	 * covers which field.
	 */
	it('asks every registered section, in registration order', async () => {
		const order: string[] = []
		render(<Page ids={['a', 'b', 'c']} order={order} />)

		await userEvent.click(screen.getByRole('button', { name: 'touch b' }))
		await userEvent.click(save())

		expect(order).toEqual(['a', 'b', 'c'])
	})

	// Stopping at the first refusal is the whole reason `save` answers a boolean: carrying on would
	// leave the owner with several half-applied blocks and one error message.
	it('stops at the first section that refuses', async () => {
		const order: string[] = []
		render(<Page ids={['a', 'b', 'c']} outcomes={{ b: false }} order={order} />)

		await userEvent.click(screen.getByRole('button', { name: 'touch a' }))
		await userEvent.click(save())

		expect(order).toEqual(['a', 'b'])
	})

	// A section that unmounts has to be forgotten, or the page stays dirty forever over a form nobody can
	// reach and the Save button asks a dead closure to write.
	it('forgets a dirty section when it unmounts', async () => {
		const order: string[] = []
		render(<Page ids={['a', 'b']} order={order} />)

		await userEvent.click(screen.getByRole('button', { name: 'touch b' }))
		expect(save()).toBeEnabled()

		await userEvent.click(screen.getByRole('button', { name: 'unmount last' }))
		expect(save()).toBeDisabled()

		await userEvent.click(screen.getByRole('button', { name: 'touch a' }))
		await userEvent.click(save())
		expect(order).toEqual(['a'])
	})

	/*
	 * A section unregisters the id it is registered under *now*.
	 *
	 * The cleanup deliberately sits in an effect of its own, keyed on the id, so that a section whose id
	 * moves lets go of the old one. Keyed on nothing instead, the closure would keep the id from the first
	 * render for good: the page would then hold two entries for one section and stay dirty over a form that
	 * has already gone.
	 */
	it('forgets the id it is registered under, not the one it mounted with', () => {
		const { rerender } = render(<PageId id="a" mounted />)
		expect(save()).toBeEnabled()

		rerender(<PageId id="b" mounted />)
		expect(save()).toBeEnabled()

		rerender(<PageId id="b" mounted={false} />)
		expect(save()).toBeDisabled()
	})

	/*
	 * `saveAll` reports the refusal itself, rather than leaving it to be inferred from the page still
	 * being dirty. A refused section is normally dirty too, which hides the difference — but not always:
	 * the shop panel refuses a queued deletion whose mutation failed while its form holds nothing.
	 */
	it('answers false when a section refuses, whatever the page thinks is dirty', async () => {
		const { result } = renderHook(() => useSaving())

		act(() => {
			result.current.register('a', { changed: false, save: async () => false })
		})

		await expect(result.current.saveAll()).resolves.toBe(false)
	})

	it('answers true when every section accepts', async () => {
		const { result } = renderHook(() => useSaving())

		act(() => {
			result.current.register('a', { changed: true, save: async () => true })
		})

		await expect(result.current.saveAll()).resolves.toBe(true)
	})

	/*
	 * The counter the page remounts its sections on, which is what puts every opened row back to a value
	 * and a pen after Save. It moves only for a save that went all the way through: a page left
	 * half-written still holds edits, and remounting would throw away the values the owner would then
	 * have to type again.
	 */
	it('counts a save that went through, and ignores one that did not', async () => {
		const { result } = renderHook(() => useSaving())
		const initial = result.current.version

		act(() => {
			result.current.register('a', { changed: true, save: async () => false })
		})
		await act(async () => {
			await result.current.saveAll()
		})

		expect(result.current.version).toBe(initial)

		act(() => {
			result.current.register('a', { changed: true, save: async () => true })
		})
		await act(async () => {
			await result.current.saveAll()
		})

		expect(result.current.version).toBe(initial + 1)
	})

	/*
	 * The dirty set is returned unchanged when nothing moved, and that is load-bearing rather than tidy: a
	 * section re-registers itself on every render of the page, so a `setModificate` that always handed back
	 * a new Set would re-render the page for each of them — and the page re-rendering is what makes the
	 * sections re-register.
	 */
	it('does not re-render the page when a section re-registers unchanged', () => {
		let render = 0
		const { result } = renderHook(() => {
			render += 1
			return useSaving()
		})
		const section = { changed: false, save: async () => true }

		act(() => {
			result.current.register('a', section)
		})
		const after = render

		act(() => {
			result.current.register('a', section)
		})
		act(() => {
			result.current.register('a', section)
		})

		expect(render).toBe(after)
	})
})

describe('SaveChanges', () => {
	// A page nobody has saved yet says nothing. Worth stating on its own: the condition the confirmation
	// hangs on is "saved *and* clean", and a page that has just loaded is already clean — so the flag
	// starting anywhere but false would put "Changes saved." over a page whose Save has never been
	// pressed, which is the one moment it is guaranteed to be a lie.
	it('says nothing before anything has been saved', () => {
		render(<Page ids={['a']} order={[]} />)

		expect(screen.queryByText('Changes saved.')).not.toBeInTheDocument()
	})

	it('confirms a save that went through', async () => {
		render(<Page ids={['a']} order={[]} />)

		await userEvent.click(screen.getByRole('button', { name: 'touch a' }))
		await userEvent.click(save())

		expect(screen.getByRole('status')).toHaveTextContent('Changes saved.')
		expect(save()).toBeDisabled()
	})

	// The confirmation must never sit above a form holding unsaved changes, so it is tied to "saved *and*
	// nothing has changed since" rather than to "a save succeeded once".
	it('withdraws the confirmation as soon as anything is edited again', async () => {
		render(<Page ids={['a']} order={[]} />)

		await userEvent.click(screen.getByRole('button', { name: 'touch a' }))
		await userEvent.click(save())
		await userEvent.click(screen.getByRole('button', { name: 'touch a' }))

		expect(screen.queryByText('Changes saved.')).not.toBeInTheDocument()
	})

	it('says nothing when the save was refused', async () => {
		render(<Page ids={['a']} outcomes={{ a: false }} order={[]} />)

		await userEvent.click(screen.getByRole('button', { name: 'touch a' }))
		await userEvent.click(save())

		expect(screen.queryByText('Changes saved.')).not.toBeInTheDocument()
	})

	// A second press while the first save is still in flight would fire every mutation twice.
	it('disables itself and shows a spinner while the save is in flight', async () => {
		let unblock = () => {
			/* replaced below */
		}
		const waitFor = new Promise<void>((resolve) => {
			unblock = resolve
		})

		render(<Page ids={['a']} order={[]} waitFor={waitFor} />)

		await userEvent.click(screen.getByRole('button', { name: 'touch a' }))
		await userEvent.click(save())

		// Not `save()`: the spinner's visually-hidden label is inside the button, so while the save is in
		// flight the button's accessible name is "Loading Save".
		expect(screen.getByRole('button', { name: /Save/ })).toBeDisabled()
		expect(screen.getByRole('status')).toHaveTextContent('Loading')

		unblock()
		expect(await screen.findByText('Changes saved.')).toBeInTheDocument()
	})

	it('renders', () => {
		const { container } = render(<SaveChanges changed saveAll={async () => true} />)

		expect(container.firstChild).toMatchSnapshot()
	})
})

/**
 * The smallest form that can be valid or not: one required name, which the schema also trims — the trim
 * is what makes "the writer is handed the resolver's output" something a test can see rather than
 * assert about itself.
 */
const schemaFirstName = z.object({ firstName: z.string().trim().min(1, 'First name is required') })

type FirstNameValues = z.infer<typeof schemaFirstName>

/*
 * ⚠️ `formState` is read here, in the render, and not only in the assertions. It is a proxy that
 * subscribes to whatever a render touches, so a hook that merely returned the form would leave
 * `result.current` frozen at its first value: `errors` and `isSubmitted` would still read empty and false
 * after a refusal, and both tests below would be measuring the subscription rather than the save.
 */
const formFirstName = (firstName = '') =>
	renderHook(() => {
		const form = useForm<FirstNameValues>({ resolver: zodResolver(schemaFirstName), defaultValues: { firstName } })

		void form.formState.errors
		void form.formState.isSubmitted

		return form
	}).result

/**
 * ⚠️ Inside `act`, and the result carried out through a variable rather than returned from the callback:
 * `handleSubmit` writes `errors` and `isSubmitted` into the form's state, so a call left outside would
 * update a mounted hook after the test had moved on.
 */
const outcomeOf = async (call: () => Promise<boolean>): Promise<boolean> => {
	let outcome = false

	await act(async () => {
		outcome = await call()
	})

	return outcome
}

/** The one field, plus the button the real sections' Save reaches it through. */
const FormFirstName = ({ write }: { write: (values: FirstNameValues) => Promise<boolean> }) => {
	const {
		register,
		handleSubmit,
		formState: { errors }
	} = useForm<FirstNameValues>({ resolver: zodResolver(schemaFirstName), defaultValues: { firstName: '' } })

	return (
		<>
			<TextField label="First name" error={errors.firstName?.message} {...register('firstName')} />
			<button
				type="button"
				onClick={() => {
					void saveValidated(handleSubmit, write)
				}}
			>
				Save
			</button>
		</>
	)
}

describe('saveValidated', () => {
	it('does not write, and answers false, when the form does not validate', async () => {
		const form = formFirstName('   ')
		const write = vi.fn(async () => true)

		expect(await outcomeOf(async () => await saveValidated(form.current.handleSubmit, write))).toBe(false)
		expect(write).not.toHaveBeenCalled()
		expect(form.current.formState.errors.firstName?.message).toBe('First name is required')
	})

	it('writes, and answers true, when the form validates', async () => {
		const form = formFirstName('Mark')
		const write = vi.fn(async () => true)

		expect(await outcomeOf(async () => await saveValidated(form.current.handleSubmit, write))).toBe(true)
		expect(write).toHaveBeenCalledTimes(1)
	})

	// A valid form whose mutation came back with an error is still a refusal — the page has to stop at it
	// exactly as it stops at an invalid one, or the sections after it write on top of a failed save.
	it('answers false when the write itself fails', async () => {
		const form = formFirstName('Mark')

		expect(await outcomeOf(async () => await saveValidated(form.current.handleSubmit, async () => false))).toBe(false)
	})

	/*
	 * ⚠️ The writer receives the **resolver's output**, not the raw form state: zod's transforms have already
	 * run. That is what let the `schema.parse(getValues())` line disappear from every section rather than
	 * move — a `handleSubmit` handed the untransformed values would silently start sending untrimmed strings
	 * and a lower-case province to the server.
	 */
	it('hands the writer the parsed values, transforms and all', async () => {
		const form = formFirstName('  Mark  ')
		const write = vi.fn(async () => true)

		await outcomeOf(async () => await saveValidated(form.current.handleSubmit, write))

		// The second argument is the submit event, and there is none: the save is a button press routed
		// through the page's registry, not a `<form onSubmit>`. Asserted rather than left off, since a
		// handler reading `event.preventDefault()` would be reading `undefined`.
		expect(write).toHaveBeenCalledWith({ firstName: 'Mark' }, undefined)
	})

	/*
	 * The reason this exists at all, rather than the `trigger()` every section used to call.
	 *
	 * `trigger()` fills `errors` but leaves `isSubmitted` false, and `isSubmitted` is what turns on
	 * react-hook-form's default `reValidateMode: 'onChange'`. Without it the red box stays red while it is
	 * being corrected, until Save is pressed a second time to find out whether the correction worked.
	 */
	it('marks the form submitted, so a corrected field clears itself', async () => {
		const form = formFirstName()

		await outcomeOf(async () => await saveValidated(form.current.handleSubmit, async () => true))

		expect(form.current.formState.isSubmitted).toBe(true)
	})

	// The same thing seen from the page: the refused box turns red, and goes back to white as it is typed
	// into — no second press.
	it('paints the refused field red and clears it as it is corrected', async () => {
		render(<FormFirstName write={async () => true} />)

		await userEvent.click(save())

		expect(screen.getByLabelText('First name')).toHaveClass('border-2', 'bg-app-error/10')
		expect(screen.getByText('First name is required')).toBeInTheDocument()

		await userEvent.type(screen.getByLabelText('First name'), 'Mark')

		expect(screen.getByLabelText('First name')).toHaveClass('border', 'bg-white')
		expect(screen.getByLabelText('First name')).not.toHaveClass('bg-app-error/10')
		expect(screen.queryByText('First name is required')).not.toBeInTheDocument()
	})
})
