// Small helpers shared by the Edge Functions. Nothing here is specific to Deno.

// The browser app calls these functions from another origin, so they answer the preflight request.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export interface Reply {
  status: number
  body: Record<string, unknown>
}

export function json(reply: Reply): Response {
  return new Response(JSON.stringify(reply.body), {
    status: reply.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The same pattern the database uses for employee emails.
export const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export type Role = 'admin' | 'receptionist' | 'employee'
