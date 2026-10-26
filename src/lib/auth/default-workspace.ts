/**
 * The workspace a new account starts with, like the sign-up form makes
 * (api/auth/register): for accounts made by a first Google sign-in, which
 * otherwise landed on an empty /workspaces. It starts the trial.
 */
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/db'
import { generateSlug } from '@/lib/utils'
import { trialFields } from '@/lib/billing/subscription'

export async function createDefaultWorkspace(userId: string, name: string) {
  const base = generateSlug(`${name}-workspace`) || 'workspace'
  const taken = await prisma.workspace.findUnique({ where: { slug: base }, select: { id: true } })
  const slug = taken ? `${base}-${randomBytes(3).toString('hex')}` : base
  return prisma.workspace.create({
    data: {
      name: `${name}'s Workspace`,
      slug,
      ownerId: userId,
      description: 'Không gian làm việc mặc định',
      subscription: { create: trialFields() },
    },
  })
}
