'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { addCardAction } from '@/app/admin/cards/actions'
import { useAction } from '@/components/employees/useAction'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

export function AddCardButton() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | undefined>()
  const { run, pending } = useAction()

  function close() {
    setOpen(false)
    setValue('')
    setError(undefined)
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (value.trim() === '') return setError('Enter the card number.')
    run(
      () => addCardAction(value),
      (result) => (result.ok ? close() : setError(result.message)),
    )
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden className="size-4" />
        Add card
      </Button>
      {open && (
        <Modal
          title="Add visitor card"
          onClose={close}
          dismissible={!pending}
          footer={
            <>
              <Button variant="secondary" onClick={close} disabled={pending}>Cancel</Button>
              <Button type="submit" form="card-form" loading={pending}>Add card</Button>
            </>
          }
        >
          <form id="card-form" onSubmit={submit} noValidate>
            <Input
              label="Card number / ID *"
              value={value}
              onChange={(event) => {
                setValue(event.target.value)
                setError(undefined)
              }}
              error={error}
              hint="Each card number must be unique. The card is available to the receptionist at once."
              autoComplete="off"
              autoFocus
            />
          </form>
        </Modal>
      )}
    </>
  )
}
