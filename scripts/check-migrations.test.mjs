import { describe, it, expect } from 'vitest'
import {
  checkMigrations,
  classifyMigrationChanges,
  findDestructiveOperations,
  hasDestructiveAck,
} from './check-migrations.mjs'

describe('findDestructiveOperations', () => {
  it('accepts purely additive SQL (what 0_init and most migrations contain)', () => {
    const sql = `
      CREATE TYPE "Role" AS ENUM ('A', 'B');
      CREATE TABLE "users" ("id" TEXT NOT NULL, CONSTRAINT "users_pkey" PRIMARY KEY ("id"));
      CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
      ALTER TABLE "users" ADD COLUMN "nickname" TEXT;
      ALTER TABLE "users" ADD COLUMN "score" INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE "a" ADD CONSTRAINT "a_b_fkey" FOREIGN KEY ("b") REFERENCES "b"("id");
      ALTER TYPE "Role" ADD VALUE 'C';
    `
    expect(findDestructiveOperations(sql)).toEqual([])
  })

  it.each([
    ['DROP TABLE', 'DROP TABLE "rooms";'],
    ['DROP COLUMN', 'ALTER TABLE "users" DROP COLUMN "phone";'],
    ['DROP TYPE', 'DROP TYPE "Role_old";'],
    ['TRUNCATE', 'TRUNCATE "payments";'],
    ['DELETE FROM', 'DELETE FROM "payments" WHERE 1=1;'],
    ['RENAME', 'ALTER TABLE "users" RENAME COLUMN "a" TO "b";'],
    ['RENAME', 'ALTER TYPE "Role" RENAME TO "Role_old";'],
    ['ALTER COLUMN ... TYPE', 'ALTER TABLE "p" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(65,30);'],
    ['ALTER COLUMN ... TYPE', 'ALTER TABLE "p" ALTER COLUMN "amount" TYPE INTEGER;'],
    ['SET NOT NULL', 'ALTER TABLE "users" ALTER COLUMN "phone" SET NOT NULL;'],
    ['ADD COLUMN ... NOT NULL without DEFAULT', 'ALTER TABLE "users" ADD COLUMN     "phone" TEXT NOT NULL;'],
  ])('flags %s', (name, sql) => {
    expect(findDestructiveOperations(sql)).toContain(name)
  })

  it('flags a NOT NULL column without default even when another column in the statement has one', () => {
    const sql = 'ALTER TABLE "u" ADD COLUMN "a" INTEGER NOT NULL DEFAULT 0,\nADD COLUMN "b" TEXT NOT NULL;'
    expect(findDestructiveOperations(sql)).toContain('ADD COLUMN ... NOT NULL without DEFAULT')
  })

  it('ignores destructive words inside comments', () => {
    expect(findDestructiveOperations('-- we do NOT DROP TABLE here\n/* DROP COLUMN */ SELECT 1;')).toEqual([])
  })
})

describe('hasDestructiveAck', () => {
  it('requires a reason after the marker', () => {
    expect(hasDestructiveAck('-- destructive-ok: column unused since PR #42\nDROP TABLE x;')).toBe(true)
    expect(hasDestructiveAck('-- destructive-ok:\nDROP TABLE x;')).toBe(false)
    expect(hasDestructiveAck('DROP TABLE x;')).toBe(false)
  })
})

describe('classifyMigrationChanges', () => {
  it('separates added files from changes to existing ones and ignores other paths', () => {
    const out = [
      'A\tprisma/migrations/20261020_add_phone/migration.sql',
      'M\tprisma/migrations/0_init/migration.sql',
      'D\tprisma/migrations/20261001_old/migration.sql',
      'M\tprisma/schema.prisma',
      '',
    ].join('\n')
    expect(classifyMigrationChanges(out)).toEqual({
      added: ['prisma/migrations/20261020_add_phone/migration.sql'],
      changedExisting: [
        { status: 'M', path: 'prisma/migrations/0_init/migration.sql' },
        { status: 'D', path: 'prisma/migrations/20261001_old/migration.sql' },
      ],
    })
  })
})

describe('checkMigrations', () => {
  const files = {
    'prisma/migrations/2_safe/migration.sql': 'ALTER TABLE "u" ADD COLUMN "nick" TEXT;',
    'prisma/migrations/3_drop/migration.sql': 'ALTER TABLE "u" DROP COLUMN "nick";',
    'prisma/migrations/4_drop_ok/migration.sql':
      '-- destructive-ok: nick never written in production (checked 2026-10-20)\nALTER TABLE "u" DROP COLUMN "nick";',
  }
  const readFile = (p) => files[p]

  it('passes for new additive migrations', () => {
    expect(checkMigrations({ nameStatusOutput: 'A\tprisma/migrations/2_safe/migration.sql', readFile })).toEqual([])
  })

  it('fails when an existing migration is modified', () => {
    const problems = checkMigrations({ nameStatusOutput: 'M\tprisma/migrations/0_init/migration.sql', readFile })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/append-only/)
  })

  describe('fixing a migration that failed in production', () => {
    const fixed = {
      ...files,
      'prisma/migrations/5_failed/migration.sql':
        '-- fixed-after-failed-deploy: deploy abc123 failed on a missing table, never applied\nSELECT 1;',
      'prisma/migrations/6_failed_drop/migration.sql':
        '-- fixed-after-failed-deploy: deploy abc123 failed, never applied\nALTER TABLE "u" DROP COLUMN "nick";',
      'prisma/migrations/7_marker_empty/migration.sql': '-- fixed-after-failed-deploy:\nSELECT 1;',
    }
    const read = (p) => fixed[p]

    it('allows modifying it in place when it carries the marker', () => {
      expect(checkMigrations({ nameStatusOutput: 'M\tprisma/migrations/5_failed/migration.sql', readFile: read })).toEqual(
        []
      )
    })

    it('still applies the destructive-SQL check to the fixed content', () => {
      const problems = checkMigrations({
        nameStatusOutput: 'M\tprisma/migrations/6_failed_drop/migration.sql',
        readFile: read,
      })
      expect(problems).toHaveLength(1)
      expect(problems[0]).toMatch(/DROP COLUMN/)
    })

    it('requires a reason on the marker line', () => {
      expect(
        checkMigrations({ nameStatusOutput: 'M\tprisma/migrations/7_marker_empty/migration.sql', readFile: read })[0]
      ).toMatch(/append-only/)
    })

    it('never allows deleting a migration, marker or not', () => {
      expect(
        checkMigrations({ nameStatusOutput: 'D\tprisma/migrations/5_failed/migration.sql', readFile: read })[0]
      ).toMatch(/append-only/)
    })
  })

  it('fails for unacknowledged destructive SQL and passes once acknowledged', () => {
    expect(checkMigrations({ nameStatusOutput: 'A\tprisma/migrations/3_drop/migration.sql', readFile })[0]).toMatch(
      /DROP COLUMN/
    )
    expect(checkMigrations({ nameStatusOutput: 'A\tprisma/migrations/4_drop_ok/migration.sql', readFile })).toEqual([])
  })
})
