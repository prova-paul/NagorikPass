'use client'

import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Modal'
import type { ActionResult } from '@/lib/actionResult'
import { useAction } from './useAction'

/** A button that asks before it runs an action that changes who can sign in. */
export function ConfirmAccessButton({
  label,
  title,
  confirmLabel,
  danger = false,
  run: action,
  size = 'sm',
  children,
}: {
  label: string
  title: string
  confirmLabel: string
  danger?: boolean
  run: () => Promise<ActionResult>
  size?: 'sm' | 'md'
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const { run, pending } = useAction()

  return (
    <>
      <Button variant="secondary" size={size} onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open && (
        <ConfirmDialog
          title={title}
          confirmLabel={confirmLabel}
          variant={danger ? 'danger' : 'primary'}
          loading={pending}
          onClose={() => !pending && setOpen(false)}
          onConfirm={() => run(action, () => setOpen(false))}
        >
          {children}
        </ConfirmDialog>
      )}
    </>
  )
}
