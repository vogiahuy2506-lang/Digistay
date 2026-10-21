'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, Button, Modal, ModalFooter, Input, Select, Textarea } from '@/components/ui'
import { Building2, ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { routes } from '@/lib/utils/routes'

const PROPERTY_TYPES = ['HOTEL', 'HOMESTAY', 'RESORT', 'RESTAURANT', 'VILLA', 'MOTEL', 'OTHER'] as const

export default function NewPropertyPage() {
  const router = useRouter()
  const t = useTranslations('dash.property')
  const tc = useTranslations('dash.common')
  const propertyTypes = PROPERTY_TYPES.map((value) => ({ value, label: t(`types.${value}`) }))
  const { workspace } = useWorkspace()
  const [isCreating, setIsCreating] = React.useState(false)
  const [error, setError] = React.useState('')
  const [formData, setFormData] = React.useState({
    name: '',
    type: 'HOTEL',
    address: '',
    city: '',
    district: '',
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
      city: '',
      district: '',
      phone: '',
      email: '',
      subdomain: '',
      description: '',
    })
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
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || t('form.error'))
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

  if (!workspace) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-acc"></div>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-muted hover:text-acc mb-3"
      >
        <ArrowLeft className="w-4 h-4" />
        {tc('actions.back')}
      </button>
      <Header
        title={t('new.title')}
        description={t('new.description', { workspace: workspace.name })}
      />

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
                  setFormData({ ...formData, name: e.target.value })
                  if (!formData.subdomain) {
                    const subdomain = e.target.value
                      .toLowerCase()
                      .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-+|-+$/g, '')
                    setFormData((prev) => ({ ...prev, subdomain }))
                  }
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
              onChange={(e) =>
                setFormData({
                  ...formData,
                  subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                })
              }
              hint={t('form.subdomainHint', { subdomain: formData.subdomain || t('form.subdomainPlaceholder') })}
              required
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
                label={t('form.city')}
                placeholder={t('form.cityPlaceholder')}
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label={t('form.district')}
                placeholder={t('form.districtPlaceholder')}
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
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
    </PageContainer>
  )
}
