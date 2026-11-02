'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  NumberInput,
  Select,
  Textarea,
  toast,
} from '@/components/ui'
import { useDashLabels } from '@/lib/i18n/dash'
import { apiError } from '@/lib/i18n/api-errors'

interface AvailableService {
  id: string
  name: string
  price: number
  priceType: string
  category: string | null
}

export function AddServiceDialog({
  bookingId,
  isOpen,
  onClose,
  onDone,
}: {
  bookingId: string
  isOpen: boolean
  onClose: () => void
  onDone: () => void
}) {
  const t = useTranslations('dash.bookings.detail')
  const tb = useTranslations('dash.bookings')
  const tc = useTranslations('dash.common')
  const labels = useDashLabels()

  const [catalog, setCatalog] = React.useState<AvailableService[]>([])
  const [loading, setLoading] = React.useState(false)
  const [selectedServiceId, setSelectedServiceId] = React.useState<string>('__custom')
  const [name, setName] = React.useState('')
  const [unitPrice, setUnitPrice] = React.useState('')
  const [quantity, setQuantity] = React.useState(1)
  const [notes, setNotes] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!isOpen) return

    setError(null)
    setSaving(false)
    setNotes('')
    setQuantity(1)

    let active = true
    setLoading(true)

    fetch(`/api/bookings/${bookingId}/services`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return
        if (data.success && Array.isArray(data.data?.availableServices)) {
          const list: AvailableService[] = data.data.availableServices
          setCatalog(list)
          if (list.length > 0) {
            setSelectedServiceId(list[0].id)
            setName(list[0].name)
            setUnitPrice(String(list[0].price))
          } else {
            setSelectedServiceId('__custom')
            setName('')
            setUnitPrice('')
          }
        }
      })
      .catch(() => {
        if (!active) return
        setCatalog([])
        setSelectedServiceId('__custom')
        setName('')
        setUnitPrice('')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [isOpen, bookingId])

  const handleSelectService = (id: string) => {
    setSelectedServiceId(id)
    setError(null)
    if (id === '__custom') {
      setName('')
      setUnitPrice('')
    } else {
      const found = catalog.find((item) => item.id === id)
      if (found) {
        setName(found.name)
        setUnitPrice(String(found.price))
      }
    }
  }

  const numPrice = Number(unitPrice || 0)
  const total = numPrice * quantity

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError(t('money.serviceName'))
      return
    }
    if (numPrice < 0) {
      setError(t('money.servicePrice'))
      return
    }
    if (quantity < 1) {
      setError(t('money.serviceQuantity'))
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selectedServiceId !== '__custom' ? selectedServiceId : undefined,
          name: name.trim(),
          unitPrice: numPrice,
          quantity,
          notes: notes.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(t('money.addServiceSuccess'))
        onDone()
        onClose()
      } else {
        setError(apiError(data.error) || tb('actions.failed'))
      }
    } catch {
      setError(tb('actions.noConnection'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={() => !saving && onClose()} size="sm">
      <ModalHeader onClose={() => !saving && onClose()}>
        <span className="font-semibold">{t('money.addServiceTitle')}</span>
      </ModalHeader>
      <form onSubmit={handleSubmit}>
        <ModalBody className="space-y-4">
          {error && (
            <div className="p-3 text-xs rounded-ctl bg-danger/10 text-danger border border-danger/20">
              {error}
            </div>
          )}

          <div>
            <Select
              label={t('money.selectFromCatalog')}
              value={selectedServiceId}
              onChange={(e) => handleSelectService(e.target.value)}
              disabled={loading || saving}
            >
              {catalog.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({labels.money(item.price)})
                </option>
              ))}
              <option value="__custom">{t('money.customService')}</option>
            </Select>
          </div>

          <div>
            <Input
              label={t('money.serviceName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={selectedServiceId !== '__custom' || saving}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <NumberInput
                label={t('money.servicePrice')}
                value={unitPrice}
                onValueChange={(val) => setUnitPrice(val)}
                disabled={saving}
                required
              />
            </div>
            <div>
              <Input
                type="number"
                min="1"
                step="1"
                label={t('money.serviceQuantity')}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                disabled={saving}
                required
              />
            </div>
          </div>

          <div>
            <Textarea
              label={t('money.serviceNotes')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="VD: Mang lên phòng 201, giặt gấp trong ngày..."
              rows={2}
              disabled={saving}
            />
          </div>

          <div className="flex justify-between items-center py-2 px-3 rounded-ctl bg-fg/[0.04] border border-line">
            <span className="text-small text-muted">{t('money.serviceTotal')}</span>
            <span className="text-body font-semibold text-fg tabular-nums">
              {labels.money(total)}
            </span>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" type="button" onClick={onClose} disabled={saving}>
            {tc('actions.cancel')}
          </Button>
          <Button variant="primary" type="submit" disabled={saving || loading}>
            {saving ? tc('actions.saving') : t('money.addService')}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
