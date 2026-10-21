'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Button, Input, Modal, ModalBody, ModalFooter, ModalHeader, Textarea } from '@/components/ui'
import { EnglishCopy } from '@/components/ui/english-copy'
import { toast } from '@/components/ui/toast'

export interface EditableProperty {
  id: string
  name: string
  address: string
  city: string
  district: string | null
  phone: string | null
  email: string | null
  description: string | null
  translations?: { en?: { description?: string } } | null
}

/** The property header's "Chỉnh sửa": the hotel's name, address, contacts and description. */
export function EditPropertyModal({
  property,
  isOpen,
  onClose,
  onSaved,
}: {
  property: EditableProperty
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('dash.property')
  const tc = useTranslations('dash.common')
  const initial = React.useCallback(
    () => ({
      name: property.name,
      address: property.address,
      city: property.city,
      district: property.district ?? '',
      phone: property.phone ?? '',
      email: property.email ?? '',
      description: property.description ?? '',
      enDescription: property.translations?.en?.description ?? '',
    }),
    [property]
  )
  const [form, setForm] = React.useState(initial)
  const [saving, setSaving] = React.useState(false)

  // Each opening starts from the saved values.
  React.useEffect(() => {
    if (isOpen) setForm(initial())
  }, [isOpen, initial])

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value })

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { enDescription, ...fields } = form
      const res = await fetch(`/api/properties/${property.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, translations: { en: { description: enDescription } } }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        toast.error(data.error || t('detail.editModal.failed'))
        return
      }
      toast.success(t('detail.editModal.saved'))
      onSaved()
      onClose()
    } catch {
      toast.error(t('detail.editModal.failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <form onSubmit={save} className="flex flex-col min-h-0">
        <ModalHeader onClose={onClose}>
          <h2 className="text-lg font-semibold text-fg">{t('detail.editModal.title')}</h2>
        </ModalHeader>
        <ModalBody className="space-y-4">
          <Input label={t('form.name')} value={form.name} onChange={set('name')} required minLength={2} maxLength={200} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label={t('form.address')} value={form.address} onChange={set('address')} required minLength={5} />
            <Input label={t('form.city')} value={form.city} onChange={set('city')} required minLength={2} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label={t('form.district')} value={form.district} onChange={set('district')} />
            <Input label={t('form.phone')} type="tel" value={form.phone} onChange={set('phone')} />
          </div>
          <Input label={t('form.email')} type="email" value={form.email} onChange={set('email')} />
          <Textarea
            label={t('form.description')}
            value={form.description}
            onChange={set('description')}
            placeholder={t('form.descriptionPlaceholder')}
            rows={4}
            maxLength={2000}
          />
          <EnglishCopy filled={Boolean(form.enDescription)}>
            <Textarea
              label={t('form.description')}
              value={form.enDescription}
              onChange={set('enDescription')}
              placeholder={form.description}
              rows={4}
              maxLength={2000}
            />
          </EnglishCopy>
        </ModalBody>
        <ModalFooter className="sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" isLoading={saving}>
            {tc('actions.saveChanges')}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
