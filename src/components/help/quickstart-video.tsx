'use client'

import * as React from 'react'
import { Play, Clock, CheckCircle2, Sparkles, MonitorPlay } from 'lucide-react'
import { QUICKSTART_VIDEO_META, VIDEO_CHAPTERS, type VideoChapter } from '@/lib/help/help-docs'
import { cn } from '@/lib/utils'

export function QuickstartVideo() {
  const [activeChapter, setActiveChapter] = React.useState<VideoChapter>(VIDEO_CHAPTERS[0])
  const [isPlayingPreview, setIsPlayingPreview] = React.useState(false)

  return (
    <section className="rounded-2xl border border-line bg-panel overflow-hidden shadow-xs">
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
                {QUICKSTART_VIDEO_META.durationLabel}
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5 max-w-2xl">
              {QUICKSTART_VIDEO_META.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Content Grid: Video Player (Left) + Chapters Timeline (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left: Video Frame */}
        <div className="lg:col-span-7 p-4 sm:p-5 flex flex-col justify-between bg-page/40">
          {QUICKSTART_VIDEO_META.embedUrl ? (
            <div className="aspect-video w-full rounded-xl overflow-hidden border border-line bg-ink">
              <iframe
                src={`${QUICKSTART_VIDEO_META.embedUrl}?start=${activeChapter.seconds}&autoplay=${isPlayingPreview ? 1 : 0}`}
                title={QUICKSTART_VIDEO_META.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="aspect-video w-full rounded-xl overflow-hidden border border-line bg-ink text-on-ink relative flex flex-col justify-between p-5 sm:p-6 shadow-md">
              {/* Top Bar */}
              <div className="flex items-center justify-between gap-2 z-10">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/10 text-white backdrop-blur-xs border border-white/15">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Bước {activeChapter.stepNumber} / {VIDEO_CHAPTERS.length} · {activeChapter.timestamp}
                </span>
                <span className="text-[11px] text-white/60 font-mono">Digistay Academy</span>
              </div>

              {/* Center Play / Walkthrough Visual */}
              <div className="my-auto py-4 flex flex-col items-center text-center z-10">
                <button
                  type="button"
                  onClick={() => setIsPlayingPreview((v) => !v)}
                  className="group w-14 h-14 rounded-full bg-primary hover:bg-primary-hover text-on-primary flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 mb-3"
                  aria-label="Xem hướng dẫn bước này"
                >
                  <Play className="w-6 h-6 ml-0.5 fill-current" />
                </button>
                <h3 className="text-base sm:text-lg font-bold text-white max-w-md">
                  {activeChapter.title}
                </h3>
                <p className="text-xs sm:text-sm text-white/75 mt-1.5 max-w-lg leading-relaxed">
                  {activeChapter.summary}
                </p>
                {isPlayingPreview && (
                  <div className="mt-3 px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-[11px] text-amber-300">
                    Video hướng dẫn chuẩn HD đang được biên tập & xuất bản. Bạn có thể bấm từng bước bên phải hoặc làm theo Checklist bên dưới ngay!
                  </div>
                )}
              </div>

              {/* Bottom Progress Bar Simulation */}
              <div className="z-10 space-y-1.5">
                <div className="h-1.5 w-full rounded-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${(activeChapter.stepNumber / VIDEO_CHAPTERS.length) * 100}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-white/60">
                  <span>Chương đang chọn: Bước {activeChapter.stepNumber}</span>
                  <span>Tổng thời lượng: {QUICKSTART_VIDEO_META.durationLabel}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Chapters List */}
        <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-line p-4 sm:p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Nội dung video (5 chương)
            </h3>
            <span className="text-[11px] text-muted">Chọn bước để xem</span>
          </div>

          <div className="space-y-2 flex-1">
            {VIDEO_CHAPTERS.map((chap) => {
              const isActive = activeChapter.id === chap.id
              return (
                <button
                  key={chap.id}
                  type="button"
                  onClick={() => setActiveChapter(chap)}
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
                        {chap.timestamp}
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
