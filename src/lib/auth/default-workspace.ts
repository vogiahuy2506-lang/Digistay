/**
 * The workspace a new account starts with, like the sign-up form makes
 * (api/auth/register): for accounts made by a first Google sign-in, which
 * otherwise landed on an empty /workspaces. It starts the trial.
 */
import { randomBytes } from 'crypto'
import { prisma, prismaWithDeleted } from '@/lib/db'
import { generateSlug } from '@/lib/utils'
import { inheritedOrTrialFields } from '@/lib/billing/subscription'

/** Default name for first workspace upon signup, avoiding "Workspace Workspace" duplication. */
export function defaultWorkspaceName(name: string) {
  const clean = name.trim()
  if (!clean) return 'Hệ thống lưu trú'
  return clean.toLowerCase().startsWith('workspace') ? clean : `Hệ thống của ${clean}`
}

export async function createDefaultWorkspace(userId: string, name: string) {
  const base = generateSlug(`${name}-workspace`) || 'workspace'
  // A deleted workspace keeps its slug until it is purged (src/lib/deletion).
  const taken = await prismaWithDeleted.workspace.findUnique({ where: { slug: base }, select: { id: true } })
  const slug = taken ? `${base}-${randomBytes(3).toString('hex')}` : base
  return prisma.workspace.create({
    data: {
      name: defaultWorkspaceName(name),
      slug,
      ownerId: userId,
      description: 'Không gian làm việc mặc định',
      subscription: { create: await inheritedOrTrialFields(userId, prisma) },
    },
  })
}
