'use client'

import * as React from 'react'
import { Check, Sparkles, Wand2, Palette, ArrowRight } from 'lucide-react'
import { HOTEL_LANDING_TEMPLATES, type HotelLandingTemplate } from '@/lib/public-site/landing-templates'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface TemplateCardProps {
  template: HotelLandingTemplate
  isActive?: boolean
  onApply: (template: HotelLandingTemplate) => void
}

export function TemplateCard({ template, isActive = false, onApply }: TemplateCardProps) {
  return (
    <div
      className={cn(
        'group relative rounded-2xl border transition-all duration-200 overflow-hidden bg-panel',
        isActive ? 'border-acc ring-2 ring-acc/30 shadow-md' : 'border-line hover:border-acc/70 hover:shadow-sm'
      )}
    >
      {/* Visual Header / Banner */}
      <div className={cn('h-24 w-full bg-gradient-to-br p-3.5 flex flex-col justify-between text-white relative', template.previewGradient)}>
        <div className="flex items-center justify-between gap-2 z-10">
          <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase border', template.badgeColor)}>
            {template.badge}
          </span>
          {isActive && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-acc text-on-acc text-[10px] font-bold shadow-sm">
              <Check className="w-3 h-3" /> Đang dùng
            </span>
          )}
        </div>
        <div className="z-10">
          <p className="text-xs font-medium opacity-80 uppercase tracking-widest">{template.style.headingFont} + {template.style.fontFamily}</p>
          <h4 className="text-base font-bold truncate drop-shadow-sm">{template.name}</h4>
        </div>
        {/* Subtle decorative glow */}
        <div className="absolute inset-0 bg-black/15 pointer-events-none" />
      </div>

      {/* Body */}
      <div className="p-3.5 space-y-3">
        <div>
          <p className="text-xs font-medium text-fg line-clamp-1">{template.tagline}</p>
          <p className="text-[11px] text-muted mt-1 line-clamp-2">{template.description}</p>
        </div>

        {/* Color Palette Swatches */}
        <div className="flex items-center justify-between pt-1 border-t border-line/60">
          <span className="text-[11px] text-muted flex items-center gap-1">
            <Palette className="w-3 h-3" /> Bảng màu
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className="w-4 h-4 rounded-full border border-black/10 shadow-sm"
              style={{ backgroundColor: template.style.primaryColor }}
              title={`Chính: ${template.style.primaryColor}`}
            />
            <span
              className="w-4 h-4 rounded-full border border-black/10 shadow-sm"
              style={{ backgroundColor: template.style.secondaryColor }}
              title={`Phụ: ${template.style.secondaryColor}`}
            />
            <span
              className="w-4 h-4 rounded-full border border-black/10 shadow-sm"
              style={{ backgroundColor: template.style.accentColor }}
              title={`Điểm nhấn: ${template.style.accentColor}`}
            />
            <span
              className="w-4 h-4 rounded-full border border-black/10 shadow-sm"
              style={{ backgroundColor: template.style.buttonColor }}
              title={`Nút bấm: ${template.style.buttonColor}`}
            />
          </div>
        </div>

        {/* Recommended Tag */}
        <div className="text-[11px] text-muted bg-fg/[0.03] px-2.5 py-1.5 rounded-lg border border-line/40">
          <span className="font-medium text-fg/80">Phù hợp:</span> {template.recommendedFor}
        </div>

        {/* Included Sections Preview */}
        <div className="flex flex-wrap gap-1">
          {template.blocks.slice(0, 4).map((b, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-fg/5 text-muted">
              {b.name.replace(/^(Banner |Hạng phòng |Dịch vụ |Tiện ích |Giới thiệu |Đánh giá |Bản đồ |Liên hệ |Khuyến mãi )/i, '') || b.type}
            </span>
          ))}
          {template.blocks.length > 4 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-fg/5 text-muted font-medium">
              +{template.blocks.length - 4} phần khác
            </span>
          )}
        </div>

        {/* Apply Button */}
        <Button
          type="button"
          onClick={() => onApply(template)}
          variant={isActive ? 'outline' : 'primary'}
          size="sm"
          className="w-full gap-1.5 text-xs h-8"
        >
          {isActive ? (
            <>
              <Check className="w-3.5 h-3.5" />
              Đang áp dụng mẫu này
            </>
          ) : (
            <>
              <Wand2 className="w-3.5 h-3.5" />
              Áp dụng mẫu này
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
