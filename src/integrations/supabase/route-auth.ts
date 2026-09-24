// Autenticação de rotas HTTP (`server.handlers`), onde o middleware de server
// functions (`requireSupabaseAuth`) não se aplica. Mesmo padrão: Bearer JWT do
// Supabase, validado com `auth.getClaims`; devolve os claims ou uma resposta 401.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

type RouteAuth =
  | { ok: true; userId: string; claims: Record<string, unknown> }
  | { ok: false; response: Response };

const deny = (message: string): RouteAuth => ({
  ok: false,
  response: new Response(message, { status: 401 }),
});

export async function requireRouteUser(request: Request): Promise<RouteAuth> {
  const SUPABASE_URL = process.env['SUPABASE_URL'];
  const SUPABASE_PUBLISHABLE_KEY = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return { ok: false, response: new Response('Server configuration error', { status: 500 }) };
  }

  const authHeader = request.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return deny('Unauthorized: Only Bearer tokens are supported');
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token || token.split('.').length !== 3) return deny('Unauthorized: Invalid token');

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return deny('Unauthorized: Invalid token');

  return { ok: true, userId: data.claims.sub, claims: data.claims as Record<string, unknown> };
}
