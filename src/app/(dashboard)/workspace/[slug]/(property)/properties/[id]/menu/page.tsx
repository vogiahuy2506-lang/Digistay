'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowDown, ArrowUp, ImageIcon, Pencil, Plus, Trash2, Upload, UtensilsCrossed } from 'lucide-react'
import { Header, PageContainer } from '@/components/layout'
import { useWorkspaceRole } from '@/components/layout/workspace-context'
import { Badge, Button, Input, Modal, ModalBody, ModalFooter, Textarea } from '@/components/ui'
import { EnglishCopy } from '@/components/ui/english-copy'
import { toast } from '@/components/ui/toast'
import { apiError } from '@/lib/i18n/api-errors'
import { useDashLabels } from '@/lib/i18n/dash'
import { groupMenuItems, isMenuImageUrl, moveMenuGroup, moveMenuItem, type MenuGroup } from '@/lib/menu/menu'
import { resizedImage } from '@/lib/media/image-url'
import { UploadClientError, uploadPhoto } from '@/lib/media/upload-client'

interface MenuItem {
  id: string
  name: string
  description: string | null
  price: number
  imageUrl: string | null
  category: string | null
  translations?: { en?: { name?: string; description?: string; category?: string } } | null
  isAvailable: boolean
  sortOrder: number
}

interface Form {
  name: string
  category: string
  price: string
  description: string
  imageUrl: string
  isAvailable: boolean
  en: { name: string; description: string; category: string }
}

const EMPTY_FORM: Form = {
  name: '',
  category: '',
  price: '',
  description: '',
  imageUrl: '',
  isAvailable: true,
  en: { name: '', description: '', category: '' },
}

const iconButton =
  'w-9 h-9 sm:w-8 sm:h-8 shrink-0 rounded-ctl flex items-center justify-center text-muted transition-colors duration-160 ' +
  'hover:text-fg hover:bg-fg/5 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-acc'

/**
 * The hotel's restaurant menu (src/lib/menu/menu.ts): dishes in the hotel's
 * own groups, with price and photo, shown on its website's menu block. The
 * owner, admins and managers edit it; other members only see it.
 */
export default function MenuPage() {
  const t = useTranslations('dash.menu')
  const tc = useTranslations('dash.common')
  const labels = useDashLabels()
  const role = useWorkspaceRole()
  const canEdit = role === 'ADMIN' || role === 'MANAGER'
  const { id: propertyId } = useParams<{ slug: string; id: string }>()

  const [items, setItems] = React.useState<MenuItem[] | null>(null)
  const [loadFailed, setLoadFailed] = React.useState(false)
  const [reordering, setReordering] = React.useState(false)
  const [editing, setEditing] = React.useState<MenuItem | 'new' | null>(null)

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/properties/${propertyId}/menu`, { cache: 'no-store' }).catch(() => null)
    const data = res ? await res.json().catch(() => null) : null
    if (data?.success) {
      setItems(data.data)
      setLoadFailed(false)
    } else {
      setLoadFailed(true)
      toast.error(t('loadFailed'), apiError(data?.error))
    }
  }, [propertyId, t])

  React.useEffect(() => {
    load()
  }, [load])

  const groups = React.useMemo(() => groupMenuItems(items ?? []), [items])

  /** Stores a new order (ids); shown at once, put back if the server refuses it. */
  const saveOrder = async (order: string[] | null) => {
    if (!order || !items) return
    const before = items
    const place = new Map(order.map((itemId, i) => [itemId, i]))
    setItems(items.map((item) => ({ ...item, sortOrder: place.get(item.id) ?? item.sortOrder })))
    setReordering(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/menu`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      })
      const data = await res.json().catch(() => ({}))
      if (!data.success) {
        setItems(before)
        toast.error(t('list.moveFailed'), apiError(data.error))
        if (res.status === 409) await load()
      }
    } catch {
      setItems(before)
      toast.error(t('list.moveFailed'))
    } finally {
      setReordering(false)
    }
  }

  const remove = async (item: MenuItem) => {
    if (!confirm(t('list.deleteConfirm', { name: item.name }))) return
    const res = await fetch(`/api/properties/${propertyId}/menu/${item.id}`, { method: 'DELETE' }).catch(() => null)
    const data = res ? await res.json().catch(() => ({})) : {}
    if (!data.success) {
      toast.error(t('list.deleteFailed'), apiError(data.error))
      return
    }
    toast.success(t('list.deleted'))
    setItems((list) => list?.filter((i) => i.id !== item.id) ?? null)
  }

  const addButton = canEdit ? (
    <Button onClick={() => setEditing('new')}>
      <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
      {t('add')}
    </Button>
  ) : undefined

  return (
    <PageContainer>
      <div className="max-w-5xl mx-auto">
        <Header title={t('title')} description={t('description')} actions={items && items.length > 0 ? addButton : undefined} />
        {!canEdit && role && <p className="mb-4 text-small text-muted">{t('readOnly')}</p>}

        {items === null ? (
          loadFailed ? (
            <div className="rounded-box border border-line bg-panel px-6 py-12 text-center">
              <p className="text-body text-fg mb-4">{t('loadFailed')}</p>
              <Button variant="secondary" onClick={load}>
                {tc('actions.retry')}
              </Button>
            </div>
          ) : (
            <div className="space-y-3" aria-busy="true">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-box bg-fg/5 animate-pulse" />
              ))}
            </div>
          )
        ) : items.length === 0 ? (
          <div className="rounded-box border border-dashed border-line bg-panel px-6 py-12 text-center">
            <UtensilsCrossed className="w-8 h-8 text-muted mx-auto mb-4" aria-hidden="true" />
            <p className="text-body font-medium text-fg">{t('empty.title')}</p>
            <p className="mx-auto mt-2 max-w-xl text-small text-muted">{t('empty.body')}</p>
            <p className="mx-auto mt-2 max-w-xl text-small text-muted">{t('empty.note')}</p>
            {canEdit && (
              <Button className="mt-6" onClick={() => setEditing('new')}>
                <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                {t('empty.addFirst')}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group, groupIndex) => (
              <MenuGroupCard
                key={group.key}
                group={group}
                label={group.category ?? t('list.noCategory')}
                canEdit={canEdit}
                busy={reordering}
                first={groupIndex === 0}
                last={groupIndex === groups.length - 1}
                onMoveGroup={(step) => saveOrder(moveMenuGroup(groups, group.key, step))}
                onMoveItem={(item, step) => saveOrder(moveMenuItem(groups, item.id, step))}
                onEdit={setEditing}
                onDelete={remove}
                money={labels.money}
              />
            ))}
          </div>
        )}
      </div>

      {editing && (
        <MenuItemDialog
          propertyId={propertyId}
          item={editing === 'new' ? null : editing}
          items={items ?? []}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await load()
          }}
        />
      )}
    </PageContainer>
  )
}

function MenuGroupCard({
  group,
  label,
  canEdit,
  busy,
  first,
  last,
  onMoveGroup,
  onMoveItem,
  onEdit,
  onDelete,
  money,
}: {
  group: MenuGroup<MenuItem>
  label: string
  canEdit: boolean
  busy: boolean
  first: boolean
  last: boolean
  onMoveGroup: (step: -1 | 1) => void
  onMoveItem: (item: MenuItem, step: -1 | 1) => void
  onEdit: (item: MenuItem) => void
  onDelete: (item: MenuItem) => void
  money: (amount: number) => string
}) {
  const t = useTranslations('dash.menu')

  return (
    <section className="rounded-box border border-line bg-panel" aria-label={label}>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <h2 className="min-w-0 flex-1 truncate text-body font-semibold text-fg">{label}</h2>
        <span className="shrink-0 text-small text-muted">{t('list.count', { count: group.items.length })}</span>
        {canEdit && !(first && last) && (
          <span className="flex shrink-0 items-center">
            <button type="button" className={iconButton} disabled={busy || first} onClick={() => onMoveGroup(-1)} aria-label={t('list.groupUp', { name: label })}>
              <ArrowUp className="w-4 h-4" aria-hidden="true" />
            </button>
            <button type="button" className={iconButton} disabled={busy || last} onClick={() => onMoveGroup(1)} aria-label={t('list.groupDown', { name: label })}>
              <ArrowDown className="w-4 h-4" aria-hidden="true" />
            </button>
          </span>
        )}
      </div>
      <ul className="divide-y divide-line">
        {group.items.map((item, index) => (
          <li key={item.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
            {item.imageUrl && isMenuImageUrl(item.imageUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resizedImage(item.imageUrl, 480)} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-ctl bg-fg/5 object-cover" />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-ctl bg-fg/5 text-muted" title={t('list.noPhoto')}>
                <UtensilsCrossed className="w-4 h-4" aria-hidden="true" />
              </span>
            )}
            {/* basis-48: on a phone the buttons go to their own line instead of squeezing the name. */}
            <div className="min-w-0 flex-1 basis-48 break-words">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className={`text-body font-medium ${item.isAvailable ? 'text-fg' : 'text-muted'}`}>
                  {item.name}
                  {!item.isAvailable && (
                    <Badge variant="gray" className="ml-2 align-middle">
                      {t('list.hidden')}
                    </Badge>
                  )}
                </p>
                <p className="text-body font-semibold tabular-nums text-fg">{item.price > 0 ? money(item.price) : t('list.free')}</p>
              </div>
              {item.description && <p className="mt-0.5 line-clamp-2 text-small text-muted">{item.description}</p>}
            </div>
            {canEdit && (
              <div className="ml-auto flex shrink-0 items-center">
                <button type="button" className={iconButton} disabled={busy || index === 0} onClick={() => onMoveItem(item, -1)} aria-label={t('list.moveUp', { name: item.name })}>
                  <ArrowUp className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={iconButton}
                  disabled={busy || index === group.items.length - 1}
                  onClick={() => onMoveItem(item, 1)}
                  aria-label={t('list.moveDown', { name: item.name })}
                >
                  <ArrowDown className="w-4 h-4" aria-hidden="true" />
                </button>
                <button type="button" className={iconButton} onClick={() => onEdit(item)} aria-label={t('list.edit', { name: item.name })}>
                  <Pencil className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={`${iconButton} hover:text-err hover:bg-err-soft`}
                  onClick={() => onDelete(item)}
                  aria-label={t('list.delete', { name: item.name })}
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function formOf(item: MenuItem | null): Form {
  if (!item) return EMPTY_FORM
  const en = item.translations?.en
  return {
    name: item.name,
    category: item.category ?? '',
    price: String(item.price),
    description: item.description ?? '',
    imageUrl: item.imageUrl ?? '',
    isAvailable: item.isAvailable,
    en: { name: en?.name ?? '', description: en?.description ?? '', category: en?.category ?? '' },
  }
}

/** The categories already used, for the group field's suggestions (each once, as first typed). */
function usedCategories(items: MenuItem[], pick: (item: MenuItem) => string | null | undefined): string[] {
  const seen = new Map<string, string>()
  for (const item of items) {
    const text = pick(item)?.trim()
    if (text && !seen.has(text.toLocaleLowerCase('vi'))) seen.set(text.toLocaleLowerCase('vi'), text)
  }
  return [...seen.values()]
}

function MenuItemDialog({
  propertyId,
  item,
  items,
  onClose,
  onSaved,
}: {
  propertyId: string
  item: MenuItem | null
  items: MenuItem[]
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('dash.menu')
  const tc = useTranslations('dash.common')
  const labels = useDashLabels()
  const [form, setForm] = React.useState<Form>(() => formOf(item))
  const [errors, setErrors] = React.useState<{ name?: string; price?: string; imageUrl?: string }>({})
  const [photoError, setPhotoError] = React.useState<string | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const listId = React.useId()

  const categories = React.useMemo(() => usedCategories(items, (i) => i.category), [items])
  const englishCategories = React.useMemo(() => usedCategories(items, (i) => i.translations?.en?.category), [items])
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }))
  const setEn = (patch: Partial<Form['en']>) => setForm((f) => ({ ...f, en: { ...f.en, ...patch } }))

  const price = form.price.trim() === '' ? NaN : Number(form.price)
  const priceOk = Number.isFinite(price) && price >= 0
  const photo = form.imageUrl.trim()
  const showPhoto = photo !== '' && isMenuImageUrl(photo)

  const upload = async (file: File) => {
    setPhotoError(null)
    if (!file.type.startsWith('image/')) return setPhotoError(t('form.photoNotImage'))
    setUploading(true)
    try {
      const url = await uploadPhoto(file, { propertyId })
      if (isMenuImageUrl(url)) set({ imageUrl: url })
      else setPhotoError(t('form.photoUploadFailed'))
    } catch (error) {
      if (!(error instanceof UploadClientError)) setPhotoError(t('form.photoUploadFailed'))
      // No storage set up (503): a link pasted below still works.
      else if (error.status === 503) setPhotoError(t('form.photoNoStorage'))
      else if (error.problem === 'server') setPhotoError(error.message)
      else if (error.problem === 'notImage') setPhotoError(t('form.photoNotImage'))
      else if (error.problem === 'tooLarge') setPhotoError(t('form.photoTooLarge'))
      else setPhotoError(t('form.photoUploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    const next = {
      name: form.name.trim() ? undefined : t('form.nameRequired'),
      price: priceOk ? undefined : t('form.priceInvalid'),
      imageUrl: photo === '' || isMenuImageUrl(photo) ? undefined : t('form.photoInvalid'),
    }
    setErrors(next)
    if (next.name || next.price || next.imageUrl) return

    setSaving(true)
    try {
      const res = await fetch(item ? `/api/properties/${propertyId}/menu/${item.id}` : `/api/properties/${propertyId}/menu`, {
        method: item ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          category: form.category,
          price,
          description: form.description,
          imageUrl: photo,
          isAvailable: form.isAvailable,
          translations: { en: form.en },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!data.success) {
        toast.error(t('form.saveFailed'), apiError(data.error))
        return
      }
      toast.success(item ? t('form.saved') : t('form.added'))
      onSaved()
    } catch {
      toast.error(t('form.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal showHeader isOpen onClose={onClose} title={item ? t('form.editTitle') : t('form.newTitle')}>
      <ModalBody className="space-y-4">
        <Input
          label={t('form.name')}
          required
          maxLength={120}
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder={t('form.namePlaceholder')}
          error={errors.name}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('form.category')}
            maxLength={60}
            list={`${listId}-vi`}
            value={form.category}
            onChange={(e) => set({ category: e.target.value })}
            placeholder={t('form.categoryPlaceholder')}
            hint={t('form.categoryHint')}
          />
          <Input
            label={t('form.price')}
            required
            type="number"
            inputMode="numeric"
            min={0}
            step={1000}
            value={form.price}
            onChange={(e) => set({ price: e.target.value })}
            placeholder="0"
            error={errors.price}
            hint={priceOk ? t('form.priceHint', { price: price > 0 ? labels.money(price) : t('list.free') }) : undefined}
          />
        </div>
        <Textarea
          label={t('form.description')}
          maxLength={1000}
          rows={2}
          value={form.description}
          onChange={(e) => set({ description: e.target.value })}
          placeholder={t('form.descriptionPlaceholder')}
        />

        <div>
          <p className="mb-1.5 text-small font-medium text-fg">{t('form.photo')}</p>
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden rounded-box border border-line bg-fg/5 text-muted">
              {showPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resizedImage(photo, 480)} alt={t('form.previewAlt')} className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="w-6 h-6" aria-hidden="true" />
              )}
            </div>
            <div className="flex min-w-0 flex-1 basis-40 flex-col items-start gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) upload(file)
                }}
              />
              <Button type="button" variant="secondary" size="sm" isLoading={uploading} onClick={() => fileRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" aria-hidden="true" />
                {uploading ? t('form.uploading') : t('form.upload')}
              </Button>
              {photo !== '' && (
                <Button type="button" variant="ghost" size="sm" onClick={() => set({ imageUrl: '' })}>
                  {t('form.removePhoto')}
                </Button>
              )}
            </div>
          </div>
          {photoError && (
            <p role="alert" className="mt-2 text-small text-err">
              {photoError}
            </p>
          )}
          <div className="mt-3">
            <Input
              label={t('form.photoUrl')}
              type="url"
              inputMode="url"
              value={form.imageUrl}
              onChange={(e) => set({ imageUrl: e.target.value })}
              placeholder="https://"
              hint={t('form.photoUrlHint')}
              error={errors.imageUrl}
            />
          </div>
        </div>

        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={form.isAvailable} onChange={(e) => set({ isAvailable: e.target.checked })} />
          <span>
            <span className="block text-small font-medium text-fg">{t('form.available')}</span>
            <span className="block text-small text-muted">{t('form.availableHint')}</span>
          </span>
        </label>

        <EnglishCopy filled={Boolean(form.en.name || form.en.description || form.en.category)}>
          <Input label={t('form.name')} maxLength={120} value={form.en.name} onChange={(e) => setEn({ name: e.target.value })} placeholder={form.name} />
          <Input
            label={t('form.category')}
            maxLength={60}
            list={`${listId}-en`}
            value={form.en.category}
            onChange={(e) => setEn({ category: e.target.value })}
            placeholder={form.category}
          />
          <Textarea
            label={t('form.description')}
            maxLength={1000}
            rows={2}
            value={form.en.description}
            onChange={(e) => setEn({ description: e.target.value })}
            placeholder={form.description}
          />
        </EnglishCopy>

        <datalist id={`${listId}-vi`}>
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <datalist id={`${listId}-en`}>
          {englishCategories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          {tc('actions.cancel')}
        </Button>
        <Button onClick={save} isLoading={saving} disabled={uploading}>
          {item ? tc('actions.saveChanges') : t('form.newTitle')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
