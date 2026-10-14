import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.3'

const allowedOrigin = 'https://vellior.vercel.app'
const cors = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  if (origin && origin !== allowedOrigin) return Response.json({ error: 'Origem não autorizada.' }, { status: 403 })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return Response.json({ error: 'Método não permitido.' }, { status: 405, headers: cors })

  try {
    const body = await req.json()
    const action = body?.action
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authorization = req.headers.get('authorization')
    if (!authorization?.startsWith('Bearer ')) return Response.json({ error: 'Sessão inválida.' }, { status: 401, headers: cors })

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user?.email) return Response.json({ error: 'Sessão inválida.' }, { status: 401, headers: cors })
    const { data: role, error: roleError } = await userClient.from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
    if (roleError || role?.role !== 'admin') return Response.json({ error: 'Acesso não autorizado.' }, { status: 403, headers: cors })

    if (action === 'configure') {
      const key = String(body?.apiKey || '').trim()
      if (!key.startsWith('re_') || key.length > 512) return Response.json({ error: 'Confira a chave de API do Resend.' }, { status: 400, headers: cors })
      const { error } = await userClient.rpc('set_vellior_secret', { p_name: 'vellior_resend_api_key', p_value: key })
      if (error) return Response.json({ error: 'Não foi possível guardar a chave no Vault. Confirme a configuração segura do banco.' }, { status: 500, headers: cors })
      return Response.json({ ok: true, message: 'Chave guardada no Vault do Supabase.' }, { headers: cors })
    }

    if (action !== 'test') return Response.json({ error: 'Ação não reconhecida.' }, { status: 400, headers: cors })
    const privileged = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: stored, error: vaultError } = await privileged.rpc('get_vellior_secret', { p_name: 'vellior_resend_api_key' })
    const apiKey = stored || Deno.env.get('RESEND_API_KEY')
    if (vaultError && !Deno.env.get('RESEND_API_KEY')) return Response.json({ error: 'A chave Resend ainda não está configurada.' }, { status: 503, headers: cors })
    if (!apiKey) return Response.json({ error: 'A chave Resend ainda não está configurada.' }, { status: 503, headers: cors })

    const from = Deno.env.get('RESEND_FROM_EMAIL') || 'VELLIOR <onboarding@resend.dev>'
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `vellior-test-${user.id}-${crypto.randomUUID()}` },
      body: JSON.stringify({ from, to: [user.email], subject: 'Teste de e-mail — VELLIOR', html: '<div style="font-family:Arial,sans-serif;color:#303236"><h1 style="font-family:Georgia,serif;font-weight:400">VELLIOR</h1><p>Seu envio de teste do Resend está funcionando.</p><p>Elegância em cada detalhe.</p></div>' }),
    })
    if (!response.ok) {
      const providerError = await response.json().catch(() => ({}))
      console.error('Resend test failed', response.status, providerError?.name || 'provider_error')
      return Response.json({ error: 'O Resend recusou o teste. Verifique a chave e o domínio remetente autorizado.' }, { status: 502, headers: cors })
    }
    return Response.json({ ok: true, message: `E-mail de teste enviado para ${user.email}.` }, { headers: cors })
  } catch {
    return Response.json({ error: 'Não foi possível concluir a operação de e-mail.' }, { status: 400, headers: cors })
  }
})

