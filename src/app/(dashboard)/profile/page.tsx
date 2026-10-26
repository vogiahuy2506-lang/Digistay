'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { signOut, useSession } from 'next-auth/react'
import { useLocale, useTranslations } from 'next-intl'
import { Header } from '@/components/layout'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from '@/components/ui'
import { Alert, AlertDescription, AlertIcon } from '@/components/ui/alert'
import {
  User, Mail, Phone, MapPin, Calendar, FileText, Camera,
  Save, Lock, Shield, LogOut, Check, Loader2, Eye, EyeOff
} from 'lucide-react'
import { format } from 'date-fns'
import { enGB, vi } from 'date-fns/locale'
import { TwoFactorCard } from './two-factor-card'
import { apiError } from '@/lib/i18n/api-errors'
import { prepareImage, UploadClientError } from '@/lib/media/upload-client'

interface UserProfile {
  id: string
  name: string | null
  email: string
  image: string | null
  phone: string | null
  address: string | null
  dateOfBirth: string | null
  bio: string | null
  role: string
  createdAt: string
  updatedAt: string
}

interface PasswordForm {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export default function ProfilePage() {
  const t = useTranslations('dash.account.profile')
  const tc = useTranslations('dash.common')
  const ta = useTranslations('auth.common')
  const locale = useLocale()
  const router = useRouter()
  const { data: session, update: updateSession } = useSession()
  const [profile, setProfile] = React.useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false)
  const [error, setError] = React.useState('')
  const [success, setSuccess] = React.useState('')
  const [activeTab, setActiveTab] = React.useState<'profile' | 'security'>('profile')
  const [isChangingPassword, setIsChangingPassword] = React.useState(false)

  const [formData, setFormData] = React.useState({
    name: '',
    phone: '',
    address: '',
    dateOfBirth: '',
    bio: '',
  })

  const [passwordForm, setPasswordForm] = React.useState<PasswordForm>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false)
  const [showNewPassword, setShowNewPassword] = React.useState(false)

  // Email change state
  const [emailForm, setEmailForm] = React.useState({ newEmail: '', password: '' })
  const [isChangingEmail, setIsChangingEmail] = React.useState(false)
  const [emailChangeInfo, setEmailChangeInfo] = React.useState('')
  const [showNewEmailPassword, setShowNewEmailPassword] = React.useState(false)

  React.useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/users/me')
      const data = await res.json()
      if (data.success) {
        setProfile(data.data)
        setFormData({
          name: data.data.name || '',
          phone: data.data.phone || '',
          address: data.data.address || '',
          dateOfBirth: data.data.dateOfBirth ? data.data.dateOfBirth.split('T')[0] : '',
          bio: data.data.bio || '',
        })
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err)
      setError(t('loadFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setIsUploadingAvatar(true)
    setError('')
    try {
      // Shrunk to 512 px in the browser, then stored by the server (Cloudinary).
      const base64 = await prepareImage(file, 512)
      const res = await fetch('/api/users/me/avatar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64 }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.success) {
        setProfile((prev) => (prev ? { ...prev, image: data.data.image } : null))
        setSuccess(t('avatar.updated'))
        await updateSession()
      } else {
        setError(apiError(data.error) || t('avatar.uploadFailed'))
      }
    } catch (err) {
      if (err instanceof UploadClientError && err.problem === 'notImage') setError(t('avatar.notImage'))
      else if (err instanceof UploadClientError && err.problem === 'tooLarge') setError(t('avatar.tooBig'))
      else if (err instanceof UploadClientError && err.problem === 'unreadable') setError(t('avatar.readFailed'))
      else setError(t('avatar.uploadError'))
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!formData.name.trim()) {
      setError(t('info.nameRequired'))
      return
    }

    setIsSaving(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone || undefined,
          address: formData.address || undefined,
          dateOfBirth: formData.dateOfBirth || undefined,
          bio: formData.bio || undefined,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setProfile(prev => prev ? { ...prev, ...data.data } : null)
        setSuccess(t('info.saved'))
        // Update session
        await updateSession()
      } else {
        setError(apiError(data.error) || t('info.saveFailed'))
      }
    } catch (err) {
      console.error('Save profile error:', err)
      setError(t('info.saveError'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword) {
      setError(t('password.currentRequired'))
      return
    }
    if (!passwordForm.newPassword) {
      setError(t('password.newRequired'))
      return
    }
    if (passwordForm.newPassword.length < 8) {
      setError(t('password.tooShort'))
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError(t('password.mismatch'))
      return
    }

    setIsChangingPassword(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setSuccess(t('password.changed'))
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
        // The server signed out every device, this one included.
        if (data.signedOut) {
          setTimeout(() => signOut({ callbackUrl: '/login' }), 1500)
        }
      } else {
        setError(apiError(data.error) || t('password.failed'))
      }
    } catch (err) {
      console.error('Change password error:', err)
      setError(t('password.error'))
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleChangeEmail = async () => {
    if (!emailForm.newEmail) {
      setError(t('email.newRequired'))
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailForm.newEmail)) {
      setError(t('email.invalid'))
      return
    }
    if (!emailForm.password) {
      setError(t('email.passwordRequired'))
      return
    }

    setIsChangingEmail(true)
    setError('')
    setSuccess('')
    setEmailChangeInfo('')

    try {
      const res = await fetch('/api/users/me/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newEmail: emailForm.newEmail,
          password: emailForm.password,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setEmailChangeInfo(apiError(data.message) ?? '')
        setEmailForm({ newEmail: '', password: '' })
        setSuccess(t('email.sent'))
      } else {
        setError(apiError(data.error) || t('email.failed'))
      }
    } catch (err) {
      console.error('Change email error:', err)
      setError(t('email.error'))
    } finally {
      setIsChangingEmail(false)
    }
  }

  const handleLogout = () => {
    if (confirm(t('account.confirmSignOut'))) {
      signOut({ callbackUrl: '/login' })
    }
  }

  // Handle email change redirect messages
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const status = params.get('email_change')
    if (status === 'success') {
      setSuccess(t('email.changed.success'))
      fetchProfile()
      window.history.replaceState({}, '', '/profile')
    } else if (status === 'expired') {
      setError(t('email.changed.expired'))
      window.history.replaceState({}, '', '/profile')
    } else if (status === 'taken') {
      setError(t('email.changed.taken'))
      window.history.replaceState({}, '', '/profile')
    } else if (status === 'unauthorized') {
      setError(t('email.changed.unauthorized'))
      window.history.replaceState({}, '', '/profile')
    } else if (status === 'error') {
      setError(t('email.changed.error'))
      window.history.replaceState({}, '', '/profile')
    }
  }, [])

  if (isLoading) {
    return (
      <PageShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-acc" />
        </div>
      </PageShell>
    )
  }

  // A message belongs to the tab it came from.
  const switchTab = (tab: 'profile' | 'security') => {
    setActiveTab(tab)
    setError('')
    setSuccess('')
  }

  return (
    <PageShell>
      <Header
        title={t('title')}
        description={t('description')}
      />

      {/* Messages */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertIcon variant="destructive" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert variant="success" className="mb-4">
          <AlertIcon variant="success" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 bg-fg/5 p-1 rounded-lg w-fit">
        <button
          onClick={() => switchTab('profile')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'profile'
              ? 'bg-panel text-acc shadow-sm'
              : 'text-muted hover:text-fg'
          }`}
        >
          <User className="w-4 h-4" />
          {t('tabs.profile')}
        </button>
        <button
          onClick={() => switchTab('security')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'security'
              ? 'bg-panel text-acc shadow-sm'
              : 'text-muted hover:text-fg'
          }`}
        >
          <Shield className="w-4 h-4" />
          {t('tabs.security')}
        </button>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Avatar Card */}
          <Card className="lg:col-span-1 lg:self-start">
            <CardHeader>
              <CardTitle>{t('avatar.title')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className="relative mb-4">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-fg/5 border-4 border-panel shadow-lg">
                  {profile?.image ? (
                    <Image
                      src={profile.image}
                      alt={profile.name || t('avatar.alt')}
                      width={128}
                      height={128}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-acc-soft">
                      <span className="text-4xl font-bold text-acc/60">
                        {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Camera overlay */}
                <label className="absolute bottom-0 right-0 w-10 h-10 bg-ink rounded-full flex items-center justify-center cursor-pointer hover:bg-ink/80 transition shadow-lg border-2 border-panel">
                  {isUploadingAvatar ? (
                    <Loader2 className="w-4 h-4 text-on-ink animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5 text-on-ink" />
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={isUploadingAvatar}
                  />
                </label>
              </div>
              
              <p className="text-sm text-muted text-center">
                {t('avatar.hint')}
              </p>
              <p className="text-xs text-muted mt-1">
                {t('avatar.formats')}
              </p>

              {/* User Info Summary */}
              <div className="w-full mt-6 pt-6 border-t border-line space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant={profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN' ? 'primary' : 'secondary'}>
                    {profile?.role === 'SUPER_ADMIN' ? t('role.superAdmin') : profile?.role === 'ADMIN' ? t('role.admin') : t('role.user')}
                  </Badge>
                  {/* /api/admin/system checks the role again, in the database. */}
                  {profile?.role === 'SUPER_ADMIN' && (
                    <Link href="/admin/system" className="text-xs font-medium text-acc underline">
                      {t('systemLink')}
                    </Link>
                  )}
                </div>
                <p className="text-xs text-muted">
                  {t('joined', {
                    date: profile?.createdAt
                      ? format(new Date(profile.createdAt), 'dd MMMM yyyy', { locale: locale === 'en' ? enGB : vi })
                      : '-',
                  })}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Profile Form */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('info.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label={t('info.name')}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('info.namePlaceholder')}
                  icon={<User className="w-4 h-4" />}
                  required
                />

                <Input
                  label={t('info.email')}
                  value={profile?.email || ''}
                  disabled
                  icon={<Mail className="w-4 h-4" />}
                  hint={t('info.emailHint')}
                />

                <Input
                  label={t('info.phone')}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder={t('info.phonePlaceholder')}
                  icon={<Phone className="w-4 h-4" />}
                />

                <Input
                  label={t('info.address')}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder={t('info.addressPlaceholder')}
                  icon={<MapPin className="w-4 h-4" />}
                />

                <Input
                  label={t('info.dateOfBirth')}
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  icon={<Calendar className="w-4 h-4" />}
                />

                <div>
                  <label className="block text-sm font-medium text-fg mb-1.5">
                    <FileText className="w-4 h-4 inline mr-1.5" />
                    {t('info.bio')}
                  </label>
                  <textarea
                    className="w-full px-4 py-3 bg-fg/[0.03] border border-line rounded-xl text-sm font-medium text-fg placeholder-muted focus-visible:bg-panel focus-visible:border-acc focus-visible:ring-2 focus-visible:ring-acc/20 transition-all outline-none resize-none"
                    rows={3}
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder={t('info.bioPlaceholder')}
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={handleSaveProfile} isLoading={isSaving}>
                    <Save className="w-4 h-4 mr-2" />
                    {tc('actions.saveChanges')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="border-warn/30 bg-warn-soft/50">
              <CardHeader>
                <CardTitle className="text-warn flex items-center gap-2">
                  <LogOut className="w-5 h-5" />
                  {t('account.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="border-warn/30 text-warn hover:bg-warn-soft"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {tc('shell.signOut')}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="max-w-2xl space-y-6">
          {/* Email change */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                {t('email.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted">
                {t.rich('email.current', {
                  email: profile?.email ?? '',
                  b: (chunks) => <span className="font-semibold text-fg">{chunks}</span>,
                })}
              </p>

              <div>
                <label className="block text-sm font-medium text-fg mb-1.5">
                  {t('email.newEmail')}
                </label>
                <input
                  type="email"
                  value={emailForm.newEmail}
                  onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
                  className="w-full px-4 py-3 bg-fg/[0.03] border border-line rounded-xl text-sm font-medium text-fg placeholder-muted focus-visible:bg-panel focus-visible:border-acc focus-visible:ring-2 focus-visible:ring-acc/20 transition-all outline-none"
                  placeholder={t('email.newEmailPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-fg mb-1.5">
                  {t('email.password')}
                </label>
                <div className="relative">
                  <input
                    type={showNewEmailPassword ? 'text' : 'password'}
                    value={emailForm.password}
                    onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })}
                    className="w-full px-4 py-3 pr-12 bg-fg/[0.03] border border-line rounded-xl text-sm font-medium text-fg placeholder-muted focus-visible:bg-panel focus-visible:border-acc focus-visible:ring-2 focus-visible:ring-acc/20 transition-all outline-none"
                    placeholder={t('email.passwordPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewEmailPassword(!showNewEmailPassword)}
                    aria-label={showNewEmailPassword ? ta('hidePassword') : ta('showPassword')}
                    aria-pressed={showNewEmailPassword}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg rounded-ctl focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
                  >
                    {showNewEmailPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                  </button>
                </div>
                <p className="text-xs text-muted mt-1">
                  {t('email.help')}
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleChangeEmail} isLoading={isChangingEmail}>
                  <Mail className="w-4 h-4 mr-2" />
                  {t('email.send')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Password change */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                {t('password.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted mb-4">
                {t('password.intro')}
              </p>

              <div>
                <label className="block text-sm font-medium text-fg mb-1.5">
                  {t('password.current')}
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="w-full px-4 py-3 bg-fg/[0.03] border border-line rounded-xl text-sm font-medium text-fg placeholder-muted focus-visible:bg-panel focus-visible:border-acc focus-visible:ring-2 focus-visible:ring-acc/20 transition-all outline-none pr-12"
                    placeholder={t('password.currentPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    aria-label={showCurrentPassword ? ta('hidePassword') : ta('showPassword')}
                    aria-pressed={showCurrentPassword}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg rounded-ctl focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-fg mb-1.5">
                  {t('password.new')}
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full px-4 py-3 bg-fg/[0.03] border border-line rounded-xl text-sm font-medium text-fg placeholder-muted focus-visible:bg-panel focus-visible:border-acc focus-visible:ring-2 focus-visible:ring-acc/20 transition-all outline-none pr-12"
                    placeholder={t('password.newPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    aria-label={showNewPassword ? ta('hidePassword') : ta('showPassword')}
                    aria-pressed={showNewPassword}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg rounded-ctl focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                  </button>
                </div>
                <p className="text-xs text-muted mt-1">
                  {t('password.newHint')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-fg mb-1.5">
                  {t('password.confirm')}
                </label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full px-4 py-3 bg-fg/[0.03] border border-line rounded-xl text-sm font-medium text-fg placeholder-muted focus-visible:bg-panel focus-visible:border-acc focus-visible:ring-2 focus-visible:ring-acc/20 transition-all outline-none"
                  placeholder={t('password.confirmPlaceholder')}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleChangePassword} isLoading={isChangingPassword}>
                  <Check className="w-4 h-4 mr-2" />
                  {t('password.submit')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <TwoFactorCard />

          {/* Security Info */}
          <Card className="border-ok/30 bg-ok-soft/50">
            <CardHeader>
              <CardTitle className="text-ok flex items-center gap-2">
                <Shield className="w-5 h-5" />
                {t('securityInfo.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 shrink-0 rounded-full bg-ok mt-2"></div>
                <p className="text-sm text-fg">
                  {t('securityInfo.encrypted')}
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 shrink-0 rounded-full bg-ok mt-2"></div>
                <p className="text-sm text-fg">
                  {t('securityInfo.sessions')}
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 shrink-0 rounded-full bg-ok mt-2"></div>
                <p className="text-sm text-fg">
                  {t('securityInfo.strong')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageShell>
  )
}

/** The page's column, as wide as the top bar's (layout.tsx), so their edges line up. */
function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-5xl px-5 sm:px-8 py-8 sm:py-10">{children}</div>
}
