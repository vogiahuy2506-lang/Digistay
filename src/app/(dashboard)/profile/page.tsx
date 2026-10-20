'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { signOut, useSession } from 'next-auth/react'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from '@/components/ui'
import { Alert, AlertDescription, AlertIcon } from '@/components/ui/alert'
import {
  User, Mail, Phone, MapPin, Calendar, FileText, Camera,
  Save, Lock, Shield, LogOut, Check, Loader2
} from 'lucide-react'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { TwoFactorCard } from './two-factor-card'

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
      setError('Không thể tải thông tin profile')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn file hình ảnh')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Kích thước file không được vượt quá 5MB')
      return
    }

    setIsUploadingAvatar(true)
    setError('')

    try {
      // Convert to base64
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const base64 = ev.target?.result as string
        
        const res = await fetch('/api/users/me/avatar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64 }),
        })
        
        const data = await res.json()
        
        if (data.success) {
          setProfile(prev => prev ? { ...prev, image: data.data.image } : null)
          setSuccess('Cập nhật avatar thành công!')
          // Update session
          await updateSession()
        } else {
          setError(data.error || 'Lỗi khi upload avatar')
        }
        setIsUploadingAvatar(false)
      }
      reader.onerror = () => {
        setError('Lỗi khi đọc file')
        setIsUploadingAvatar(false)
      }
      reader.readAsDataURL(file)
    } catch (err) {
      console.error('Avatar upload error:', err)
      setError('Đã xảy ra lỗi khi upload avatar')
      setIsUploadingAvatar(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!formData.name.trim()) {
      setError('Vui lòng nhập tên hiển thị')
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
        setSuccess('Cập nhật thông tin thành công!')
        // Update session
        await updateSession()
      } else {
        setError(data.error || 'Lỗi khi cập nhật thông tin')
      }
    } catch (err) {
      console.error('Save profile error:', err)
      setError('Đã xảy ra lỗi khi lưu thông tin')
    } finally {
      setIsSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword) {
      setError('Vui lòng nhập mật khẩu hiện tại')
      return
    }
    if (!passwordForm.newPassword) {
      setError('Vui lòng nhập mật khẩu mới')
      return
    }
    if (passwordForm.newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự')
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp')
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
        setSuccess('Đổi mật khẩu thành công! Vui lòng đăng nhập lại.')
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
        // The server signed out every device, this one included.
        if (data.signedOut) {
          setTimeout(() => signOut({ callbackUrl: '/login' }), 1500)
        }
      } else {
        setError(data.error || 'Lỗi khi đổi mật khẩu')
      }
    } catch (err) {
      console.error('Change password error:', err)
      setError('Đã xảy ra lỗi khi đổi mật khẩu')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleChangeEmail = async () => {
    if (!emailForm.newEmail) {
      setError('Vui lòng nhập email mới')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailForm.newEmail)) {
      setError('Email không hợp lệ')
      return
    }
    if (!emailForm.password) {
      setError('Vui lòng nhập mật khẩu để xác nhận')
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
        setEmailChangeInfo(data.message)
        setEmailForm({ newEmail: '', password: '' })
        setSuccess('Đã gửi email xác nhận. Vui lòng kiểm tra hộp thư mới.')
      } else {
        setError(data.error || 'Lỗi khi đổi email')
      }
    } catch (err) {
      console.error('Change email error:', err)
      setError('Đã xảy ra lỗi khi đổi email')
    } finally {
      setIsChangingEmail(false)
    }
  }

  const handleLogout = () => {
    if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
      signOut({ callbackUrl: '/login' })
    }
  }

  // Handle email change redirect messages
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const status = params.get('email_change')
    if (status === 'success') {
      setSuccess('Đổi email thành công! Vui lòng đăng nhập lại.')
      fetchProfile()
      window.history.replaceState({}, '', '/profile')
    } else if (status === 'expired') {
      setError('Link xác nhận đã hết hạn. Vui lòng thử lại.')
      window.history.replaceState({}, '', '/profile')
    } else if (status === 'taken') {
      setError('Email này đã được sử dụng bởi tài khoản khác.')
      window.history.replaceState({}, '', '/profile')
    } else if (status === 'unauthorized') {
      setError('Bạn cần đăng nhập để xác nhận đổi email.')
      window.history.replaceState({}, '', '/profile')
    } else if (status === 'error') {
      setError('Đã xảy ra lỗi khi xác nhận đổi email.')
      window.history.replaceState({}, '', '/profile')
    }
  }, [])

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-acc" />
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <Header
        title="Tài khoản của tôi"
        description="Quản lý thông tin cá nhân và cài đặt bảo mật"
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
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'profile'
              ? 'bg-panel text-acc shadow-sm'
              : 'text-muted hover:text-fg'
          }`}
        >
          <User className="w-4 h-4" />
          Thông tin cá nhân
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'security'
              ? 'bg-panel text-acc shadow-sm'
              : 'text-muted hover:text-fg'
          }`}
        >
          <Shield className="w-4 h-4" />
          Bảo mật
        </button>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Avatar Card */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Ảnh đại diện</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className="relative mb-4">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-fg/5 border-4 border-panel shadow-lg">
                  {profile?.image ? (
                    <Image
                      src={profile.image}
                      alt={profile.name || 'Avatar'}
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
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={isUploadingAvatar}
                  />
                </label>
              </div>
              
              <p className="text-sm text-muted text-center">
                Nhấn vào icon máy ảnh để thay đổi avatar
              </p>
              <p className="text-xs text-muted mt-1">
                JPG, PNG (tối đa 5MB)
              </p>

              {/* User Info Summary */}
              <div className="w-full mt-6 pt-6 border-t border-line space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant={profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN' ? 'primary' : 'secondary'}>
                    {profile?.role === 'SUPER_ADMIN' ? 'Super Admin' : profile?.role === 'ADMIN' ? 'Admin' : 'Người dùng'}
                  </Badge>
                </div>
                <p className="text-xs text-muted">
                  Tham gia: {profile?.createdAt ? format(new Date(profile.createdAt), 'dd MMMM yyyy', { locale: vi }) : '-'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Profile Form */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Thông tin cá nhân</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Tên hiển thị"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nhập tên của bạn"
                  icon={<User className="w-4 h-4" />}
                  required
                />

                <Input
                  label="Email"
                  value={profile?.email || ''}
                  disabled
                  icon={<Mail className="w-4 h-4" />}
                  hint="Vào tab Bảo mật để thay đổi email"
                />

                <Input
                  label="Số điện thoại"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="VD: 0901234567"
                  icon={<Phone className="w-4 h-4" />}
                />

                <Input
                  label="Địa chỉ"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="VD: 123 Nguyễn Trãi, Quận 1, TP.HCM"
                  icon={<MapPin className="w-4 h-4" />}
                />

                <Input
                  label="Ngày sinh"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  icon={<Calendar className="w-4 h-4" />}
                />

                <div>
                  <label className="block text-sm font-medium text-fg mb-1.5">
                    <FileText className="w-4 h-4 inline mr-1.5" />
                    Giới thiệu bản thân
                  </label>
                  <textarea
                    className="w-full px-4 py-3 bg-fg/[0.03] border border-line rounded-xl text-sm font-medium text-charcoal placeholder-muted focus-visible:bg-panel focus-visible:border-acc focus-visible:ring-2 focus-visible:ring-acc/20 transition-all outline-none resize-none"
                    rows={3}
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Viết vài dòng giới thiệu về bản thân..."
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={handleSaveProfile} isLoading={isSaving}>
                    <Save className="w-4 h-4 mr-2" />
                    Lưu thay đổi
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="border-warn/30 bg-warn-soft/50">
              <CardHeader>
                <CardTitle className="text-warn flex items-center gap-2">
                  <LogOut className="w-5 h-5" />
                  Tài khoản
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="border-warn/30 text-warn hover:bg-warn-soft"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Đăng xuất
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
                Đổi địa chỉ email
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted">
                Hiện tại: <span className="font-semibold text-fg">{profile?.email}</span>
              </p>

              <div>
                <label className="block text-sm font-medium text-fg mb-1.5">
                  Email mới
                </label>
                <input
                  type="email"
                  value={emailForm.newEmail}
                  onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
                  className="w-full px-4 py-3 bg-fg/[0.03] border border-line rounded-xl text-sm font-medium text-charcoal placeholder-muted focus-visible:bg-panel focus-visible:border-acc focus-visible:ring-2 focus-visible:ring-acc/20 transition-all outline-none"
                  placeholder="email-moi@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-fg mb-1.5">
                  Nhập mật khẩu để xác nhận
                </label>
                <div className="relative">
                  <input
                    type={showNewEmailPassword ? 'text' : 'password'}
                    value={emailForm.password}
                    onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })}
                    className="w-full px-4 py-3 pr-12 bg-fg/[0.03] border border-line rounded-xl text-sm font-medium text-charcoal placeholder-muted focus-visible:bg-panel focus-visible:border-acc focus-visible:ring-2 focus-visible:ring-acc/20 transition-all outline-none"
                    placeholder="Mật khẩu hiện tại"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewEmailPassword(!showNewEmailPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-muted"
                  >
                    {showNewEmailPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                <p className="text-xs text-muted mt-1">
                  Một email xác nhận sẽ được gửi đến địa chỉ mới. Vui lòng nhấp vào link trong email để hoàn tất.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleChangeEmail} isLoading={isChangingEmail}>
                  <Mail className="w-4 h-4 mr-2" />
                  Gửi email xác nhận
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Password change */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Đổi mật khẩu
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted mb-4">
                Sử dụng mật khẩu mạnh để bảo vệ tài khoản của bạn
              </p>

              <div>
                <label className="block text-sm font-medium text-fg mb-1.5">
                  Mật khẩu hiện tại
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="w-full px-4 py-3 bg-fg/[0.03] border border-line rounded-xl text-sm font-medium text-charcoal placeholder-muted focus-visible:bg-panel focus-visible:border-acc focus-visible:ring-2 focus-visible:ring-acc/20 transition-all outline-none pr-12"
                    placeholder="Nhập mật khẩu hiện tại"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-muted"
                  >
                    {showCurrentPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-fg mb-1.5">
                  Mật khẩu mới
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full px-4 py-3 bg-fg/[0.03] border border-line rounded-xl text-sm font-medium text-charcoal placeholder-muted focus-visible:bg-panel focus-visible:border-acc focus-visible:ring-2 focus-visible:ring-acc/20 transition-all outline-none pr-12"
                    placeholder="Nhập mật khẩu mới (ít nhất 8 ký tự)"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-muted"
                  >
                    {showNewPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                <p className="text-xs text-muted mt-1">
                  Tối thiểu 8 ký tự
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-fg mb-1.5">
                  Xác nhận mật khẩu mới
                </label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full px-4 py-3 bg-fg/[0.03] border border-line rounded-xl text-sm font-medium text-charcoal placeholder-muted focus-visible:bg-panel focus-visible:border-acc focus-visible:ring-2 focus-visible:ring-acc/20 transition-all outline-none"
                  placeholder="Nhập lại mật khẩu mới"
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleChangePassword} isLoading={isChangingPassword}>
                  <Check className="w-4 h-4 mr-2" />
                  Cập nhật mật khẩu
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
                Bảo mật tài khoản
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-ok mt-2"></div>
                <p className="text-sm text-fg">
                  Mật khẩu được mã hóa và lưu trữ an toàn
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-ok mt-2"></div>
                <p className="text-sm text-fg">
                  Phiên đăng nhập có thời hạn và có thể bị thu hồi
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-ok mt-2"></div>
                <p className="text-sm text-fg">
                  Khuyến nghị sử dụng mật khẩu mạnh với ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageContainer>
  )
}
