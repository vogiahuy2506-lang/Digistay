'use client'

import * as React from 'react'
import {
  Edit3,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Trash2,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface InspectableSectionProps {
  id: string
  type: string
  name: string
  isEnabled: boolean
  index: number
  total: number
  isSelected: boolean
  isBeingDragged?: boolean
  compact?: boolean
  onEdit: () => void
  onToggle: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onRemove?: () => void
  children: React.ReactNode
}

/**
 * Interactive inspectable section wrapper for the website preview canvas.
 * Allows hover-to-inspect with floating action toolbar and click-to-edit.
 */
export function InspectableSection({
  name,
  isEnabled,
  index,
  total,
  isSelected,
  isBeingDragged = false,
  compact = false,
  onEdit,
  onToggle,
  onMoveUp,
  onMoveDown,
  onRemove,
  children,
}: InspectableSectionProps) {
  const [isHovered, setIsHovered] = React.useState(false)

  const showToolbar = isHovered || isSelected

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'group relative border-2 transition-all duration-200',
        isBeingDragged && 'border-info/40 bg-info-soft/30 opacity-50',
        !isBeingDragged && isSelected && 'border-acc ring-2 ring-acc/30 shadow-md',
        !isBeingDragged && !isSelected && isHovered && 'border-acc/70 ring-1 ring-acc/20',
        !isBeingDragged && !isSelected && !isHovered && 'border-transparent',
        !isEnabled && 'opacity-60 bg-fg/[0.02]'
      )}
    >
      {/* Floating Action Toolbar on Hover / Selection */}
      <div
        className={cn(
          'absolute top-3 right-3 z-30 flex items-center gap-1 p-1 rounded-xl bg-page/95 shadow-xl border border-line backdrop-blur-md transition-all duration-200',
          showToolbar ? 'opacity-100 pointer-events-auto translate-y-0' : 'opacity-0 pointer-events-none -translate-y-1'
        )}
      >
        {/* Section Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-acc-soft text-acc text-xs font-semibold select-none">
          <Sparkles className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span className="max-w-[140px] truncate">
            #{index + 1} {name}
          </span>
        </div>

        {/* Quick Edit button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-acc text-on-acc text-xs font-medium hover:opacity-95 shadow-sm transition-opacity"
          title="Chỉnh sửa nội dung & giao diện khối này"
        >
          <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Sửa</span>
        </button>

        {/* Visibility Toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className={cn(
            'p-1.5 rounded-lg text-muted hover:text-fg hover:bg-fg/5 transition-colors',
            !isEnabled && 'text-warning font-medium'
          )}
          title={isEnabled ? 'Ẩn khối này trên website' : 'Hiện khối này trên website'}
          aria-label={isEnabled ? 'Ẩn khối' : 'Hiện khối'}
        >
          {isEnabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-warning" />}
        </button>

        {/* Move Up */}
        {onMoveUp && (
          <button
            type="button"
            disabled={index === 0}
            onClick={(e) => {
              e.stopPropagation()
              onMoveUp()
            }}
            className="p-1.5 rounded-lg text-muted hover:text-fg hover:bg-fg/5 disabled:opacity-25 disabled:pointer-events-none transition-colors"
            title="Di chuyển lên"
            aria-label="Di chuyển lên"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Move Down */}
        {onMoveDown && (
          <button
            type="button"
            disabled={index >= total - 1}
            onClick={(e) => {
              e.stopPropagation()
              onMoveDown()
            }}
            className="p-1.5 rounded-lg text-muted hover:text-fg hover:bg-fg/5 disabled:opacity-25 disabled:pointer-events-none transition-colors"
            title="Di chuyển xuống"
            aria-label="Di chuyển xuống"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Remove */}
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors"
            title="Xóa khối khỏi trang"
            aria-label="Xóa khối"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Floating Tooltip hint at Top-Left */}
      <div
        className={cn(
          'absolute top-3 left-3 z-20 pointer-events-none transition-all duration-200',
          isHovered && !compact ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
        )}
      >
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-fg/80 text-page text-[11px] font-medium shadow-sm backdrop-blur-sm">
          <Edit3 className="w-2.5 h-2.5" /> Nhấp để chỉnh sửa khối
        </span>
      </div>

      {/* Hidden Overlay if block is disabled */}
      {!isEnabled && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-page/75 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-ink text-on-ink text-xs font-medium shadow-lg">
            <EyeOff className="w-3.5 h-3.5" />
            <span>Khối này đang ẩn trên website khách</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onToggle()
              }}
              className="ml-1 text-acc underline hover:opacity-80"
            >
              Bật lại
            </button>
          </div>
        </div>
      )}

      {/* Main Section Content - Clicking triggers edit */}
      <div
        onClick={onEdit}
        className="cursor-pointer select-none"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onEdit()
          }
        }}
        aria-label={`Chỉnh sửa ${name}`}
      >
        {children}
      </div>

      {/* Persistent subtle index badge when not hovered */}
      {!showToolbar && (
        <span
          className="absolute right-2 top-2 rounded-ctl bg-fg/70 px-1.5 py-0.5 text-[11px] font-medium text-page shadow pointer-events-none"
          aria-hidden="true"
        >
          #{index + 1}
        </span>
      )}
    </div>
  )
}

