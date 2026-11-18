'use client'

import * as React from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  Clock,
  Sparkles,
  MonitorPlay,
  Captions,
  MousePointer2,
  Maximize2,
  Minimize2,
  PenLine,
  MousePointerClick,
} from 'lucide-react'
import { QUICKSTART_VIDEO_META, VIDEO_CHAPTERS, type VideoChapter } from '@/lib/help/help-docs'
import { cn } from '@/lib/utils'

interface CalloutSpot {
  id: number
  kind: 'click' | 'input'
  label: string
  hint: string
  /** Percentage coordinates matching the 1280x720 screenshot */
  x: number
  y: number
  w: number
  h: number
  /** Where to place the floating badge relative to the box */
  badgePos?: 'top' | 'bottom' | 'left'
}

const STEP_SCREENSHOTS: Record<number, { image: string; spots: CalloutSpot[] }> = {
  1: {
    image: '/guides/step-1.png',
    spots: [
      {
        id: 1,
        kind: 'click',
        label: 'Bấm vào đây',
        hint: 'Tải lên logo & ảnh bìa khách sạn',
        x: 47.2,
        y: 37.2,
        w: 11.2,
        h: 6.2,
        badgePos: 'top',
      },
      {
        id: 2,
        kind: 'input',
        label: 'Điền vào đây',
        hint: 'Nhập tên khách sạn hiển thị với khách',
        x: 24.0,
        y: 81.5,
        w: 48.0,
        h: 6.8,
        badgePos: 'top',
      },
      {
        id: 3,
        kind: 'click',
        label: 'Bấm lưu',
        hint: 'Nhấn Lưu thay đổi để hoàn tất',
        x: 87.3,
        y: 6.5,
        w: 10.6,
        h: 5.6,
        badgePos: 'bottom',
      },
    ],
  },
  2: {
    image: '/guides/step-2.png',
    spots: [
      {
        id: 1,
        kind: 'click',
        label: 'Bấm vào đây',
        hint: 'Tạo hạng phòng mới (Deluxe, Suite...)',
        x: 83.6,
        y: 5.8,
        w: 14.3,
        h: 6.2,
        badgePos: 'bottom',
      },
      {
        id: 2,
        kind: 'click',
        label: 'Bấm vào đây',
        hint: 'Mở cài đặt để sửa giá & tải ảnh phòng',
        x: 23.0,
        y: 39.8,
        w: 6.2,
        h: 5.5,
        badgePos: 'bottom',
      },
      {
        id: 3,
        kind: 'click',
        label: 'Bấm vào đây',
        hint: 'Đánh số phòng cụ thể (P.101, P.102...)',
        x: 32.0,
        y: 14.5,
        w: 11.5,
        h: 6.2,
        badgePos: 'bottom',
      },
    ],
  },
  3: {
    image: '/guides/step-3.png',
    spots: [
      {
        id: 1,
        kind: 'input',
        label: 'Điền vào đây',
        hint: 'Nhập mô tả hoặc bấm chọn gợi ý AI',
        x: 34.4,
        y: 83.5,
        w: 62.8,
        h: 11.2,
        badgePos: 'top',
      },
      {
        id: 2,
        kind: 'click',
        label: 'Bấm vào đây',
        hint: 'Bật trạng thái Đã xuất bản để mở web',
        x: 78.6,
        y: 4.0,
        w: 9.0,
        h: 5.6,
        badgePos: 'bottom',
      },
      {
        id: 3,
        kind: 'click',
        label: 'Bấm lưu',
        hint: 'Nhấn Lưu thay đổi để cập nhật website',
        x: 87.6,
        y: 4.0,
        w: 10.2,
        h: 5.6,
        badgePos: 'bottom',
      },
    ],
  },
  4: {
    image: '/guides/step-4.png',
    spots: [
      {
        id: 1,
        kind: 'input',
        label: 'Điền vào đây',
        hint: 'Chọn ngày nhận phòng & trả phòng',
        x: 22.8,
        y: 19.5,
        w: 33.0,
        h: 8.5,
        badgePos: 'bottom',
      },
      {
        id: 2,
        kind: 'click',
        label: 'Bấm vào đây',
        hint: 'Chọn hạng phòng còn trống cho khách',
        x: 52.6,
        y: 55.2,
        w: 12.6,
        h: 5.8,
        badgePos: 'top',
      },
      {
        id: 3,
        kind: 'input',
        label: 'Điền vào đây',
        hint: 'Nhập tên, SĐT khách và xác nhận đơn',
        x: 68.4,
        y: 74.2,
        w: 27.8,
        h: 14.5,
        badgePos: 'top',
      },
    ],
  },
  5: {
    image: '/guides/step-5.png',
    spots: [
      {
        id: 1,
        kind: 'click',
        label: 'Bấm vào đây',
        hint: 'Nhập email để mời lễ tân hoặc quản lý',
        x: 82.2,
        y: 21.2,
        w: 12.0,
        h: 6.0,
        badgePos: 'bottom',
      },
      {
        id: 2,
        kind: 'click',
        label: 'Bấm vào đây',
        hint: 'Kiểm tra danh sách lời mời đang chờ',
        x: 17.8,
        y: 40.8,
        w: 8.6,
        h: 5.8,
        badgePos: 'bottom',
      },
      {
        id: 3,
        kind: 'click',
        label: 'Bấm vào đây',
        hint: 'Tùy chỉnh quyền để bảo mật doanh thu',
        x: 79.2,
        y: 69.2,
        w: 10.8,
        h: 5.8,
        badgePos: 'top',
      },
    ],
  },
}

const STEP_DURATION_SEC = 9 // 3 seconds per callout spot * 3 spots = 9s/chapter
const TOTAL_DURATION_SEC = VIDEO_CHAPTERS.length * STEP_DURATION_SEC

function formatVideoTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`
}

export function QuickstartVideo() {
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [elapsedSec, setElapsedSec] = React.useState(0)
  const [playbackRate, setPlaybackRate] = React.useState<1 | 1.5 | 2>(1)
  const [showCaptions, setShowCaptions] = React.useState(true)
  const [isExpanded, setIsExpanded] = React.useState(false)

  React.useEffect(() => {
    if (!isPlaying) return
    const interval = window.setInterval(() => {
      setElapsedSec((prev) => {
        const next = prev + 0.1 * playbackRate
        if (next >= TOTAL_DURATION_SEC) {
          setIsPlaying(false)
          return TOTAL_DURATION_SEC
        }
        return next
      })
    }, 100)
    return () => window.clearInterval(interval)
  }, [isPlaying, playbackRate])

  const currentChapterIndex = Math.min(
    VIDEO_CHAPTERS.length - 1,
    Math.floor(elapsedSec / STEP_DURATION_SEC)
  )
  const activeChapter: VideoChapter = VIDEO_CHAPTERS[currentChapterIndex]
  const sceneData = STEP_SCREENSHOTS[activeChapter.stepNumber]

  const timeInChapter = elapsedSec - currentChapterIndex * STEP_DURATION_SEC
  const spotIndex = Math.min(
    sceneData.spots.length - 1,
    Math.floor(timeInChapter / (STEP_DURATION_SEC / sceneData.spots.length))
  )
  const activeSpot = sceneData.spots[spotIndex]

  const handleSelectChapter = (index: number) => {
    setElapsedSec(index * STEP_DURATION_SEC)
    setIsPlaying(true)
  }

  const handleSelectSpot = (idx: number) => {
    setElapsedSec(currentChapterIndex * STEP_DURATION_SEC + idx * (STEP_DURATION_SEC / sceneData.spots.length) + 0.1)
  }

  const handleTogglePlay = () => {
    if (elapsedSec >= TOTAL_DURATION_SEC) {
      setElapsedSec(0)
    }
    setIsPlaying((v) => !v)
  }

  return (
    <section
      className={cn(
        'rounded-2xl border border-line bg-panel overflow-hidden shadow-xs',
        isExpanded && 'fixed inset-4 z-50 flex flex-col shadow-2xl'
      )}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-line flex flex-wrap items-center justify-between gap-3 bg-raised/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-acc-soft text-acc flex items-center justify-center shrink-0 border border-acc/20">
            <MonitorPlay className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-fg">{QUICKSTART_VIDEO_META.title}</h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-acc-soft text-acc border border-acc/20">
                <Clock className="w-3 h-3" />
                Hướng dẫn trực quan trên giao diện thật
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5 max-w-2xl">
              {QUICKSTART_VIDEO_META.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Content Grid: Real Screenshot Annotated Video (Left) + Chapters Timeline (Right) */}
      <div className={cn('grid grid-cols-1 lg:grid-cols-12', isExpanded && 'flex-1 min-h-0')}>
        {/* Left: Annotated Video Player */}
        <div className="lg:col-span-8 p-4 sm:p-5 flex flex-col justify-between bg-page/40 gap-3">
          <div className="aspect-video w-full rounded-xl overflow-hidden border border-line bg-neutral-950 relative shadow-md select-none group">
            {/* Real UI Screenshot */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sceneData.image}
              alt={activeChapter.title}
              className="w-full h-full object-cover object-top transition-opacity duration-300"
            />

            {/* Subtle dark dim overlay when showing active callout */}
            <div className="absolute inset-0 bg-black/20 pointer-events-none" />

            {/* Highlight Callout Overlays */}
            {sceneData.spots.map((spot, idx) => {
              const isCurrentSpot = idx === spotIndex
              const Icon = spot.kind === 'input' ? PenLine : MousePointerClick
              return (
                <button
                  key={spot.id}
                  type="button"
                  onClick={() => handleSelectSpot(idx)}
                  style={{
                    left: `${spot.x}%`,
                    top: `${spot.y}%`,
                    width: `${spot.w}%`,
                    height: `${spot.h}%`,
                  }}
                  className={cn(
                    'absolute rounded-lg transition-all duration-300 cursor-pointer focus:outline-none',
                    isCurrentSpot
                      ? 'border-2 border-primary bg-primary/15 ring-4 ring-primary/40 shadow-lg z-20 scale-[1.02]'
                      : 'border-2 border-dashed border-amber-400/80 bg-amber-400/10 hover:bg-amber-400/20 z-10 opacity-85'
                  )}
                  title={`${spot.label}: ${spot.hint}`}
                >
                  {/* Numbered Pin + Action Label */}
                  <div
                    className={cn(
                      'absolute left-0 flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap shadow-md transition-all',
                      spot.badgePos === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5',
                      isCurrentSpot
                        ? 'bg-primary text-white scale-105'
                        : 'bg-neutral-900/90 text-amber-300 border border-amber-400/40'
                    )}
                  >
                    <span
                      className={cn(
                        'w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-extrabold',
                        isCurrentSpot ? 'bg-white text-primary' : 'bg-amber-400 text-neutral-950'
                      )}
                    >
                      {spot.id}
                    </span>
                    <Icon className="w-3 h-3 shrink-0" />
                    <span>{spot.label}</span>
                  </div>
                </button>
              )
            })}

            {/* Animated Mouse Cursor gliding to the active callout */}
            {activeSpot && (
              <div
                className="absolute z-30 pointer-events-none transition-all duration-700 ease-out"
                style={{
                  left: `${activeSpot.x + activeSpot.w * 0.65}%`,
                  top: `${activeSpot.y + activeSpot.h * 0.65}%`,
                }}
              >
                <MousePointer2 className="w-6 h-6 text-white fill-primary drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]" />
              </div>
            )}

            {/* Center Play Button Overlay before starting */}
            {!isPlaying && elapsedSec === 0 && (
              <div className="absolute inset-0 bg-black/35 flex items-center justify-center z-30">
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-primary hover:bg-primary-hover text-white font-semibold text-sm shadow-2xl transition-transform hover:scale-105 active:scale-95 ring-4 ring-white/25"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Xem hướng dẫn từng bước</span>
                </button>
              </div>
            )}

            {/* Bottom Caption Bar inside Frame */}
            {showCaptions && activeSpot && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 max-w-[90%] px-3.5 py-1.5 rounded-xl bg-black/85 border border-white/15 text-center shadow-xl backdrop-blur-xs">
                <span className="text-[11px] sm:text-xs font-semibold text-amber-300 mr-1.5">
                  Điểm {activeSpot.id} ({activeSpot.label}):
                </span>
                <span className="text-[11px] sm:text-xs text-white">
                  {activeSpot.hint}
                </span>
              </div>
            )}
          </div>

          {/* Video Controls Bar Below Frame */}
          <div className="rounded-xl bg-raised border border-line p-2.5 space-y-2">
            <input
              type="range"
              min={0}
              max={TOTAL_DURATION_SEC}
              step={0.1}
              value={elapsedSec}
              onChange={(e) => setElapsedSec(Number(e.target.value))}
              aria-label="Thanh tiến trình video"
              className="w-full h-1.5 accent-primary cursor-pointer rounded-full"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-on-primary font-semibold hover:bg-primary-hover transition-colors"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>{isPlaying ? 'Tạm dừng' : 'Phát'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setElapsedSec(0)
                    setIsPlaying(true)
                  }}
                  className="p-1.5 rounded-lg bg-panel border border-line text-muted hover:text-fg transition-colors"
                  title="Xem lại từ đầu"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[11px] text-muted">
                  {formatVideoTime(elapsedSec)} / {formatVideoTime(TOTAL_DURATION_SEC)}
                </span>
              </div>

              {/* Quick spot selector pills */}
              <div className="flex items-center gap-1.5">
                {sceneData.spots.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectSpot(idx)}
                    className={cn(
                      'px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors',
                      idx === spotIndex
                        ? 'bg-acc-soft border-acc/40 text-acc'
                        : 'bg-panel border-line text-muted hover:text-fg'
                    )}
                  >
                    #{s.id} {s.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setPlaybackRate((r) => (r === 1 ? 1.5 : r === 1.5 ? 2 : 1))
                  }
                  className="px-2 py-1 rounded-md bg-panel border border-line hover:bg-raised font-mono text-[11px] font-semibold text-fg transition-colors"
                  title="Tốc độ phát"
                >
                  {playbackRate}x
                </button>
                <button
                  type="button"
                  onClick={() => setShowCaptions((c) => !c)}
                  className={cn(
                    'p-1.5 rounded-lg border transition-colors',
                    showCaptions
                      ? 'bg-acc-soft border-acc/30 text-acc'
                      : 'bg-panel border-line text-muted hover:text-fg'
                  )}
                  title="Bật/tắt chú thích trên hình"
                >
                  <Captions className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpanded((e) => !e)}
                  className="p-1.5 rounded-lg bg-panel border border-line text-muted hover:text-fg transition-colors"
                  title={isExpanded ? 'Thu nhỏ' : 'Phóng to'}
                >
                  {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Chapters List */}
        <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-line p-4 sm:p-5 flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              5 Chương Hướng Dẫn Thực Tế
            </h3>
            <span className="text-[11px] text-muted">Bấm để chuyển màn hình</span>
          </div>

          <div className="space-y-2 flex-1">
            {VIDEO_CHAPTERS.map((chap, idx) => {
              const isActive = currentChapterIndex === idx
              return (
                <button
                  key={chap.id}
                  type="button"
                  onClick={() => handleSelectChapter(idx)}
                  className={cn(
                    'w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3',
                    isActive
                      ? 'bg-acc-soft border-acc/40 shadow-2xs'
                      : 'bg-raised/40 border-line hover:bg-raised hover:border-fg/20'
                  )}
                >
                  <div
                    className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5',
                      isActive ? 'bg-acc text-on-acc' : 'bg-panel text-muted border border-line'
                    )}
                  >
                    {chap.stepNumber}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('text-xs font-semibold truncate', isActive ? 'text-fg' : 'text-fg/90')}>
                        {chap.title}
                      </span>
                      <span className="text-[11px] font-mono text-muted shrink-0 px-1.5 py-0.5 rounded bg-panel border border-line">
                        {formatVideoTime(idx * STEP_DURATION_SEC)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted mt-1 line-clamp-2 leading-relaxed">
                      {chap.summary}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
