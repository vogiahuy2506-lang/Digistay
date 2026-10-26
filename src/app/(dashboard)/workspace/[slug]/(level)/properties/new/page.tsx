'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { TitleBlock } from '@/components/layout'
import { Card, CardContent, Button, Modal, ModalFooter, Input, Select, Textarea, Loading } from '@/components/ui'
import { Building2, ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { routes } from '@/lib/utils/routes'
import { apiError } from '@/lib/i18n/api-errors'
import { finishSlugInput, onNameTyped, onSlugTyped } from '@/app/(dashboard)/workspaces/slug-input'
import { ProvinceWardFields } from '@/components/address/province-ward-fields'

/** createPropertySchema's limit for a subdomain. */
const SUBDOMAIN_MAX = 50

const PROPERTY_TYPES = ['HOTEL', 'HOMESTAY', 'RESORT', 'RESTAURANT', 'VILLA', 'MOTEL', 'OTHER'] as const

export default function NewPropertyPage() {
  const router = useRouter()
  const t = useTranslations('dash.property')
  const tc = useTranslations('dash.common')
  const tw = useTranslations('dash.workspace')
  const propertyTypes = PROPERTY_TYPES.map((value) => ({ value, label: t(`types.${value}`) }))
  const { workspace, loading: wsLoading } = useWorkspace()
  const [isCreating, setIsCreating] = React.useState(false)
  const [error, setError] = React.useState('')
  // The subdomain follows the name until it is typed by hand.
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

  const resetForm = () => {
    setFormData({
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
    setSubdomainEdited(false)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workspace) return
    setIsCreating(true)
    setError('')

    try {
      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          ...formData,
          subdomain: finishSlugInput(formData.subdomain),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(apiError(data.error) || t('form.error'))
        return
      }
      resetForm()
      router.push(routes.property(workspace.slug, data.data.id))
    } catch (err) {
      setError(tc('states.error'))
    } finally {
      setIsCreating(false)
    }
  }

  if (wsLoading) {
    return <Loading className="py-24" />
  }

  if (!workspace) {
    return (
      <div className="rounded-box border border-line bg-panel px-6 py-16 text-center">
        <Building2 className="w-6 h-6 text-muted mx-auto mb-4" />
        <p className="text-body text-fg">{tw('noWorkspace.title')}</p>
      </div>
    )
  }

  return (
    <>
      <TitleBlock
        title={t('new.title')}
        lead={t('new.description', { workspace: workspace.name })}
      />

      <div className="mt-9 max-w-2xl">
        <Card>
          <CardContent className="p-6">
          <form onSubmit={handleCreate} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-err-soft border border-err/30 text-err text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label={t('form.name')}
                placeholder={t('form.namePlaceholder')}
                value={formData.name}
                onChange={(e) => {
                  const name = e.target.value
                  const { slug } = onNameTyped(name, { slug: formData.subdomain, slugEdited: subdomainEdited }, SUBDOMAIN_MAX)
                  setFormData({ ...formData, name, subdomain: slug })
                }}
                required
              />

              <Select
                label={t('form.type')}
                options={propertyTypes}
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                required
              />
            </div>

            <Input
              label={t('form.subdomain')}
              placeholder={t('form.subdomainPlaceholder')}
              value={formData.subdomain}
              onChange={(e) => {
                const { slug, slugEdited } = onSlugTyped(e.target.value, SUBDOMAIN_MAX)
                setSubdomainEdited(slugEdited)
                setFormData({ ...formData, subdomain: slug })
              }}
              onBlur={() => setFormData({ ...formData, subdomain: finishSlugInput(formData.subdomain) })}
              hint={t('form.subdomainHint', { subdomain: formData.subdomain || t('form.subdomainPlaceholder') })}
              required
            />

            <ProvinceWardFields
              value={{ provinceCode: formData.provinceCode, wardCode: formData.wardCode }}
              onChange={(place) => setFormData({ ...formData, ...place })}
              required
              wardRequired
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label={t('form.address')}
                placeholder={t('form.addressPlaceholder')}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
              />
              <Input
                label={t('form.phone')}
                placeholder={t('new.phonePlaceholder')}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <Input
              label={t('form.email')}
              type="email"
              placeholder={t('form.emailPlaceholder')}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />

            <Textarea
              label={t('form.description')}
              placeholder={t('form.descriptionPlaceholder')}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />

            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" isLoading={isCreating}>
                <Building2 className="w-4 h-4 mr-2" />
                {t('form.submit')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(routes.workspace(workspace.slug))}
              >
                {tc('actions.cancel')}
              </Button>
            </div>
          </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
