'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button, IconButton } from './Button'

export function Modal({
  title,
  onClose,
  footer,
  children,
  wide = false,
  dismissible = true,
}: {
  title: string
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
  wide?: boolean
  /** False when closing by accident would lose something, such as a password shown once. */
  dismissible?: boolean
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    // Closing while still in the document returns focus to whatever opened the dialog.
    return () => dialog?.close()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault()
        if (dismissible) onClose()
      }}
      onClick={(event) => {
        if (dismissible && event.target === dialogRef.current) onClose()
      }}
      className={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-hidden rounded-card bg-surface p-0 text-left font-normal whitespace-normal text-ink shadow-overlay backdrop:bg-navy-950/50 ${
        wide ? 'max-w-2xl' : 'max-w-md'
      }`}
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="min-w-0 text-lg font-semibold wrap-anywhere">{title}</h2>
          {dismissible && (
            <IconButton label="Close" onClick={onClose} className="-my-1 -mr-1 border-transparent">
              <X aria-hidden className="size-5" />
            </IconButton>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </dialog>
  )
}

export function ConfirmDialog({
  title,
  confirmLabel,
  cancelLabel = 'Go back',
  variant = 'primary',
  confirmDisabled = false,
  loading = false,
  onConfirm,
  onClose,
  children,
}: {
  title: string
  confirmLabel: string
  cancelLabel?: string
  variant?: 'primary' | 'danger'
  confirmDisabled?: boolean
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
  children: ReactNode
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} disabled={confirmDisabled} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  )
}
