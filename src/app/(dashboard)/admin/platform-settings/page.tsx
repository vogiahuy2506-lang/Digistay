'use client'

import * as React from 'react'
import {
  Activity,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  HardDrive,
  Key,
  Mail,
  Receipt,
  RefreshCw,
  Send,
  Server,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Button, Input, toast } from '@/components/ui'
import type { AllPlatformSettings } from '@/lib/admin/platform-settings'

export default function PlatformSettingsPage() {
  const [settings, setSettings] = React.useState<AllPlatformSettings | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [savingKey, setSavingKey] = React.useState<string | null>(null)
  const [testingGemini, setTestingGemini] = React.useState(false)
  const [testingSmtp, setTestingSmtp] = React.useState(false)
  const [testEmailTarget, setTestEmailTarget] = React.useState('')
  const [activeTab, setActiveTab] = React.useState<'payos' | 'matbao' | 'gemini' | 'smtp' | 'branding'>('payos')

  const loadSettings = React.useCallback(async () => {
    try {
      const res = await fetch('/api/admin/platform-settings', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.success) {
        setSettings(json.data)
      } else {
        toast.error(json?.error || 'Không tải được cấu hình hệ thống')
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Save specific section
  const handleSaveSection = async (key: keyof AllPlatformSettings) => {
    if (!settings) return
    setSavingKey(key)
    try {
      const res = await fetch('/api/admin/platform-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: settings[key] }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        toast.error(json?.error || `Không thể lưu cấu hình ${key}`)
        return
      }
      toast.success(`Đã lưu cấu hình ${key.toUpperCase()} thành công!`)
      await loadSettings()
    } catch {
      toast.error('Lỗi kết nối khi lưu cấu hình')
    } finally {
      setSavingKey(null)
    }
  }

  // Test Gemini Ping
  const handleTestGemini = async () => {
    setTestingGemini(true)
    try {
      const res = await fetch('/api/admin/platform-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_gemini',
          customApiKey: settings?.gemini.apiKey,
        }),
      })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.success) {
        toast.success(json.message)
      } else {
        toast.error(json?.message || 'Kiểm tra Gemini thất bại')
      }
    } catch {
      toast.error('Lỗi kết nối')
    } finally {
      setTestingGemini(false)
    }
  }

  // Test SMTP Email
  const handleTestSmtp = async () => {
    setTestingSmtp(true)
    try {
      const res = await fetch('/api/admin/platform-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_smtp',
          targetEmail: testEmailTarget.trim() || undefined,
          smtpConfig: settings?.smtp,
        }),
      })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.success) {
        toast.success(json.message)
      } else {
        toast.error(json?.message || 'Kiểm tra gửi mail thất bại')
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ mail')
    } finally {
      setTestingSmtp(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-8">
      {/* 1. Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl font-bold tracking-tight text-fg sm:text-3xl">
              Cấu hình Nền tảng Toàn cầu
            </h1>
            <span className="rounded-full bg-acc/10 px-2.5 py-0.5 text-xs font-semibold text-acc border border-acc/20">
              Platform Settings
            </span>
          </div>
          <p className="mt-1.5 text-sm text-muted">
            Quản trị tập trung các API Keys, Cổng thanh toán bán gói, Hóa đơn điện tử Mắt Bão và thông tin doanh nghiệp.
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => loadSettings()}
          disabled={loading}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Tải lại
        </Button>
      </div>

      {loading || !settings ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted gap-3">
          <RefreshCw className="h-7 w-7 animate-spin text-acc" />
          <p className="text-xs">Đang tải cấu hình nền tảng...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tabs Navigation */}
          <div className="flex items-center gap-2 border-b border-line pb-3 overflow-x-auto text-xs">
            {[
              { id: 'payos', label: 'Cổng PayOS Nền tảng', icon: CreditCard },
              { id: 'matbao', label: 'HĐĐT Mắt Bão (VAT)', icon: Receipt },
              { id: 'gemini', label: 'Google Gemini AI', icon: Bot },
              { id: 'smtp', label: 'Email SMTP Server', icon: Mail },
              { id: 'branding', label: 'Thông tin Nền tảng', icon: Building2 },
            ].map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 rounded-lg px-3.5 py-2 font-medium transition-all whitespace-nowrap ${
                    active
                      ? 'bg-acc text-acc-fg font-semibold shadow-xs'
                      : 'text-muted hover:text-fg hover:bg-fg/5'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* TAB 1: PayOS */}
          {activeTab === 'payos' && (
            <div className="rounded-2xl border border-line bg-panel p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div>
                  <h3 className="text-base font-bold text-fg">Cấu hình Cổng thanh toán PayOS Nền tảng</h3>
                  <p className="text-xs text-muted">Dùng để tạo link thanh toán VietQR thu tiền khi khách hàng nâng cấp hoặc gia hạn gói cước phần mềm.</p>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 border border-emerald-500/20">
                  Tài khoản Digistay
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-fg">PayOS Client ID</label>
                  <input
                    type="text"
                    value={settings.payos.clientId}
                    onChange={(e) => setSettings({ ...settings, payos: { ...settings.payos, clientId: e.target.value } })}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-fg">PayOS API Key</label>
                  <input
                    type="text"
                    value={settings.payos.apiKey}
                    onChange={(e) => setSettings({ ...settings, payos: { ...settings.payos, apiKey: e.target.value } })}
                    placeholder="Nhập API Key mới hoặc giữ nguyên"
                    className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg font-mono"
                  />
                  <p className="mt-1 text-[10px] text-muted">Bảo mật: Nếu giữ nguyên ký tự che dấu ••••••••, hệ thống sẽ sử dụng key hiện tại.</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-fg">PayOS Checksum Key</label>
                  <input
                    type="text"
                    value={settings.payos.checksumKey}
                    onChange={(e) => setSettings({ ...settings, payos: { ...settings.payos, checksumKey: e.target.value } })}
                    placeholder="Nhập Checksum Key mới hoặc giữ nguyên"
                    className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-fg">Webhook URL tiếp nhận kết quả thanh toán</label>
                  <input
                    type="text"
                    readOnly
                    value={settings.payos.webhookUrl}
                    className="mt-1 w-full rounded-ctl border border-line bg-fg/[0.03] px-3 py-2 text-xs text-muted font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end pt-4 border-t border-line">
                <Button
                  size="sm"
                  onClick={() => handleSaveSection('payos')}
                  disabled={savingKey === 'payos'}
                  className="gap-1.5 bg-acc text-acc-fg hover:opacity-90"
                >
                  {savingKey === 'payos' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Lưu cấu hình PayOS
                </Button>
              </div>
            </div>
          )}

          {/* TAB 2: Mắt Bão */}
          {activeTab === 'matbao' && (
            <div className="rounded-2xl border border-line bg-panel p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div>
                  <h3 className="text-base font-bold text-fg">Cấu hình Hóa đơn Điện tử Mắt Bão (e-Invoice)</h3>
                  <p className="text-xs text-muted">Tự động phát hành hóa đơn GTGT hợp lệ của Tổng cục Thuế gửi cho khách hàng mua gói.</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted font-medium">Môi trường:</label>
                  <select
                    value={settings.matbao.environment}
                    onChange={(e) => setSettings({ ...settings, matbao: { ...settings.matbao, environment: e.target.value as any } })}
                    className="rounded-ctl border border-line bg-page px-2.5 py-1 text-xs font-semibold text-fg"
                  >
                    <option value="demo">Demo / Thử nghiệm</option>
                    <option value="prod">Production / Xuất hóa đơn thật</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-fg">Mã số thuế Doanh nghiệp (MST) *</label>
                  <input
                    type="text"
                    value={settings.matbao.taxCode}
                    onChange={(e) => setSettings({ ...settings, matbao: { ...settings.matbao, taxCode: e.target.value } })}
                    placeholder="vd: 0312345678"
                    className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-fg">Tên tài khoản Mắt Bão *</label>
                  <input
                    type="text"
                    value={settings.matbao.username}
                    onChange={(e) => setSettings({ ...settings, matbao: { ...settings.matbao, username: e.target.value } })}
                    placeholder="admin_account"
                    className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-fg">Mật khẩu Mắt Bão API *</label>
                  <input
                    type="password"
                    value={settings.matbao.password}
                    onChange={(e) => setSettings({ ...settings, matbao: { ...settings.matbao, password: e.target.value } })}
                    placeholder="••••••••"
                    className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-fg">Ký hiệu Series Hóa đơn *</label>
                  <input
                    type="text"
                    value={settings.matbao.invoiceSeries}
                    onChange={(e) => setSettings({ ...settings, matbao: { ...settings.matbao, invoiceSeries: e.target.value } })}
                    placeholder="1C26TDS"
                    className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-fg">Mẫu số Hóa đơn *</label>
                  <input
                    type="text"
                    value={settings.matbao.templateCode}
                    onChange={(e) => setSettings({ ...settings, matbao: { ...settings.matbao, templateCode: e.target.value } })}
                    placeholder="01GTKT0/001"
                    className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end pt-4 border-t border-line">
                <Button
                  size="sm"
                  onClick={() => handleSaveSection('matbao')}
                  disabled={savingKey === 'matbao'}
                  className="gap-1.5 bg-acc text-acc-fg hover:opacity-90"
                >
                  {savingKey === 'matbao' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Lưu cấu hình Mắt Bão
                </Button>
              </div>
            </div>
          )}

          {/* TAB 3: Google Gemini */}
          {activeTab === 'gemini' && (
            <div className="rounded-2xl border border-line bg-panel p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div>
                  <h3 className="text-base font-bold text-fg">Cấu hình Trí tuệ Nhân tạo Google Gemini</h3>
                  <p className="text-xs text-muted">Điều khiển bộ não AI dùng cho sinh nội dung marketing, trợ lý ảo Chatbot và định giá phòng thông minh.</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTestGemini}
                  disabled={testingGemini}
                  className="gap-1.5 text-xs text-acc border-acc/30 hover:bg-acc/10"
                >
                  {testingGemini ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-acc" />}
                  Kiểm tra kết nối Gemini API
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-fg">Gemini API Key *</label>
                  <input
                    type="text"
                    value={settings.gemini.apiKey}
                    onChange={(e) => setSettings({ ...settings, gemini: { ...settings.gemini, apiKey: e.target.value } })}
                    placeholder="AIzaSy..."
                    className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-fg">Model AI Mặc định</label>
                    <select
                      value={settings.gemini.defaultModel}
                      onChange={(e) => setSettings({ ...settings, gemini: { ...settings.gemini, defaultModel: e.target.value } })}
                      className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg"
                    >
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (Tốc độ cao nhất, chi phí tối ưu)</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash (Ổn định cao)</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro (Xử lý chuyên sâu)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-fg">Độ sáng tạo (Temperature: {settings.gemini.temperature})</label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.1}
                      value={settings.gemini.temperature}
                      onChange={(e) => setSettings({ ...settings, gemini: { ...settings.gemini, temperature: parseFloat(e.target.value) } })}
                      className="mt-3 w-full"
                    />
                    <div className="flex justify-between text-[10px] text-muted">
                      <span>Chính xác (0.0)</span>
                      <span>Cân bằng (0.7)</span>
                      <span>Sáng tạo (1.0)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end pt-4 border-t border-line">
                <Button
                  size="sm"
                  onClick={() => handleSaveSection('gemini')}
                  disabled={savingKey === 'gemini'}
                  className="gap-1.5 bg-acc text-acc-fg hover:opacity-90"
                >
                  {savingKey === 'gemini' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Lưu cấu hình Gemini
                </Button>
              </div>
            </div>
          )}

          {/* TAB 4: SMTP */}
          {activeTab === 'smtp' && (
            <div className="rounded-2xl border border-line bg-panel p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div>
                  <h3 className="text-base font-bold text-fg">Cấu hình Máy chủ Gửi Thư (SMTP Server)</h3>
                  <p className="text-xs text-muted">Gửi email kích hoạt tài khoản, mã xác thực OTP, hóa đơn và thông báo đặt phòng.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-fg">SMTP Host *</label>
                  <input
                    type="text"
                    value={settings.smtp.host}
                    onChange={(e) => setSettings({ ...settings, smtp: { ...settings.smtp, host: e.target.value } })}
                    placeholder="smtp.gmail.com"
                    className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-fg">SMTP Port *</label>
                  <input
                    type="number"
                    value={settings.smtp.port}
                    onChange={(e) => setSettings({ ...settings, smtp: { ...settings.smtp, port: parseInt(e.target.value, 10) || 587 } })}
                    placeholder="587"
                    className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-fg">Tên tài khoản (Username / Email) *</label>
                  <input
                    type="text"
                    value={settings.smtp.username}
                    onChange={(e) => setSettings({ ...settings, smtp: { ...settings.smtp, username: e.target.value } })}
                    placeholder="notifications@digistay.vn"
                    className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-fg">Mật khẩu ứng dụng (App Password) *</label>
                  <input
                    type="password"
                    value={settings.smtp.password}
                    onChange={(e) => setSettings({ ...settings, smtp: { ...settings.smtp, password: e.target.value } })}
                    placeholder="••••••••"
                    className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-fg">Tên người gửi (From Name)</label>
                  <input
                    type="text"
                    value={settings.smtp.fromName}
                    onChange={(e) => setSettings({ ...settings, smtp: { ...settings.smtp, fromName: e.target.value } })}
                    placeholder="Digistay Hospitality"
                    className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-fg">Địa chỉ gửi (From Email)</label>
                  <input
                    type="email"
                    value={settings.smtp.fromEmail}
                    onChange={(e) => setSettings({ ...settings, smtp: { ...settings.smtp, fromEmail: e.target.value } })}
                    placeholder="no-reply@digistay.vn"
                    className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg"
                  />
                </div>
              </div>

              {/* Test Email Box */}
              <div className="rounded-xl border border-line/80 bg-fg/[0.02] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-fg">Kiểm tra đường truyền gửi thư</p>
                  <p className="text-[11px] text-muted">Nhập địa chỉ email của bạn để gửi một bức thư kiểm tra thực tế.</p>
                  <input
                    type="email"
                    value={testEmailTarget}
                    onChange={(e) => setTestEmailTarget(e.target.value)}
                    placeholder="Nhập email của bạn (mặc định gửi tới tài khoản của bạn)..."
                    className="mt-2 w-full max-w-md rounded-ctl border border-line bg-page px-3 py-1.5 text-xs text-fg"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTestSmtp}
                  disabled={testingSmtp}
                  className="gap-1.5 text-xs text-acc border-acc/30 hover:bg-acc/10 whitespace-nowrap self-end sm:self-center"
                >
                  {testingSmtp ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Gửi email thử nghiệm
                </Button>
              </div>

              <div className="flex items-center justify-end pt-4 border-t border-line">
                <Button
                  size="sm"
                  onClick={() => handleSaveSection('smtp')}
                  disabled={savingKey === 'smtp'}
                  className="gap-1.5 bg-acc text-acc-fg hover:opacity-90"
                >
                  {savingKey === 'smtp' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Lưu cấu hình SMTP
                </Button>
              </div>
            </div>
          )}

          {/* TAB 5: Branding & Legal */}
          {activeTab === 'branding' && (
            <div className="rounded-2xl border border-line bg-panel p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div>
                  <h3 className="text-base font-bold text-fg">Thông tin Nền tảng & Pháp lý Digistay</h3>
                  <p className="text-xs text-muted">Thông tin xuất hiện ở chân trang, hợp đồng điện tử và email chăm sóc khách hàng toàn sàn.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-fg">Tên thương hiệu nền tảng</label>
                  <input
                    type="text"
                    value={settings.branding.companyName}
                    onChange={(e) => setSettings({ ...settings, branding: { ...settings.branding, companyName: e.target.value } })}
                    placeholder="Digistay Hospitality Platform"
                    className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-fg">Tên pháp nhân công ty</label>
                  <input
                    type="text"
                    value={settings.branding.legalName}
                    onChange={(e) => setSettings({ ...settings, branding: { ...settings.branding, legalName: e.target.value } })}
                    placeholder="Công ty Cổ phần Công nghệ Du lịch Digistay"
                    className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-fg">Hotline hỗ trợ kỹ thuật</label>
                  <input
                    type="text"
                    value={settings.branding.hotline}
                    onChange={(e) => setSettings({ ...settings, branding: { ...settings.branding, hotline: e.target.value } })}
                    placeholder="1900 8888"
                    className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-fg">Email hỗ trợ khách hàng</label>
                  <input
                    type="email"
                    value={settings.branding.supportEmail}
                    onChange={(e) => setSettings({ ...settings, branding: { ...settings.branding, supportEmail: e.target.value } })}
                    placeholder="support@digistay.vn"
                    className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-fg">Địa chỉ trụ sở công ty</label>
                  <input
                    type="text"
                    value={settings.branding.address}
                    onChange={(e) => setSettings({ ...settings, branding: { ...settings.branding, address: e.target.value } })}
                    placeholder="Tầng 10, Tòa nhà Bitexco, Quận 1, TP. Hồ Chí Minh"
                    className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end pt-4 border-t border-line">
                <Button
                  size="sm"
                  onClick={() => handleSaveSection('branding')}
                  disabled={savingKey === 'branding'}
                  className="gap-1.5 bg-acc text-acc-fg hover:opacity-90"
                >
                  {savingKey === 'branding' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Lưu thông tin pháp lý
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

