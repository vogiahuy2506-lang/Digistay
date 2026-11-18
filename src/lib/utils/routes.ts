/**
 * Route helpers for workspace + property-scoped URLs.
 *
 * New URL structure:
 *   /workspace/[slug]                              → workspace home (list properties)
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
  workspace: (slug: string) => `/app/${slug}`,

  // Property-scoped (shortened via middleware rewrite /app/[slug]/[id]/*)
  properties: (slug: string) => `/app/${slug}/properties`,
  newProperty: (slug: string) => `/app/${slug}/properties/new`,
  property: (slug: string, id: string) => `/app/${slug}/${id}`,
  propertyBookings: (slug: string, id: string) => `/app/${slug}/${id}/bookings`,
  propertyBooking: (slug: string, propId: string, bookingId: string) =>
    `/app/${slug}/${propId}/bookings/${bookingId}`,
  propertyBookingNew: (slug: string, id: string) =>
    `/app/${slug}/${id}/bookings/new`,
  propertyCalendar: (slug: string, id: string) => `/app/${slug}/${id}/calendar`,
  propertyRooms: (slug: string, id: string) => `/app/${slug}/${id}/rooms`,
  propertyWebsite: (slug: string, id: string) => `/app/${slug}/${id}/website`,
  propertyReports: (slug: string, id: string) => `/app/${slug}/${id}/reports`,
  propertyDailyReport: (slug: string, id: string) =>
    `/app/${slug}/${id}/reports/daily`,
  propertyPayments: (slug: string, id: string) => `/app/${slug}/${id}/payments`,
  propertyInvoices: (slug: string, id: string) => `/app/${slug}/${id}/invoices`,
  propertyBankAccounts: (slug: string, id: string) =>
    `/app/${slug}/${id}/bank-accounts`,
  propertyServices: (slug: string, id: string) => `/app/${slug}/${id}/services`,
  propertyMenu: (slug: string, id: string) => `/app/${slug}/${id}/menu`,
  propertyPolicies: (slug: string, id: string) => `/app/${slug}/${id}/policies`,
  propertySettings: (slug: string, id: string) => `/app/${slug}/${id}/settings`,
  propertyCoupons: (slug: string, id: string) => `/app/${slug}/${id}/coupons`,
  propertyChannels: (slug: string, id: string) => `/app/${slug}/${id}/channels`,
  propertyCustomers: (slug: string, id: string) => `/app/${slug}/${id}/customers`,
  propertyCustomer: (slug: string, id: string, customerId: string) =>
    `/app/${slug}/${id}/customers/${customerId}`,
  propertyLeads: (slug: string, id: string) => `/app/${slug}/${id}/leads`,
  propertyBlog: (slug: string, id: string) => `/app/${slug}/${id}/blog`,
  propertyBlogNew: (slug: string, id: string) => `/app/${slug}/${id}/blog/new`,
  propertyBlogPost: (slug: string, id: string, postId: string) => `/app/${slug}/${id}/blog/${postId}`,

  // Workspace-scoped
  members: (slug: string) => `/app/${slug}/members`,
  settings: (slug: string) => `/app/${slug}/settings`,
  billing: (slug: string) => `/app/${slug}/billing`,
  help: (slug: string) => `/app/${slug}/help`,
  billingCheckout: (_slug: string, plan?: string, billing?: string) =>
    `/billing/checkout${plan ? `?plan=${plan}&billing=${billing ?? 'MONTH'}` : ''}`,

  // Public
  publicSite: (subdomain: string) => `/${subdomain}`,
  publicBlog: (subdomain: string) => `/${subdomain}/blog`,
  publicBlogPost: (subdomain: string, postSlug: string) => `/${subdomain}/blog/${postSlug}`,
  /** A saved version of the site, read-only, for the people who may edit it. */
  siteVersionPreview: (subdomain: string, versionId: string) => `/${subdomain}/phien-ban/${versionId}`,

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
