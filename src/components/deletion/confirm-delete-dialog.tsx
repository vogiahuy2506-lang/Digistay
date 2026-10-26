'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { Alert, AlertDescription, Button, Input, Loading, Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui'
import { sameName } from '@/lib/deletion/rules'

export interface ConfirmDeleteDialogProps {
  open: boolean
  onClose: () => void
  title: string
  /** The name to type (the property's or workspace's); null while loading. */
  name: string | null
  loading: boolean
  loadError?: string
  /** What deleting does, one fact per item. */
  facts: React.ReactNode[]
  /** Something to weigh before deleting (a paid plan's remaining time). */
  warning?: React.ReactNode
  /** Why it cannot be deleted now (guests booked…): shown, and the button stays off. */
  blocked?: React.ReactNode
  confirmLabel: string
  /** Deletes; resolves to an error to show, or null when done. */
  onConfirm: (typedName: string) => Promise<string | null>
}

/**
 * The confirm step of deleting a property or a workspace (src/lib/deletion):
 * what happens, what stops it, and the name typed by hand before the red
 * button turns on. The server checks the name and the rules again.
 */
export function ConfirmDeleteDialog({
  open,
  onClose,
  title,
  name,
  loading,
  loadError,
  facts,
  warning,
  blocked,
  confirmLabel,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const t = useTranslations('dash.deletion')
  const inputId = React.useId()
  const [typed, setTyped] = React.useState('')
  const [error, setError] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  // A fresh start every time it opens.
  React.useEffect(() => {
    if (!open) return
    setTyped('')
    setError('')
    setSubmitting(false)
  }, [open])

  const matches = name !== null && sameName(typed, name)
  const canDelete = !loading && !loadError && !blocked && matches && !submitting

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canDelete) return
    setSubmitting(true)
    setError('')
    const problem = await onConfirm(typed)
    setSubmitting(false)
    if (problem) setError(problem)
  }

  const close = () => {
    if (!submitting) onClose()
  }

  return (
    <Modal isOpen={open} onClose={close} title={title}>
      <form onSubmit={submit} className="flex flex-col min-h-0" data-testid="confirm-delete-dialog">
        <ModalHeader onClose={close}>
          <span className="w-8 h-8 shrink-0 rounded-ctl bg-err-soft text-err flex items-center justify-center" aria-hidden="true">
            <Trash2 className="w-4 h-4" />
          </span>
          <h2 className="text-lg font-semibold text-fg break-words min-w-0">{title}</h2>
        </ModalHeader>
        <ModalBody className="space-y-4">
          {loading ? (
            <Loading className="py-8" text={t('checking')} />
          ) : loadError ? (
            <Alert variant="destructive">
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          ) : (
            <>
              <ul className="space-y-2.5 text-small text-fg">
                {facts.map((fact, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-muted" aria-hidden="true" />
                    <span className="min-w-0">{fact}</span>
                  </li>
                ))}
              </ul>
              {warning && (
                <Alert variant="warning" className="flex gap-2.5">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                  <AlertDescription>{warning}</AlertDescription>
                </Alert>
              )}
              {blocked && (
                <Alert variant="destructive" data-testid="delete-blocked">
                  <AlertDescription>{blocked}</AlertDescription>
                </Alert>
              )}
              {name !== null && !blocked && (
                <div>
                  <label htmlFor={inputId} className="block text-small text-fg mb-1.5">
                    {t.rich('typeName', { name, b: (chunks) => <strong className="font-semibold break-words">{chunks}</strong> })}
                  </label>
                  <Input
                    id={inputId}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-label={t('nameLabel')}
                    error={name && typed.trim().length >= name.trim().length && !matches ? t('nameMismatch') : undefined}
                    data-testid="confirm-delete-name"
                  />
                </div>
              )}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </>
          )}
        </ModalBody>
        <ModalFooter className="sm:justify-end">
          <Button type="button" variant="outline" onClick={close} disabled={submitting} className="w-full sm:w-auto">
            {t('cancel')}
          </Button>
          <Button type="submit" variant="danger" disabled={!canDelete} isLoading={submitting} className="w-full sm:w-auto">
            {confirmLabel}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
