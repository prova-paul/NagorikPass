// A recording stand-in for the Supabase client, for testing what a server action asks the database to do.
// `respond` says what the database answers to each query; every query and function call is recorded.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export interface Query {
  table: string
  /** The write or read the query ended up being. */
  kind: 'select' | 'insert' | 'update' | 'delete'
  payload?: unknown
  filters: [method: string, ...args: unknown[]][]
}

export type Answer = { data: unknown; error: { code?: string; message?: string; details?: string; name?: string } | null }

export interface FakeDbOptions {
  respond?: (query: Query) => Answer
  rpc?: (name: string, args: unknown) => Answer
  /** What a function call answers. Return { error } to simulate a failure. */
  invoke?: (name: string, options: { body?: unknown; headers?: Record<string, string> }) => { data?: unknown; error?: unknown }
  token?: string | null
}

export function fakeDb(options: FakeDbOptions = {}) {
  const queries: Query[] = []
  const rpcs: { name: string; args: unknown }[] = []
  const invocations: { name: string; body: unknown }[] = []
  const answer = (query: Query): Answer => options.respond?.(query) ?? { data: null, error: null }

  function from(table: string) {
    const query: Query = { table, kind: 'select', filters: [] }
    const record = () => {
      queries.push({ ...query, filters: [...query.filters] })
      return Promise.resolve(answer(query))
    }
    const builder: Record<string, unknown> = {
      insert: (payload: unknown) => ((query.kind = 'insert'), (query.payload = payload), builder),
      update: (payload: unknown) => ((query.kind = 'update'), (query.payload = payload), builder),
      delete: () => ((query.kind = 'delete'), builder),
      maybeSingle: record,
      single: record,
      then: (resolve: (value: Answer) => unknown, reject?: (reason: unknown) => unknown) => record().then(resolve, reject),
    }
    for (const method of ['select', 'eq', 'neq', 'in', 'is', 'not', 'or', 'filter', 'gt', 'gte', 'lt', 'lte', 'ilike', 'order', 'range', 'limit']) {
      builder[method] = (...args: unknown[]) => (query.filters.push([method, ...args]), builder)
    }
    return builder
  }

  const client = {
    from,
    rpc: (name: string, args: unknown) => {
      rpcs.push({ name, args })
      return Promise.resolve(options.rpc?.(name, args) ?? { data: null, error: null })
    },
    auth: { getSession: () => Promise.resolve({ data: { session: options.token === null ? null : { access_token: options.token ?? 'token-123' } } }) },
    functions: {
      invoke: (name: string, init: { body?: unknown; headers?: Record<string, string> }) => {
        invocations.push({ name, body: init.body })
        const reply = options.invoke?.(name, init) ?? { data: { status: 'invited' } }
        return Promise.resolve({ data: reply.data ?? null, error: reply.error ?? null })
      },
    },
  }
  return { client: client as unknown as SupabaseClient<Database>, queries, rpcs, invocations }
}

/** The error supabase-js raises when a function answers with a failure status. */
export function functionHttpError(status: number, body: unknown) {
  return { name: 'FunctionsHttpError', context: new Response(JSON.stringify(body), { status }) }
}
