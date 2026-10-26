'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { TitleBlock } from '@/components/layout'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Loading, Select, Textarea } from '@/components/ui'
import {
  Settings, Building2, Bell, Shield, Users,
  Mail, DollarSign, Save, Upload
} from 'lucide-react'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { cn } from '@/lib/utils'
import { routes } from '@/lib/utils/routes'
import Image from 'next/image'
import { uploadPhoto } from '@/lib/media/upload-client'
import { useUploadProblemText } from '@/components/ui/photo-upload'
import { apiError } from '@/lib/i18n/api-errors'
import { BUSINESS_TYPES, CURRENCIES, TIMEZONES, type BusinessType, workspaceSettingsOf } from '@/app/(dashboard)/workspaces/options'

interface WorkspaceSettings {
  id: string
  name: string
  slug: string
  description: string | null
  logo: string | null
  domain: string | null
  settings: {
    currency?: string
    timezone?: string
    businessType?: string
    notifications?: {
      email?: boolean
      sms?: boolean
      bookingAlert?: boolean
    }
  }
  owner: {
    id: string
    name: string | null
    email: string
  }
  _count: {
    properties: number
    members: number
  }
}

export default function WorkspaceSettingsPage() {
  const t = useTranslations('dash.workspace')
  const uploadProblem = useUploadProblemText()
  const tc = useTranslations('dash.common')
  const router = useRouter()
  // The same lists and labels as the create dialog on /workspaces (messages workspaces.form.*).
  const tw = useTranslations('workspaces')
  const currencies = CURRENCIES.map((value) => ({ value, label: tw(`form.currencies.${value}`) }))
  const timezones = TIMEZONES.map(({ value, key }) => ({ value, label: tw(`form.timezones.${key}`) }))
  const businessTypes = BUSINESS_TYPES.map((value) => ({ value, label: tw(`form.businessTypes.${value}`) }))
  const { workspace, loading: wsLoading } = useWorkspace()
  const [settings, setSettings] = React.useState<WorkspaceSettings | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState('')
  const [success, setSuccess] = React.useState('')
  const [activeTab, setActiveTab] = React.useState('general')

  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    logo: null as string | null,
    ...workspaceSettingsOf(null),
  })

  React.useEffect(() => {
    if (workspace?.id) {
      fetchSettings()
    }
  }, [workspace?.id])

  const fetchSettings = async () => {
    if (!workspace?.id) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`)
      const data = await res.json()
      if (data.success) {
        setSettings(data.data)
        const ws = data.data
        setFormData({
          name: ws.name,
          description: ws.description || '',
          logo: ws.logo || null,
          ...workspaceSettingsOf(ws.settings),
        })
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!workspace?.id) return
    setIsSaving(true)
    setError('')
    setSuccess('')

    try {
      // One request: the name and logo, and the regional settings (kept in the
      // workspace's settings JSON). No logo is null.
      const res = await fetch(`/api/workspaces/${workspace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description,
          logo: formData.logo,
          currency: formData.currency,
          timezone: formData.timezone,
          businessType: formData.businessType,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(apiError(data.error) || t('settings.saveFailed'))
      }

      setSuccess(t('settings.saved'))
      fetchSettings()
    } catch (err: any) {
      setError(err.message || t('errors.generic'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !workspace?.id) return
    setError('')
    try {
      // Stored (Cloudinary); never kept as a data: URL in the workspace row.
      const url = await uploadPhoto(file, { workspaceId: workspace.id }, 512)
      setFormData((prev) => ({ ...prev, logo: url }))
      setSuccess(t('settings.logoUploaded'))
    } catch (err) {
      setError(uploadProblem(err))
    }
  }

  if (wsLoading) {
    return <Loading className="py-24" />
  }

  if (!workspace) {
    return (
      <div className="rounded-box border border-line bg-panel px-6 py-16 text-center">
        <Settings className="w-6 h-6 text-muted mx-auto mb-4" />
        <p className="text-body text-fg mb-2">{t('noWorkspace.title')}</p>
        <p className="text-small text-muted mb-6">{t('noWorkspace.hint')}</p>
        <Button onClick={() => router.push(routes.workspaces())}>
          {t('noWorkspace.goTo')}
        </Button>
      </div>
    )
  }

  if (isLoading) {
    return <Loading className="py-24" />
  }

  return (
    <>
      <TitleBlock
        title={t('settings.title')}
        lead={t('settings.description', { name: workspace.name })}
        actions={
          <Link
            href={routes.members(workspace.slug)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-ctl border border-ink h-9 sm:h-8 px-3',
              'text-small font-medium text-fg hover:bg-panel transition-colors duration-160',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-acc'
            )}
          >
            <Users className="w-4 h-4" aria-hidden="true" />
            {tc('nav.members')}
          </Link>
        }
      />

      {/* Success/Error Messages */}
      {success && (
        <div role="status" className="mt-6 p-3 rounded-lg bg-ok-soft border border-ok/30 text-ok text-sm">
          {success}
        </div>
      )}
      {error && (
        <div role="alert" className="mt-6 p-3 rounded-lg bg-err-soft border border-err/30 text-err text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 mt-8 mb-6 bg-fg/5 p-1 rounded-lg w-fit max-w-full overflow-x-auto">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'general'
              ? 'bg-panel text-acc shadow-sm'
              : 'text-muted hover:text-fg'
          }`}
        >
          <Settings className="w-4 h-4 inline mr-2" />
          {t('settings.tabs.general')}
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'notifications'
              ? 'bg-panel text-acc shadow-sm'
              : 'text-muted hover:text-fg'
          }`}
        >
          <Bell className="w-4 h-4 inline mr-2" />
          {t('settings.tabs.notifications')}
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'security'
              ? 'bg-panel text-acc shadow-sm'
              : 'text-muted hover:text-fg'
          }`}
        >
          <Shield className="w-4 h-4 inline mr-2" />
          {t('settings.tabs.security')}
        </button>
      </div>

      {/* General Settings */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.general.basicInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Logo */}
              <div>
                <label className="block text-sm font-medium text-fg mb-2">
                  {t('settings.general.logo')}
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl border-2 border-dashed border-line flex items-center justify-center overflow-hidden bg-fg/[0.03]">
                    {formData.logo ? (
                      <Image 
                        src={formData.logo} 
                        alt="Logo" 
                        width={80} 
                        height={80} 
                        className="object-contain"
                      />
                    ) : (
                      <Building2 className="w-8 h-8 text-muted" />
                    )}
                  </div>
                  <div>
                    <input
                      type="file"
                      id="logo-upload"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                    <label
                      htmlFor="logo-upload"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-panel border border-line rounded-lg text-sm font-medium text-fg hover:bg-fg/[0.03] cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      {t('logo.upload')}
                    </label>
                    <p className="text-xs text-muted mt-1">{t('settings.general.logoHint')}</p>
                  </div>
                </div>
              </div>

              <Input
                label={t('settings.general.name')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('settings.general.namePlaceholder')}
                required
              />

              <Textarea
                label={t('settings.general.description')}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('settings.general.descriptionPlaceholder')}
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Regional Settings */}
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.general.regional')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label={t('defaultCurrency')}
                  options={currencies}
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                />

                <Select
                  label={t('settings.general.timezone')}
                  options={timezones}
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                />
              </div>

              <Select
                label={tw('form.businessType')}
                options={businessTypes}
                value={formData.businessType}
                onChange={(e) => setFormData({ ...formData, businessType: e.target.value as BusinessType })}
              />
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} isLoading={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {tc('actions.saveChanges')}
            </Button>
          </div>
        </div>
      )}

      {/* Notifications Settings */}
      {activeTab === 'notifications' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.notifications.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted mb-4">
              {t('settings.notifications.intro')}
            </p>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-fg/[0.03] rounded-lg">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-muted" />
                  <div>
                    <p className="font-medium text-fg">{t('settings.notifications.email')}</p>
                    <p className="text-sm text-muted">{t('settings.notifications.emailText')}</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-fg/10 peer-focus:outline-none peer-focus-visible:ring-4 peer-focus-visible:ring-acc rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-on-ink after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-panel after:border-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ink"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-fg/[0.03] rounded-lg">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-muted" />
                  <div>
                    <p className="font-medium text-fg">{t('settings.notifications.push')}</p>
                    <p className="text-sm text-muted">{t('settings.notifications.pushText')}</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-fg/10 peer-focus:outline-none peer-focus-visible:ring-4 peer-focus-visible:ring-acc rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-on-ink after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-panel after:border-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ink"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-fg/[0.03] rounded-lg">
                <div className="flex items-center gap-3">
                  <DollarSign className="w-5 h-5 text-muted" />
                  <div>
                    <p className="font-medium text-fg">{t('settings.notifications.booking')}</p>
                    <p className="text-sm text-muted">{t('settings.notifications.bookingText')}</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-fg/10 peer-focus:outline-none peer-focus-visible:ring-4 peer-focus-visible:ring-acc rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-on-ink after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-panel after:border-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ink"></div>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Settings */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.security.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-fg/[0.03] rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="w-5 h-5 text-acc" />
                  <p className="font-medium text-fg">{t('settings.security.owner')}</p>
                </div>
                <p className="text-sm text-muted ml-8">
                  {settings?.owner.name || tc('shell.user')} ({settings?.owner.email})
                </p>
              </div>

              <div className="p-4 bg-fg/[0.03] rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-5 h-5 text-acc" />
                  <p className="font-medium text-fg">{tc('nav.members')}</p>
                </div>
                <p className="text-sm text-muted ml-8">
                  {t('memberCount', { count: settings?._count.members || 0 })}
                </p>
              </div>

              <div className="p-4 bg-fg/[0.03] rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Building2 className="w-5 h-5 text-acc" />
                  <p className="font-medium text-fg">{tc('nav.properties')}</p>
                </div>
                <p className="text-sm text-muted ml-8">
                  {t('settings.security.propertyCount', { count: settings?._count.properties || 0 })}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-err/30">
            <CardHeader>
              <CardTitle className="text-err">{t('settings.security.dangerZone')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-err-soft rounded-lg border border-err/30">
                <p className="font-medium text-err mb-1">{t('settings.security.delete')}</p>
                <p className="text-sm text-err mb-3">
                  {t('settings.security.deleteText')}
                </p>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (confirm(t('settings.security.confirmDelete'))) {
                      // TODO: Implement workspace deletion
                      alert(t('settings.security.comingSoon'))
                    }
                  }}
                >
                  {t('settings.security.delete')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}