'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, Button, Badge, Modal, ModalBody, ModalFooter, Input, Select, Textarea } from '@/components/ui'
import { Plus, Building2, MapPin, MoreVertical, Pencil, Trash2, Eye, EyeOff } from 'lucide-react'
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { routes } from '@/lib/utils/routes'

interface Property {
  id: string
  name: string
  type: string
  address: string
  city: string
  subdomain: string
  isActive: boolean
  coverImage: string | null
  images: { url: string; isPrimary: boolean }[]
  _count: {
    roomTypes: number
    images: number
  }
}

const PROPERTY_TYPES = ['HOTEL', 'HOMESTAY', 'RESORT', 'RESTAURANT', 'VILLA', 'MOTEL', 'OTHER'] as const
type PropertyType = (typeof PROPERTY_TYPES)[number]

const getPropertyTypeBadge = (type: string) => {
  const variants: Record<string, 'primary' | 'secondary' | 'success' | 'warning' | 'gray'> = {
    HOTEL: 'primary',
    HOMESTAY: 'secondary',
    RESORT: 'success',
    RESTAURANT: 'warning',
    VILLA: 'primary',
    MOTEL: 'gray',
    OTHER: 'gray',
  }
  return variants[type] || 'gray'
}

export default function PropertiesPage() {
  const router = useRouter()
  const t = useTranslations('dash.property')
  const tc = useTranslations('dash.common')
  const propertyTypes = PROPERTY_TYPES.map((value) => ({ value, label: t(`types.${value}`) }))
  const getPropertyTypeLabel = (type: string) =>
    PROPERTY_TYPES.includes(type as PropertyType) ? t(`types.${type as PropertyType}`) : type
  const { workspace, loading: wsLoading } = useWorkspace()
  const workspaceId = workspace?.id

  const [properties, setProperties] = React.useState<Property[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false)
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

  React.useEffect(() => {
    if (workspaceId) {
      fetchProperties()
    }
  }, [workspaceId])

  const fetchProperties = async () => {
    if (!workspaceId) return

    try {
      const response = await fetch(`/api/properties?workspaceId=${workspaceId}`)
      const data = await response.json()
      if (data.success) {
        setProperties(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch properties:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workspaceId) return

    setIsCreating(true)
    setError('')

    try {
      const response = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          ...formData,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || t('form.error'))
        return
      }

      setIsCreateModalOpen(false)
      resetForm()
      fetchProperties()
      router.push(routes.property(workspace!.slug, data.data.id))
    } catch (err) {
      setError(tc('states.error'))
    } finally {
      setIsCreating(false)
    }
  }

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

  const handleDeleteProperty = async (id: string) => {
    if (!confirm(t('list.deleteConfirm'))) return

    try {
      const response = await fetch(`/api/properties/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchProperties()
      }
    } catch (err) {
      console.error('Failed to delete property:', err)
    }
  }

  const togglePropertyStatus = async (id: string, currentStatus: boolean) => {
    try {
      await fetch(`/api/properties/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      })
      fetchProperties()
    } catch (err) {
      console.error('Failed to toggle property status:', err)
    }
  }

  if (wsLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-acc"></div>
        </div>
      </PageContainer>
    )
  }

  if (!workspaceId) {
    return (
      <PageContainer>
        <Card>
          <CardContent className="p-12 text-center">
            <Building2 className="w-16 h-16 text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium text-fg mb-2">
              {t('list.noWorkspace.title')}
            </h3>
            <p className="text-muted mb-6">
              {t('list.noWorkspace.text')}
            </p>
            <Button onClick={() => router.push(routes.workspaces())}>
              {t('list.noWorkspace.action')}
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <Header
        title={t('list.title')}
        description={t('list.description')}
        actions={
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {t('list.add')}
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-acc"></div>
        </div>
      ) : properties.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Building2 className="w-16 h-16 text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium text-fg mb-2">
              {t('list.empty.title')}
            </h3>
            <p className="text-muted mb-6">
              {t('list.empty.text')}
            </p>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t('list.empty.action')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property) => {
            const primaryImage = property.images.find(img => img.isPrimary)
            return (
              <Card key={property.id} className="overflow-hidden hover:shadow-md transition-shadow">
                {/* Image */}
                <div className="relative h-48 bg-fg/5">
                  {primaryImage ? (
                    <Image
                      src={primaryImage.url}
                      alt={property.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Building2 className="w-12 h-12 text-muted" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3 flex gap-2">
                    <Badge variant={getPropertyTypeBadge(property.type)}>
                      {getPropertyTypeLabel(property.type)}
                    </Badge>
                    <Badge variant={property.isActive ? 'success' : 'gray'}>
                      {property.isActive ? t('status.active') : t('status.inactive')}
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-fg truncate">{property.name}</h3>
                    <Dropdown
                      trigger={
                        <button aria-label={tc('actions.more')} className="p-1 rounded hover:bg-fg/5">
                          <MoreVertical className="w-5 h-5 text-muted" />
                        </button>
                      }
                    >
                      <DropdownItem 
                        icon={<Pencil className="w-4 h-4" />}
                        onClick={() => router.push(routes.property(workspace!.slug, property.id))}
                      >
                        {t('list.menu.edit')}
                      </DropdownItem>
                      <DropdownItem 
                        icon={property.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        onClick={() => togglePropertyStatus(property.id, property.isActive)}
                      >
                        {property.isActive ? t('list.menu.deactivate') : t('list.menu.activate')}
                      </DropdownItem>
                      <DropdownDivider />
                      <DropdownItem 
                        icon={<Trash2 className="w-4 h-4" />} 
                        danger
                        onClick={() => handleDeleteProperty(property.id)}
                      >
                        {tc('actions.delete')}
                      </DropdownItem>
                    </Dropdown>
                  </div>

                  <div className="flex items-center gap-1 text-sm text-muted mb-3">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate">{property.address}, {property.city}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm text-muted mb-4">
                    <span>{t('list.roomTypes', { count: property._count.roomTypes })}</span>
                    <span>{t('list.images', { count: property._count.images })}</span>
                  </div>

                  <div className="text-xs text-muted mb-3">
                    {t('list.subdomain')} <code className="bg-fg/5 px-1 rounded">{property.subdomain}</code>
                  </div>

                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => router.push(routes.property(workspace!.slug, property.id))}
                  >
                    {t('list.manage')}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create Property Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false)
          resetForm()
        }}
        title={t('list.add')}
        description={t('list.create.description')}
        size="lg"
      >
        <form className="flex flex-col min-h-0" onSubmit={handleCreateProperty}>
          <ModalBody>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-err-soft border border-err/30 text-err text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={t('form.name')}
                placeholder={t('form.namePlaceholder')}
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value })
                  // Auto-generate subdomain from name
                  if (!formData.subdomain) {
                    const subdomain = e.target.value
                      .toLowerCase()
                      .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-+|-+$/g, '')
                    setFormData(prev => ({ ...prev, subdomain }))
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
              onChange={(e) => setFormData({ 
                ...formData, 
                subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
              })}
              hint={t('form.subdomainHint', { subdomain: t('form.subdomainPlaceholder') })}
              required
            />

            <div className="grid grid-cols-2 gap-4">
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

            <div className="grid grid-cols-2 gap-4">
              <Input
                label={t('form.district')}
                placeholder={t('form.districtPlaceholder')}
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
              />

              <Input
                label={t('form.phone')}
                placeholder={t('list.create.phonePlaceholder')}
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
          </div>

          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCreateModalOpen(false)
                resetForm()
              }}
            >
              {tc('actions.cancel')}
            </Button>
            <Button type="submit" isLoading={isCreating}>
              {t('form.submit')}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </PageContainer>
  )
}
