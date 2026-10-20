'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Users } from 'lucide-react'
import { Input, Button } from '@/components/ui'
import { useSiteHref } from './site-base'

export function SearchBar() {
  const router = useRouter()
  const href = useSiteHref()
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [guests, setGuests] = useState(2)

  const today = new Date().toISOString().split('T')[0]

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!checkIn || !checkOut) return
    const params = new URLSearchParams({
      checkIn,
      checkOut,
      guests: String(guests),
    })
    router.push(href(`/search?${params.toString()}`))
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white rounded-2xl shadow-2xl p-4 md:p-6 max-w-4xl mx-auto"
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nhận phòng</label>
          <Input
            type="date"
            value={checkIn}
            min={today}
            onChange={(e) => setCheckIn(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Trả phòng</label>
          <Input
            type="date"
            value={checkOut}
            min={checkIn || today}
            onChange={(e) => setCheckOut(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Số khách</label>
          <div className="flex items-center border border-gray-300 rounded-md h-10">
            <button
              type="button"
              onClick={() => setGuests(Math.max(1, guests - 1))}
              className="px-3 h-full text-gray-600 hover:bg-gray-50"
              aria-label="Giảm"
            >
              −
            </button>
            <span className="flex-1 text-center text-sm">
              <Users className="w-4 h-4 inline mr-1" />
              {guests}
            </span>
            <button
              type="button"
              onClick={() => setGuests(Math.min(20, guests + 1))}
              className="px-3 h-full text-gray-600 hover:bg-gray-50"
              aria-label="Tăng"
            >
              +
            </button>
          </div>
        </div>
        <div className="flex items-end">
          <Button type="submit" className="w-full" size="lg">
            <Search className="w-4 h-4 mr-2" />
            Tìm phòng
          </Button>
        </div>
      </div>
    </form>
  )
}
