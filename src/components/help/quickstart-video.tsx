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
  Building2,
  BedDouble,
  Globe,
  QrCode,
  Users,
  CheckCircle2,
  MousePointer2,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { QUICKSTART_VIDEO_META, VIDEO_CHAPTERS, type VideoChapter } from '@/lib/help/help-docs'
import { cn } from '@/lib/utils'

const STEP_DURATION_SEC = 8 // 8 seconds per animated scene -> 40s full interactive walkthrough
const TOTAL_DURATION_SEC = VIDEO_CHAPTERS.length * STEP_DURATION_SEC

function formatVideoTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`
}

/**
 * Animated UI scenes representing each of the 5 onboarding steps.
 * `progress` is 0..1 within the current step.
 */
function AnimatedStepScene({ stepNumber, progress }: { stepNumber: number; progress: number }) {
  if (stepNumber === 1) {
    const typedName = 'Digistay Riverside Resort'.slice(0, Math.floor(Math.min(1, progress * 1.8) * 25))
    const showSaved = progress > 0.65
    return (
      <div className="w-full max-w-md mx-auto bg-panel/95 text-fg rounded-xl border border-white/15 shadow-2xl p-4 space-y-3 text-left">
        <div className="flex items-center justify-between border-b border-line pb-2">
          <div className="flex items-center gap-2 text-xs font-bold">
            <Building2 className="w-4 h-4 text-primary" />
            <span>Cài đặt hồ sơ khách sạn</span>
          </div>
          {showSaved && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-ok-soft text-ok animate-in fade-in">
              <CheckCircle2 className="w-3 h-3" /> Đã lưu
            </span>
          )}
        </div>
        <div className="space-y-2">
          <div className="text-[11px] text-muted">Tên cơ sở lưu trú</div>
          <div className="h-8 px-3 rounded-lg bg-raised border border-line flex items-center text-xs font-medium">
            <span>{typedName}</span>
            <span className="w-0.5 h-3.5 bg-primary ml-0.5 animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[0.25, 0.45, 0.6].map((threshold, idx) => (
            <div
              key={idx}
              className={cn(
                'h-12 rounded-lg border flex items-center justify-center text-[10px] font-medium transition-all duration-300',
                progress >= threshold
                  ? 'bg-primary/15 border-primary/40 text-primary'
                  : 'bg-raised border-dashed border-line text-muted'
              )}
            >
              {progress >= threshold ? `Ảnh #${idx + 1} ✓` : 'Đang tải...'}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (stepNumber === 2) {
    const roomsReady = progress > 0.45
    return (
      <div className="w-full max-w-md mx-auto bg-panel/95 text-fg rounded-xl border border-white/15 shadow-2xl p-4 space-y-3 text-left">
        <div className="flex items-center justify-between border-b border-line pb-2">
          <div className="flex items-center gap-2 text-xs font-bold">
            <BedDouble className="w-4 h-4 text-primary" />
            <span>Hạng phòng & Bảng giá</span>
          </div>
          <span className="text-[11px] font-mono font-semibold text-primary">1.500.000đ / đêm</span>
        </div>
        <div className="p-2.5 rounded-lg bg-raised border border-line flex items-center justify-between">
          <div>
            <div className="text-xs font-bold">Deluxe Hướng Biển</div>
            <div className="text-[10px] text-muted">2 người lớn · Cuối tuần +20%</div>
          </div>
          <span className="px-2 py-0.5 rounded bg-ok-soft text-ok text-[10px] font-semibold">Đang bán</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {['P.101', 'P.102', 'P.103', 'P.104'].map((room, i) => (
            <div
              key={room}
              className={cn(
                'py-2 rounded-lg border text-center text-xs font-semibold transition-all duration-300',
                roomsReady && progress > 0.45 + i * 0.1
                  ? 'bg-ok-soft/70 border-ok/40 text-ok scale-100'
                  : 'bg-raised border-line text-muted opacity-60'
              )}
            >
              {room}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (stepNumber === 3) {
    const isPublished = progress > 0.6
    return (
      <div className="w-full max-w-md mx-auto bg-panel/95 text-fg rounded-xl border border-white/15 shadow-2xl p-4 space-y-3 text-left relative">
        <div className="flex items-center justify-between border-b border-line pb-2">
          <div className="flex items-center gap-2 text-xs font-bold">
            <Globe className="w-4 h-4 text-primary" />
            <span>Website Đặt Phòng Trực Tiếp</span>
          </div>
          <div
            className={cn(
              'px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all',
              isPublished ? 'bg-ok text-white shadow-sm' : 'bg-primary text-on-primary'
            )}
          >
            {isPublished ? 'Đã xuất bản 🟢' : 'Xuất bản ngay'}
          </div>
        </div>
        <div className="rounded-lg border border-line bg-raised p-3 space-y-2">
          <div className="h-2.5 w-28 rounded bg-fg/20" />
          <div className="h-4 w-48 rounded bg-primary/30" />
          <div className="flex items-center justify-between pt-2">
            <div className="h-6 w-24 rounded bg-primary text-on-primary text-[10px] font-semibold flex items-center justify-center">
              Đặt phòng ngay
            </div>
            <span className="text-[10px] font-mono text-muted">0% phí hoa hồng OTA</span>
          </div>
        </div>
        {!isPublished && (
          <MousePointer2
            className="w-5 h-5 text-amber-400 fill-amber-400 drop-shadow-md absolute transition-all duration-500"
            style={{
              right: progress > 0.35 ? '28px' : '110px',
              top: progress > 0.35 ? '18px' : '85px',
            }}
          />
        )}
      </div>
    )
  }

  if (stepNumber === 4) {
    const paid = progress > 0.55
    return (
      <div className="w-full max-w-md mx-auto bg-panel/95 text-fg rounded-xl border border-white/15 shadow-2xl p-4 space-y-3 text-left">
        <div className="flex items-center justify-between border-b border-line pb-2">
          <div className="flex items-center gap-2 text-xs font-bold">
            <QrCode className="w-4 h-4 text-primary" />
            <span>Đơn #BK-2026 · Thanh toán VietQR</span>
          </div>
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-[10px] font-semibold',
              paid ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'
            )}
          >
            {paid ? 'Đã nhận cọc ✓' : 'Chờ quét QR'}
          </span>
        </div>
        <div className="flex items-center gap-3.5">
          <div className="w-16 h-16 rounded-xl bg-white p-1.5 border border-line flex items-center justify-center shrink-0">
            <QrCode className="w-12 h-12 text-neutral-900" />
          </div>
          <div className="space-y-1 flex-1 min-w-0">
            <div className="text-xs font-bold">Khách: Nguyễn Minh Anh</div>
            <div className="text-[11px] text-muted">Phòng P.102 · 2 đêm</div>
            <div className="text-xs font-semibold text-primary">Tiền cọc: 500.000đ</div>
          </div>
        </div>
      </div>
    )
  }

  // Step 5
  const invited = progress > 0.5
  return (
    <div className="w-full max-w-md mx-auto bg-panel/95 text-fg rounded-xl border border-white/15 shadow-2xl p-4 space-y-3 text-left">
      <div className="flex items-center justify-between border-b border-line pb-2">
        <div className="flex items-center gap-2 text-xs font-bold">
          <Users className="w-4 h-4 text-primary" />
          <span>Phân quyền nhân viên lễ tân</span>
        </div>
      </div>
      <div className="flex items-center justify-between p-2.5 rounded-lg bg-raised border border-line">
        <div>
          <div className="text-xs font-semibold">leitan@digistay.vn</div>
          <div className="text-[10px] text-muted">Quyền: Check-in / Check-out · Ẩn báo cáo tài chính</div>
        </div>
        <span
          className={cn(
            'px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all',
            invited ? 'bg-ok-soft text-ok border-ok/30' : 'bg-acc-soft text-acc border-acc/30'
          )}
        >
          {invited ? 'Đã tham gia ✓' : 'Đang mời...'}
        </span>
      </div>
    </div>
  )
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
  const stepProgress = Math.min(
    1,
    Math.max(0, (elapsedSec - currentChapterIndex * STEP_DURATION_SEC) / STEP_DURATION_SEC)
  )

  const handleSelectChapter = (index: number) => {
    setElapsedSec(index * STEP_DURATION_SEC)
    setIsPlaying(true)
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
                Video tương tác
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5 max-w-2xl">
              {QUICKSTART_VIDEO_META.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Content Grid: Video Player (Left) + Chapters Timeline (Right) */}
      <div className={cn('grid grid-cols-1 lg:grid-cols-12', isExpanded && 'flex-1 min-h-0')}>
        {/* Left: Video Frame */}
        <div className="lg:col-span-7 p-4 sm:p-5 flex flex-col justify-between bg-page/40">
          {QUICKSTART_VIDEO_META.embedUrl ? (
            <div className="aspect-video w-full rounded-xl overflow-hidden border border-line bg-ink">
              <iframe
                src={`${QUICKSTART_VIDEO_META.embedUrl}?start=${activeChapter.seconds}`}
                title={QUICKSTART_VIDEO_META.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="aspect-video w-full rounded-xl overflow-hidden border border-line bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-white relative flex flex-col justify-between p-4 sm:p-5 shadow-md select-none">
              {/* Top Bar */}
              <div className="flex items-center justify-between gap-2 z-10">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/10 text-white backdrop-blur-xs border border-white/15">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Bước {activeChapter.stepNumber} / {VIDEO_CHAPTERS.length}: {activeChapter.title}
                </span>
                <span className="text-[11px] text-white/60 font-mono">Digistay Guide</span>
              </div>

              {/* Center Animated Scene */}
              <div className="my-auto py-2 z-10 relative">
                <AnimatedStepScene stepNumber={activeChapter.stepNumber} progress={stepProgress} />
                {!isPlaying && elapsedSec === 0 && (
                  <button
                    type="button"
                    onClick={handleTogglePlay}
                    className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-primary hover:bg-primary-hover text-on-primary flex items-center justify-center shadow-2xl transition-transform hover:scale-105 active:scale-95 ring-4 ring-white/20"
                    aria-label="Phát video hướng dẫn"
                  >
                    <Play className="w-7 h-7 ml-1 fill-current" />
                  </button>
                )}
              </div>

              {/* Subtitles (Captions) */}
              {showCaptions && (
                <div className="z-10 mx-auto max-w-lg px-3 py-1.5 rounded-lg bg-black/75 border border-white/10 text-center text-[11px] sm:text-xs text-white/95 leading-snug mb-2">
                  {activeChapter.summary}
                </div>
              )}

              {/* Video Controls Bar */}
              <div className="z-10 space-y-2 bg-black/50 backdrop-blur-xs rounded-xl p-2.5 border border-white/10">
                {/* Seek Bar */}
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

                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTogglePlay}
                      className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
                      aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setElapsedSec(0)
                        setIsPlaying(true)
                      }}
                      className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
                      title="Xem lại từ đầu"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono text-[11px] text-white/80">
                      {formatVideoTime(elapsedSec)} / {formatVideoTime(TOTAL_DURATION_SEC)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setPlaybackRate((r) => (r === 1 ? 1.5 : r === 1.5 ? 2 : 1))
                      }
                      className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 font-mono text-[11px] font-semibold transition-colors"
                      title="Tốc độ phát"
                    >
                      {playbackRate}x
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCaptions((c) => !c)}
                      className={cn(
                        'p-1.5 rounded-lg transition-colors',
                        showCaptions ? 'bg-primary/30 text-amber-300' : 'hover:bg-white/15 text-white/60'
                      )}
                      title="Bật/tắt phụ đề tiếng Việt"
                    >
                      <Captions className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsExpanded((e) => !e)}
                      className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
                      title={isExpanded ? 'Thu nhỏ' : 'Phóng to'}
                    >
                      {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Chapters List */}
        <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-line p-4 sm:p-5 flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              5 Chương Hướng Dẫn Nhanh
            </h3>
            <span className="text-[11px] text-muted">Bấm để chuyển cảnh</span>
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
