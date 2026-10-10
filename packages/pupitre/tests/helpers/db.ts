import { mkdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Database } from '@adonisjs/lucid/database'
import { BaseModel } from '@adonisjs/lucid/orm'
import Post from '../fixtures/models/post.js'
import Category from '../fixtures/models/category.js'
import User from '../fixtures/models/user.js'
import { up as migrate } from '../fixtures/migrations/001_tables.js'

const silentLogger = {
  trace() {},
  debug() {},
  info() {},
  warn() {},
  error() {},
  fatal() {},
}
const emitter = { hasListeners: () => false, emit() {} }
let database: Database | undefined
let databaseSetup: Promise<Database> | undefined
let sqlitePath: string | undefined
export async function migrateDatabase(db: Database) {
  await migrate(db)
}

export function setupDatabase() {
  if (database) return Promise.resolve(database)
  if (databaseSetup) return databaseSetup
  databaseSetup = initializeDatabase().catch((error: unknown) => {
    databaseSetup = undefined
    throw error
  })
  return databaseSetup
}

async function initializeDatabase() {
  if (process.env.DB === 'pg') {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is required when DB=pg')
    database = new Database(
      {
        connection: 'pg',
        connections: { pg: { client: 'pg', connection: url } },
      },
      silentLogger as never,
      emitter as never
    )
  } else {
    const tmpDir = join(import.meta.dirname, '..', '..', 'tmp')
    await mkdir(tmpDir, { recursive: true })
    sqlitePath = join(tmpDir, `pupitre-test-${randomUUID()}.sqlite`)
    database = new Database(
      {
        connection: 'sqlite',
        connections: {
          sqlite: {
            client: 'better-sqlite3',
            connection: { filename: sqlitePath },
            useNullAsDefault: true,
          },
        },
      },
      silentLogger as never,
      emitter as never
    )
  }

  BaseModel.useAdapter(database.modelAdapter())
  await migrateDatabase(database)
  return database
}

export async function truncate() {
  const db = await setupDatabase()
  for (const table of ['posts', 'categories', 'users']) {
    await db.connection().from(table).del()
  }
}

export async function seed(data: {
  users?: Partial<User>[]
  categories?: Partial<Category>[]
  posts?: Partial<Post>[]
}) {
  await setupDatabase()
  const users = await User.createMany(data.users ?? [])
  const categories = await Category.createMany(data.categories ?? [])
  const posts = await Post.createMany(data.posts ?? [])
  return { users, categories, posts }
}

export async function teardown() {
  if (database) await database.manager.closeAll(true)
  if (sqlitePath) await unlink(sqlitePath).catch(() => {})
  sqlitePath = undefined
  database = undefined
  databaseSetup = undefined
  BaseModel.useAdapter(undefined as never)
}

export { Post, Category, User }
