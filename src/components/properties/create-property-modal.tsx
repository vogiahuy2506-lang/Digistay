'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Building2,
  Hotel,
  Home,
  Palmtree,
  UtensilsCrossed,
  Castle,
  BedDouble,
  Globe,
  MapPin,
  Phone,
  Mail,
  Sparkles,
} from 'lucide-react'
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Alert,
  AlertDescription,
} from '@/components/ui'
import { ProvinceWardFields } from '@/components/address/province-ward-fields'
import { finishSlugInput, onNameTyped, onSlugTyped } from '@/app/(dashboard)/workspaces/slug-input'
import { routes } from '@/lib/utils/routes'
import { apiError } from '@/lib/i18n/api-errors'
import { cn } from '@/lib/utils'

const SUBDOMAIN_MAX = 50

const PROPERTY_TYPE_OPTIONS = [
  { value: 'HOTEL', icon: Hotel },
  { value: 'HOMESTAY', icon: Home },
  { value: 'RESORT', icon: Palmtree },
  { value: 'VILLA', icon: Castle },
  { value: 'MOTEL', icon: BedDouble },
  { value: 'RESTAURANT', icon: UtensilsCrossed },
  { value: 'OTHER', icon: Building2 },
] as const

export interface CreatePropertyFormProps {
  workspaceId: string
  workspaceSlug: string
  onCancel?: () => void
  onSuccess?: (propertyId: string) => void
  inModal?: boolean
}

export function CreatePropertyForm({
  workspaceId,
  workspaceSlug,
  onCancel,
  onSuccess,
  inModal = false,
}: CreatePropertyFormProps) {
  const router = useRouter()
  const t = useTranslations('dash.property')
  const tc = useTranslations('dash.common')

  const [isCreating, setIsCreating] = React.useState(false)
  const [error, setError] = React.useState('')
  const [subdomainEdited, setSubdomainEdited] = React.useState(false)
  const [formData, setFormData] = React.useState({
    name: '',
    type: 'HOTEL',
    address: '',
    provinceCode: '',
    wardCode: '',
    phone: '',
    email: '',
    subdomain: '',
    description: '',
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    setError('')

    try {
      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          ...formData,
          subdomain: finishSlugInput(formData.subdomain),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(apiError(data.error) || t('form.error'))
        return
      }
      const createdId = data.data.id as string
      if (onSuccess) {
        onSuccess(createdId)
      } else {
        router.push(routes.property(workspaceSlug, createdId))
      }
    } catch {
      setError(tc('states.error'))
    } finally {
      setIsCreating(false)
    }
  }

  const formContent = (
    <div className="space-y-5">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Section 1: Loại hình cơ sở */}
      <div className="space-y-2">
        <label className="block text-small font-medium text-fg">
          {t('form.type')} <span className="text-err">*</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PROPERTY_TYPE_OPTIONS.map(({ value, icon: Icon }) => {
            const active = formData.type === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setFormData({ ...formData, type: value })}
                className={cn(
                  'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all text-xs font-medium',
                  active
                    ? 'bg-acc-soft border-acc/50 text-acc shadow-2xs font-semibold'
                    : 'bg-raised/40 border-line text-fg/80 hover:bg-raised hover:border-fg/20'
                )}
              >
                <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-acc' : 'text-muted')} />
                <span className="truncate">{t(`types.${value}`)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Section 2: Tên & Website Subdomain */}
      <div className="p-4 rounded-xl bg-raised/50 border border-line space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
          <Globe className="w-3.5 h-3.5 text-primary" />
          <span>Thông tin định danh & Website trực tiếp</span>
        </div>

        <Input
          label={t('form.name')}
          placeholder={t('form.namePlaceholder')}
          value={formData.name}
          onChange={(e) => {
            const name = e.target.value
            const { slug } = onNameTyped(
              name,
              { slug: formData.subdomain, slugEdited: subdomainEdited },
              SUBDOMAIN_MAX
            )
            setFormData({ ...formData, name, subdomain: slug })
          }}
          required
        />

        <div className="space-y-1.5">
          <Input
            label={t('form.subdomain')}
            placeholder={t('form.subdomainPlaceholder')}
            value={formData.subdomain}
            onChange={(e) => {
              const { slug, slugEdited } = onSlugTyped(e.target.value, SUBDOMAIN_MAX)
              setSubdomainEdited(slugEdited)
              setFormData({ ...formData, subdomain: slug })
            }}
            onBlur={() =>
              setFormData({ ...formData, subdomain: finishSlugInput(formData.subdomain) })
            }
            required
          />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-panel border border-line text-xs">
            <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-muted">Link website đặt phòng:</span>
            <span className="font-mono font-medium text-fg truncate">
              https://{formData.subdomain || 'ten-khach-san'}.digistay.vn
            </span>
          </div>
        </div>
      </div>

      {/* Section 3: Địa chỉ & Liên hệ */}
      <div className="p-4 rounded-xl bg-raised/50 border border-line space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
          <MapPin className="w-3.5 h-3.5 text-primary" />
          <span>Địa chỉ & Liên hệ lễ tân</span>
        </div>

        <ProvinceWardFields
          value={{ provinceCode: formData.provinceCode, wardCode: formData.wardCode }}
          onChange={(place) => setFormData({ ...formData, ...place })}
          required
          wardRequired
          className="grid grid-cols-1 md:grid-cols-2 gap-3.5"
        />

        <Input
          label={t('form.address')}
          placeholder={t('form.addressPlaceholder')}
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          required
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <Input
            label={t('form.phone')}
            placeholder={t('new.phonePlaceholder')}
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            icon={<Phone className="w-3.5 h-3.5" />}
          />
          <Input
            label={t('form.email')}
            type="email"
            placeholder={t('form.emailPlaceholder')}
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            icon={<Mail className="w-3.5 h-3.5" />}
          />
        </div>

        <Textarea
          label={t('form.description')}
          placeholder={t('form.descriptionPlaceholder')}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={2}
        />
      </div>
    </div>
  )

  if (inModal) {
    return (
      <form onSubmit={handleCreate} className="flex flex-col min-h-0">
        <ModalBody>{formContent}</ModalBody>
        <ModalFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" isLoading={isCreating} disabled={!formData.name.trim()}>
            <Building2 className="w-4 h-4 mr-2" />
            {t('form.submit')}
          </Button>
        </ModalFooter>
      </form>
    )
  }

  return (
    <form onSubmit={handleCreate} className="space-y-5">
      {formContent}
      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" isLoading={isCreating} disabled={!formData.name.trim()}>
          <Building2 className="w-4 h-4 mr-2" />
          {t('form.submit')}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {tc('actions.cancel')}
          </Button>
        )}
      </div>
    </form>
  )
}

export interface CreatePropertyModalProps {
  isOpen: boolean
  onClose: () => void
  workspaceId: string
  workspaceSlug: string
  workspaceName: string
}

export function CreatePropertyModal({
  isOpen,
  onClose,
  workspaceId,
  workspaceSlug,
  workspaceName,
}: CreatePropertyModalProps) {
  const router = useRouter()
  const t = useTranslations('dash.property')

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" title={t('new.title')}>
      <ModalHeader onClose={onClose}>
        <div className="flex items-center gap-3 pr-4">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-fg">{t('new.title')}</h2>
            <p className="text-xs text-muted">{t('new.description', { workspace: workspaceName })}</p>
          </div>
        </div>
      </ModalHeader>

      <CreatePropertyForm
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        onCancel={onClose}
        onSuccess={(createdId) => {
          onClose()
          router.push(routes.property(workspaceSlug, createdId))
        }}
        inModal
      />
    </Modal>
  )
}
