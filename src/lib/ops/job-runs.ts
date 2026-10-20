/**
 * History of the scheduled jobs (job_runs), read by the ops alerts and the
 * system page. docker/backup.sh writes its own rows with psql, same shape.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export const JOB_RUN_KEEP_DAYS = 30

/** Runs fn, recording RUNNING → SUCCESS (with its result) or FAILURE (and rethrows). */
export async function recordJobRun<T>(job: string, fn: () => Promise<T>): Promise<T> {
  const run = await prisma.jobRun.create({ data: { job, status: 'RUNNING' } })
  try {
    const result = await fn()
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { status: 'SUCCESS', finishedAt: new Date(), summary: (result ?? null) as Prisma.InputJsonValue },
    })
    return result
  } catch (error) {
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { status: 'FAILURE', finishedAt: new Date(), error: String((error as Error)?.message ?? error).slice(0, 1000) },
    })
    throw error
  }
}

export async function pruneJobRuns(now = new Date()) {
  const { count } = await prisma.jobRun.deleteMany({
    where: { startedAt: { lt: new Date(now.getTime() - JOB_RUN_KEEP_DAYS * 24 * 60 * 60 * 1000) } },
  })
  return count
}
