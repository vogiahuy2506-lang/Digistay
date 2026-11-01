'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Palette, Type, Check, Sparkles } from 'lucide-react'
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Input, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui'
import { normalizeFont } from '@/lib/public-site/font-stack'

interface ThemeStyleModalProps {
  isOpen: boolean
  onClose: () => void
  settings: {
    primaryColor: string
    secondaryColor: string
    accentColor: string
    buttonColor?: string | null
    headingColor?: string | null
    fontFamily: string
    headingFont: string
  }
  onChange: (updated: Partial<{
    primaryColor: string
    secondaryColor: string
    accentColor: string
    buttonColor: string | null
    headingColor: string | null
    fontFamily: string
    headingFont: string
  }>) => void
  bodyFonts: readonly { readonly value: string; readonly trait: string }[]
  headingFonts: readonly { readonly value: string; readonly trait: string }[]
}

const PALETTE_PRESETS = [
  {
    id: 'luxury-gold',
    name: 'Classic Luxury (Gold & Ink)',
    primary: '#C5A880',
    button: '#1C1B19',
    heading: '#1C1B19',
    bodyFont: 'Inter',
    headingFont: 'Playfair Display',
  },
  {
    id: 'ocean-resort',
    name: 'Ocean Resort (Teal & Navy)',
    primary: '#0D9488',
    button: '#0F172A',
    heading: '#0F172A',
    bodyFont: 'Be Vietnam Pro',
    headingFont: 'Montserrat',
  },
  {
    id: 'warm-boutique',
    name: 'Warm Boutique (Amber & Wood)',
    primary: '#D97706',
    button: '#292524',
    heading: '#292524',
    bodyFont: 'Inter',
    headingFont: 'Merriweather',
  },
  {
    id: 'minimal-slate',
    name: 'Modern Minimalist (Blue & Slate)',
    primary: '#2563EB',
    button: '#18181B',
    heading: '#18181B',
    bodyFont: 'Inter',
    headingFont: 'Plus Jakarta Sans',
  },
]

export function ThemeStyleModal({
  isOpen,
  onClose,
  settings,
  onChange,
  bodyFonts,
  headingFonts,
}: ThemeStyleModalProps) {
  const t = useTranslations('dash.website')
  const tc = useTranslations('dash.common')
  const [activeTab, setActiveTab] = React.useState('presets')

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" title={t('style.colors')}>
      <ModalHeader onClose={onClose}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-acc-soft text-acc">
            <Palette className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-fg">Giao diện & Bộ nhận diện</h2>
            <p className="text-xs text-muted">Tùy biến bảng màu, font chữ thương hiệu của website khách sạn</p>
          </div>
        </div>
      </ModalHeader>

      <ModalBody className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="presets" className="gap-2">
              <Sparkles className="h-4 w-4" />
              <span>Mẫu phối sẵn</span>
            </TabsTrigger>
            <TabsTrigger value="colors" className="gap-2">
              <Palette className="h-4 w-4" />
              <span>{t('style.colors')}</span>
            </TabsTrigger>
            <TabsTrigger value="fonts" className="gap-2">
              <Type className="h-4 w-4" />
              <span>{t('style.fonts')}</span>
            </TabsTrigger>
          </TabsList>

          {/* Presets Tab */}
          <TabsContent value="presets" className="mt-4 space-y-3">
            <p className="text-xs text-muted">Chọn nhanh phong cách phối màu & font chữ chuyên nghiệp:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PALETTE_PRESETS.map((preset) => {
                const isActive =
                  settings.primaryColor.toLowerCase() === preset.primary.toLowerCase()

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      onChange({
                        primaryColor: preset.primary,
                        buttonColor: preset.button,
                        headingColor: preset.heading,
                        fontFamily: preset.bodyFont,
                        headingFont: preset.headingFont,
                      })
                    }}
                    className={`flex flex-col p-4 rounded-xl border text-left transition-all ${
                      isActive
                        ? 'border-acc bg-acc-soft/30 ring-2 ring-acc'
                        : 'border-line bg-panel hover:border-acc/40 hover:bg-fg/[0.02]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-fg">{preset.name}</span>
                      {isActive && <Check className="h-4 w-4 text-acc" />}
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="w-6 h-6 rounded-full border border-black/10 shadow-sm"
                        style={{ backgroundColor: preset.primary }}
                        title="Primary Color"
                      />
                      <div
                        className="w-6 h-6 rounded-full border border-black/10 shadow-sm"
                        style={{ backgroundColor: preset.button }}
                        title="Button Color"
                      />
                      <span className="text-xs text-muted font-mono">{preset.primary}</span>
                    </div>
                    <p className="text-[11px] text-muted">
                      Font: <span className="font-medium text-fg">{preset.headingFont}</span> + {preset.bodyFont}
                    </p>
                  </button>
                )
              })}
            </div>
          </TabsContent>

          {/* Colors Tab */}
          <TabsContent value="colors" className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-fg">{t('style.primary')}</label>
              <p className="text-xs text-muted">{t('style.primaryHint')}</p>
              <div className="flex items-center gap-3 mt-1.5">
                <input
                  type="color"
                  value={settings.primaryColor || '#3B82F6'}
                  onChange={(e) => onChange({ primaryColor: e.target.value })}
                  className="w-10 h-10 rounded border border-line cursor-pointer"
                />
                <Input
                  value={settings.primaryColor || '#3B82F6'}
                  onChange={(e) => onChange({ primaryColor: e.target.value })}
                  className="flex-1 font-mono uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-line">
              <div>
                <label className="text-sm font-medium text-fg">{t('style.button')}</label>
                <p className="text-xs text-muted">{t('style.buttonHint')}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <input
                    type="color"
                    value={settings.buttonColor || '#1C1B19'}
                    onChange={(e) => onChange({ buttonColor: e.target.value })}
                    className="w-9 h-9 rounded border border-line cursor-pointer"
                  />
                  <Input
                    value={settings.buttonColor || ''}
                    placeholder="#1C1B19"
                    onChange={(e) => onChange({ buttonColor: e.target.value || null })}
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-fg">{t('style.heading')}</label>
                <p className="text-xs text-muted">{t('style.headingHint')}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <input
                    type="color"
                    value={settings.headingColor || '#1B1C1A'}
                    onChange={(e) => onChange({ headingColor: e.target.value })}
                    className="w-9 h-9 rounded border border-line cursor-pointer"
                  />
                  <Input
                    value={settings.headingColor || ''}
                    placeholder="#1B1C1A"
                    onChange={(e) => onChange({ headingColor: e.target.value || null })}
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            <p className="text-xs text-muted italic">{t('style.contrastNote')}</p>
          </TabsContent>

          {/* Fonts Tab */}
          <TabsContent value="fonts" className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-fg">{t('style.bodyFont')}</label>
              <select
                value={normalizeFont(settings.fontFamily, 'body')}
                onChange={(e) => onChange({ fontFamily: e.target.value })}
                className="w-full mt-1.5 px-3 py-2 border border-line rounded-ctl bg-raised text-fg text-sm focus:outline-none focus:ring-2 focus:ring-acc"
              >
                {bodyFonts.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.value} - {font.trait}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-fg">{t('style.headingFont')}</label>
              <select
                value={normalizeFont(settings.headingFont, 'heading')}
                onChange={(e) => onChange({ headingFont: e.target.value })}
                className="w-full mt-1.5 px-3 py-2 border border-line rounded-ctl bg-raised text-fg text-sm focus:outline-none focus:ring-2 focus:ring-acc"
              >
                {headingFonts.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.value} - {font.trait}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-4 rounded-xl border border-line bg-fg/[0.02]">
              <p className="text-xs uppercase tracking-wider text-muted mb-1">Mẫu xem trước font chữ</p>
              <h3 className="text-xl font-bold text-fg mb-1" style={{ fontFamily: settings.headingFont }}>
                Trải nghiệm kỳ nghỉ hoàn hảo tại khách sạn
              </h3>
              <p className="text-sm text-muted" style={{ fontFamily: settings.fontFamily }}>
                Không gian sang trọng, dịch vụ tận tâm và những khoảnh khắc đáng nhớ dành cho bạn và gia đình.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </ModalBody>

      <ModalFooter>
        <Button onClick={onClose} className="w-full sm:w-auto">
          {tc('actions.close') || 'Đóng'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
