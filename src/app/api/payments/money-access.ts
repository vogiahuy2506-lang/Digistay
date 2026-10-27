/**
 * Who sees what of a hotel's money, by permission (src/lib/auth/permissions.ts):
 * payments are listed to whoever may work them (payments_manage), invoices
 * to whoever may issue them (invoices_manage), and money totals only to
 * those who may see revenue (revenue_view), each on the properties they
 * reach.
 *
 * Used by GET /api/payments and GET /api/invoices; GET
 * /api/workspaces/[id]/stats applies the same rule to its revenue fields.
 */
import { prisma } from '@/lib/db'
import { accessibleProperties } from '@/lib/auth/access'

/**
 * Whether the user may see money totals: of this property, or (no
 * property) of at least one property.
 */
export async function seesMoneyTotals(userId: string, propertyId?: string | null): Promise<boolean> {
  const count = await prisma.property.count({
    where: { AND: [accessibleProperties(userId, 'revenue_view'), propertyId ? { id: propertyId } : {}] },
  })
  return count > 0
}
