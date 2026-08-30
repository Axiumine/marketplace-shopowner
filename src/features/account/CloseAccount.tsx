import { useState } from 'react'
import { useMutation } from 'urql'

import { CTX_SHOP_OWNER_RESOURCE } from '@/api/endpoints'
import { messageOf } from '@/api/errors'
import { ShopOwnerDelDocument } from '@/api/operations/shopOwnerResource/mutations'
import { useLogout } from '@/auth/useLogout'
import { Button } from '@/components/ui/Button'
import { CheckboxField } from '@/components/ui/CheckboxField'
import { Infobox } from '@/components/ui/Infobox'
import { Toast } from '@/components/ui/Toast'

/** What the box has to be ticked for. Exported so the test asserts the copy rather than a paraphrase. */
export const CONFIRM_LABEL = 'I understand my shops and items go offline and every session of mine ends'

/** The refusal, when the server answers `false` with no error of its own to quote. */
export const CLOSE_REFUSED = 'The account was not closed.'

/**
 * Closing your own account.
 *
 * ⚠️ **The mutation takes no arguments, and that absence is the security property** — the account it
 * closes is the one the Redis session behind the access token names. An `_id` here would ask the backend
 * to accept from a browser the one thing the session already proves, which is the same rule the whole
 * repo follows for `companyDel` and friends.
 *
 * The two-step is a tick and then a press, not a typed word. What this button does is undoable for thirty
 * days (ADR-046), so the gate is proportionate to a decision that can be taken back rather than to a
 * shredder — but it is a real gate, because the half of it that cannot be taken back is immediate: the
 * shops go dark the moment it is pressed, and the owner republishes them by hand afterwards (ADR-045).
 *
 * ⚠️ **No `additionalTypenames` on the context, unlike every other write in this app.** The two lists
 * `shopOwnerDel` empties are on pages the owner is about to be thrown off, and nothing re-reads either
 * before the navigation — so naming `GraphQLCompany` and `GraphQLItem` here would be a line no test can
 * observe. That the document cache outlives a logout at all is a separate and wider problem — it is keyed
 * by query, `shopOwnerCompanies` takes no variables, and `useLogout` clears the token and the session but
 * not the client — and it belongs to whoever fixes it for all four operations, not to this button.
 *
 * On success the owner is logged out through `useLogout`, the same path the sidebar button uses. The
 * `logout` mutation it sends will very likely fail — the backend has just ended every session this
 * account had — and that is why it is the right call rather than a lucky one: `useLogout` clears the
 * token, the session and the pending address without looking at the result, so the local teardown is
 * identical whether the server had anything left to delete or not.
 */
export const CloseAccount = () => {
	const [confirmed, setConfirmed] = useState(false)
	const [refused, setRefused] = useState<string | undefined>(undefined)
	const [del, runDel] = useMutation(ShopOwnerDelDocument)
	const logout = useLogout()

	const close = async () => {
		const outcome = await runDel({}, CTX_SHOP_OWNER_RESOURCE)

		if (outcome.data?.shopOwnerDel !== true) {
			setRefused(outcome.error === undefined ? CLOSE_REFUSED : messageOf(outcome.error))
			return
		}

		await logout()
	}

	return (
		<Infobox title="Close my account">
			<div className="flex flex-col gap-4 text-sm">
				<p>
					Closing your account takes your shops and everything in their catalogues off the marketplace straight away, and ends
					every session you have open — here and in any other browser.
				</p>

				<p>
					You have <strong>thirty days</strong> to change your mind. Register again at this same email address inside that window
					and confirm the message we send you: the account comes back as it was, with the same shops, the same items and the same
					details. They come back <strong>unpublished</strong> — you put them back on the marketplace yourself, when you are
					ready — and the account goes back into the approval queue, so an admin approves it once more before you can sign in.
				</p>

				{/*
				 * Said here because it is the one consequence an owner may believe they are buying: closing and
				 * re-registering is not a way out of a suspension. ADR-044 gives the admin tier the only hand
				 * that lifts one, and ADR-046 leaves `disabled`, `disabledBy` and `disabledReason` untouched
				 * through the whole restore, precisely so this route cannot be used as one.
				 */}
				<p>
					A suspension is not lifted by closing your account. If an admin has suspended you, the suspension comes back with the
					account, and only an admin can take it off.
				</p>

				<p>
					After thirty days your personal details are overwritten and the account cannot be brought back at all. Nothing here is
					a way to have your data kept — it is the opposite.
				</p>

				<CheckboxField
					label={CONFIRM_LABEL}
					checked={confirmed}
					onChange={() => {
						setConfirmed((current) => !current)
					}}
				/>

				<div>
					<Button
						variant="danger"
						disabled={!confirmed}
						loading={del.fetching}
						onClick={() => {
							void close()
						}}
					>
						Close my account
					</Button>
				</div>

				{refused === undefined ? null : <Toast tone="error">{refused}</Toast>}
			</div>
		</Infobox>
	)
}
