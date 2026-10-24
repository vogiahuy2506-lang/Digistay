'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check, DoorOpen, Pencil, Trash2 } from 'lucide-react'
import { Badge, Button, Card, CardContent, Input } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import { apiError } from '@/lib/i18n/api-errors'

export interface ListedRoom {
  id: string
  number: string
  floor: number | null
  isActive: boolean
}

export interface RoomTypeRooms {
  id: string
  name: string
  totalRooms: number
  rooms: ListedRoom[]
}

/**
 * The hotel's numbered rooms by room type (src/lib/bookings/rooms.ts): add
 * many at once ("101-110, 201"), rename, set the floor, stop or resume
 * using one, delete. A type with rooms counts its active rooms as its
 * inventory; one without works as before.
 */
export function RoomList({ propertyId, onChanged }: { propertyId: string; onChanged: () => void }) {
  const t = useTranslations('dash.rooms.rooms.roomList')
  const tc = useTranslations('dash.common')
  const [types, setTypes] = React.useState<RoomTypeRooms[] | null>(null)
  const [adding, setAdding] = React.useState<Record<string, { numbers: string; floor: string }>>({})
  const [editing, setEditing] = React.useState<{ id: string; number: string; floor: string } | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/properties/${propertyId}/rooms`, { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (data.success) setTypes(data.data)
  }, [propertyId])

  React.useEffect(() => {
    load()
  }, [load])

  const done = async () => {
    await load()
    onChanged()
  }

  const add = async (roomTypeId: string) => {
    const form = adding[roomTypeId]
    if (!form?.numbers.trim()) return
    setBusy(`add:${roomTypeId}`)
    try {
      const res = await fetch(`/api/properties/${propertyId}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomTypeId, numbers: form.numbers, floor: form.floor === '' ? null : Number(form.floor) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!data.success) {
        toast.error(t('addFailed'), apiError(data.error))
        return
      }
      toast.success(t('added', { count: data.data.created }))
      setAdding((a) => ({ ...a, [roomTypeId]: { numbers: '', floor: form.floor } }))
      await done()
    } finally {
      setBusy(null)
    }
  }

  const update = async (room: ListedRoom, body: Record<string, unknown>) => {
    setBusy(room.id)
    try {
      const res = await fetch(`/api/rooms/${room.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!data.success) {
        toast.error(t('saveFailed'), apiError(data.error))
        return false
      }
      await done()
      return true
    } finally {
      setBusy(null)
    }
  }

  const remove = async (room: ListedRoom) => {
    if (!confirm(t('confirmDelete', { number: room.number }))) return
    setBusy(room.id)
    try {
      const res = await fetch(`/api/rooms/${room.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!data.success) {
        toast.error(t('deleteFailed'), apiError(data.error))
        return
      }
      toast.success(t('deleted', { number: room.number }))
      await done()
    } finally {
      setBusy(null)
    }
  }

  if (!types) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-acc border-t-transparent rounded-full mx-auto" />
      </div>
    )
  }
  if (types.length === 0) return <p className="py-12 text-center text-muted">{t('noTypes')}</p>

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{t('intro')}</p>
      {types.map((type) => {
        const active = type.rooms.filter((r) => r.isActive).length
        const form = adding[type.id] ?? { numbers: '', floor: '' }
        return (
          <Card key={type.id}>
            <CardContent className="p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-fg">{type.name}</p>
                  <p className="text-sm text-muted">
                    {type.rooms.length > 0 ? t('countListed', { active, total: type.rooms.length }) : t('countOnly', { count: type.totalRooms })}
                  </p>
                </div>
              </div>

              {type.rooms.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {type.rooms.map((room) =>
                    editing?.id === room.id ? (
                      <li key={room.id} className="flex items-center gap-1.5 rounded-ctl border border-acc px-2 py-1.5">
                        <Input
                          aria-label={t('number')}
                          value={editing.number}
                          onChange={(e) => setEditing({ ...editing, number: e.target.value })}
                          className="h-8 w-20"
                          autoFocus
                        />
                        <Input
                          aria-label={t('floor')}
                          type="number"
                          placeholder={t('floor')}
                          value={editing.floor}
                          onChange={(e) => setEditing({ ...editing, floor: e.target.value })}
                          className="h-8 w-16"
                        />
                        <Button
                          size="sm"
                          aria-label={tc('actions.save')}
                          isLoading={busy === room.id}
                          onClick={async () => {
                            if (await update(room, { number: editing.number, floor: editing.floor === '' ? null : Number(editing.floor) })) setEditing(null)
                          }}
                        >
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          {tc('actions.cancel')}
                        </Button>
                      </li>
                    ) : (
                      <li
                        key={room.id}
                        className={`group flex items-center gap-2 rounded-ctl border px-3 py-1.5 text-sm ${room.isActive ? 'border-line bg-panel' : 'border-dashed border-line bg-fg/[0.03] text-muted'}`}
                      >
                        <DoorOpen className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
                        <span className="font-semibold tabular-nums">{room.number}</span>
                        {room.floor !== null && <span className="text-xs text-muted">{t('floorShort', { floor: room.floor })}</span>}
                        {!room.isActive && <Badge variant="gray">{t('stopped')}</Badge>}
                        <span className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => setEditing({ id: room.id, number: room.number, floor: room.floor === null ? '' : String(room.floor) })}
                            aria-label={t('editRoom', { number: room.number })}
                            className="w-7 h-7 rounded-ctl flex items-center justify-center text-muted hover:text-fg hover:bg-fg/5"
                          >
                            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => update(room, { isActive: !room.isActive })}
                            disabled={busy === room.id}
                            className="px-1.5 h-7 rounded-ctl text-xs text-muted hover:text-fg hover:bg-fg/5"
                          >
                            {room.isActive ? t('stop') : t('resume')}
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(room)}
                            disabled={busy === room.id}
                            aria-label={t('deleteRoom', { number: room.number })}
                            className="w-7 h-7 rounded-ctl flex items-center justify-center text-muted hover:text-err hover:bg-err-soft"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </span>
                      </li>
                    )
                  )}
                </ul>
              )}

              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  add(type.id)
                }}
              >
                <div className="w-full sm:w-64">
                  <Input
                    label={t('addLabel', { type: type.name })}
                    placeholder={t('addPlaceholder')}
                    value={form.numbers}
                    onChange={(e) => setAdding((a) => ({ ...a, [type.id]: { ...form, numbers: e.target.value } }))}
                  />
                </div>
                <div className="w-24">
                  <Input
                    label={t('floor')}
                    type="number"
                    value={form.floor}
                    onChange={(e) => setAdding((a) => ({ ...a, [type.id]: { ...form, floor: e.target.value } }))}
                  />
                </div>
                <Button type="submit" variant="outline" isLoading={busy === `add:${type.id}`} disabled={!form.numbers.trim()}>
                  {t('add')}
                </Button>
              </form>
              {type.rooms.length === 0 && <p className="text-xs text-muted">{t('firstHint', { count: type.totalRooms })}</p>}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
