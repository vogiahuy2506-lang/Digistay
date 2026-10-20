/**
 * Route helpers for workspace + property-scoped URLs.
 *
 * New URL structure:
 *   /workspace-picker/[slug]                       → workspace home (list properties)
 *   /workspace/[slug]/properties                   → list properties
 *   /workspace/[slug]/properties/new               → create property
 *   /workspace/[slug]/properties/[id]              → property detail (manage)
 *   /workspace/[slug]/properties/[id]/bookings     → bookings of property
 *   /workspace/[slug]/properties/[id]/...          → other property-scoped pages
 *   /workspace/[slug]/members                      → workspace members
 *   /workspaces                                    → list all my workspaces
 *   /[subdomain]                                   → public website of property
 */

export interface RouteContext {
  workspaceSlug?: string
  propertyId?: string
}

export const routes = {
  // Top-level
  workspaces: () => '/workspaces',
  workspace: (slug: string) => `/workspace/${slug}`,

  // Property-scoped
  properties: (slug: string) => `/workspace/${slug}/properties`,
  newProperty: (slug: string) => `/workspace/${slug}/properties/new`,
  property: (slug: string, id: string) => `/workspace/${slug}/properties/${id}`,
  propertyBookings: (slug: string, id: string) => `/workspace/${slug}/properties/${id}/bookings`,
  propertyBooking: (slug: string, propId: string, bookingId: string) =>
    `/workspace/${slug}/properties/${propId}/bookings/${bookingId}`,
  propertyBookingNew: (slug: string, id: string) =>
    `/workspace/${slug}/properties/${id}/bookings/new`,
  propertyCalendar: (slug: string, id: string) => `/workspace/${slug}/properties/${id}/calendar`,
  propertyRooms: (slug: string, id: string) => `/workspace/${slug}/properties/${id}/rooms`,
  propertyWebsite: (slug: string, id: string) => `/workspace/${slug}/properties/${id}/website`,
  propertyReports: (slug: string, id: string) => `/workspace/${slug}/properties/${id}/reports`,
  propertyDailyReport: (slug: string, id: string) =>
    `/workspace/${slug}/properties/${id}/reports/daily`,
  propertyPayments: (slug: string, id: string) => `/workspace/${slug}/properties/${id}/payments`,
  propertyInvoices: (slug: string, id: string) => `/workspace/${slug}/properties/${id}/invoices`,
  propertyBankAccounts: (slug: string, id: string) =>
    `/workspace/${slug}/properties/${id}/bank-accounts`,
  propertyServices: (slug: string, id: string) => `/workspace/${slug}/properties/${id}/services`,
  propertyPolicies: (slug: string, id: string) => `/workspace/${slug}/properties/${id}/policies`,

  // Workspace-scoped
  members: (slug: string) => `/workspace/${slug}/members`,
  settings: (slug: string) => `/workspace/${slug}/settings`,

  // Public
  publicSite: (subdomain: string) => `/${subdomain}`,

  // User
  profile: () => '/profile',
} as const

/**
 * Build a query string for APIs that still need workspaceId/propertyId
 */
export function withIds(opts: { workspaceId?: string; propertyId?: string }): string {
  const params = new URLSearchParams()
  if (opts.workspaceId) params.set('workspaceId', opts.workspaceId)
  if (opts.propertyId) params.set('propertyId', opts.propertyId)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}
