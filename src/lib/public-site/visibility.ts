/**
 * Who may see a hotel's site. A site is public once the hotel publishes it
 * in the website builder ("Xuất bản ngay", website_settings.isPublished).
 * Before that, only signed-in members who reach it (the owner, members on
 * every property or on this one) see it, as a preview (with a banner, see
 * [subdomain]/layout.tsx); everyone else gets a 404, exactly as for a hotel
 * that does not exist.
 *
 * isPublished used to be stored and never read: every hotel's site and its
 * booking form were public from the moment the property was created.
 *
 * Not cached across requests: unpublishing or deactivating applies at once.
 */
import { cache } from 'react'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { getAccess, seesProperty } from '@/lib/auth/access'

export interface VisibleSite {
  propertyId: string
  /** Not published: shown only because the visitor reaches the hotel (a member of its workspace). */
  preview: boolean
}

/** Select these with the property, then ask siteVisibility(). */
export const SITE_VISIBILITY_SELECT = {
  id: true,
  workspaceId: true,
  websiteSettings: { select: { isPublished: true } },
} as const

/** 'public' once published; 'preview' for a signed-in member who reaches it; else null (a 404). */
export async function siteVisibility(property: {
  id: string
  workspaceId: string
  websiteSettings: { isPublished: boolean } | null
}): Promise<'public' | 'preview' | null> {
  if (property.websiteSettings?.isPublished) return 'public'
  const userId = (await auth())?.user?.id
  const access = userId ? await getAccess(property.workspaceId, userId) : null
  return access && seesProperty(access, property.id) ? 'preview' : null
}

/** The site at this subdomain if this visitor may see it, else null (render a 404). */
export const loadVisibleSite = cache(async (subdomain: string): Promise<VisibleSite | null> => {
  const property = await prisma.property.findFirst({
    where: { subdomain, isActive: true },
    select: SITE_VISIBILITY_SELECT,
  })
  if (!property) return null
  const visibility = await siteVisibility(property)
  return visibility ? { propertyId: property.id, preview: visibility === 'preview' } : null
})
