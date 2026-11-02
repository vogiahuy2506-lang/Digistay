'use client'

import { useEffect } from 'react'
import { trackMarketingEvent } from './MarketingTracking'

export function TrackRoomView({
  roomId,
  roomName,
  price,
}: {
  roomId: string
  roomName: string
  price?: number
}) {
  useEffect(() => {
    trackMarketingEvent('ViewContent', {
      content_ids: [roomId],
      content_name: roomName,
      content_type: 'product',
      value: price,
      currency: 'VND',
    })
  }, [roomId, roomName, price])

  return null
}
