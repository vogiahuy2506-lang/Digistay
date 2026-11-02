'use client'

import * as React from 'react'
import Script from 'next/script'
import {
  cleanFacebookPixelId,
  cleanGoogleTagId,
  type TrackingEventData,
} from '@/lib/marketing/tracking'

interface MarketingTrackingProps {
  facebookPixelId?: string | null
  googleTagId?: string | null
}

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    fbq?: (...args: unknown[]) => void
    _fbq?: unknown
  }
}

/**
 * Fires a standard e-commerce event to both Google Tag and Facebook Pixel if configured.
 * Safely checks for existence of window.gtag and window.fbq before calling.
 */
export function trackMarketingEvent(
  eventName: 'PageView' | 'ViewContent' | 'InitiateCheckout' | 'Purchase',
  data?: TrackingEventData
) {
  if (typeof window === 'undefined') return

  try {
    // 1. Google Analytics / Google Tag
    if (typeof window.gtag === 'function') {
      const gaEventMap: Record<string, string> = {
        PageView: 'page_view',
        ViewContent: 'view_item',
        InitiateCheckout: 'begin_checkout',
        Purchase: 'purchase',
      }
      const gaEvent = gaEventMap[eventName] || eventName
      window.gtag('event', gaEvent, data)
    }

    // 2. Facebook Meta Pixel
    if (typeof window.fbq === 'function') {
      if (data) {
        window.fbq('track', eventName, data)
      } else {
        window.fbq('track', eventName)
      }
    }
  } catch (err) {
    // Non-blocking catch
    console.debug('[MarketingTracking] Event tracking error:', err)
  }
}

/**
 * Client component to securely inject Google Tag and Facebook Pixel scripts
 * into the public hotel storefront when configured by the hotel owner.
 */
export function MarketingTracking({ facebookPixelId, googleTagId }: MarketingTrackingProps) {
  const pixelId = cleanFacebookPixelId(facebookPixelId)
  const tagId = cleanGoogleTagId(googleTagId)

  if (!pixelId && !tagId) return null

  return (
    <>
      {/* 1. Google Analytics 4 / Google Tag Manager */}
      {tagId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${tagId}`}
            strategy="afterInteractive"
          />
          <Script id="google-tag-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${tagId}', {
                page_path: window.location.pathname,
              });
            `}
          </Script>
        </>
      )}

      {/* 2. Meta Facebook Pixel */}
      {pixelId && (
        <>
          <Script id="facebook-pixel-init" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${pixelId}');
              fbq('track', 'PageView');
            `}
          </Script>
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      )}
    </>
  )
}
