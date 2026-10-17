import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.3'

const site = 'https://vellior.vercel.app'
const cors = { 'Access-Control-Allow-Origin': site, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' }
const html = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))

Deno.serve(async req => {
  if (req.method === 'GET' && new URL(req.url).pathname.endsWith('/unsubscribe')) {
    const token = new URL(req.url).searchParams.get('token') || ''
    if (!/^[0-9a-f-]{36}$/i.test(token)) return new Response('Link inválido.', { status:400, headers:{'Content-Type':'text/plain; charset=utf-8'} })
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth:{persistSession:false} })
    const { data, error } = await admin.rpc('newsletter_unsubscribe', { p_token:token })
    return new Response(error ? 'Não foi possível cancelar agora. Tente novamente.' : data ? 'Sua inscrição foi cancelada.' : 'Este link já foi utilizado ou não é válido.', { status:error?500:200, headers:{'Content-Type':'text/plain; charset=utf-8'} })
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return Response.json({ error: 'Método não permitido.' }, { status: 405, headers: cors })
  const origin = req.headers.get('origin')
  if (origin && origin !== site) return Response.json({ error: 'Origem não autorizada.' }, { status: 403, headers: cors })
  try {
    const body = await req.json()
    const url = Deno.env.get('SUPABASE_URL')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!, service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(url, service, { auth: { persistSession: false } })
    const secret = async (name: string) => (await admin.rpc('get_vellior_secret', { p_name: name })).data as string | null
    const key = await secret('vellior_resend_api_key')
    const from = await secret('vellior_resend_from_email')
    if (!key || !from) return Response.json({ error: 'E-mail indisponível: configure a chave Resend e um remetente de domínio verificado.' }, { status: 503, headers: cors })
    const send = async (to: string, subject: string, content: string, idempotency: string) => fetch('https://api.resend.com/emails', { method:'POST', headers:{ Authorization:`Bearer ${key}`, 'Content-Type':'application/json', 'Idempotency-Key':idempotency }, body:JSON.stringify({ from, to:[to], subject, html:content }) })
    if (body.action === 'subscribe') {
      const email = String(body.email || '').trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || body.website) return Response.json({ ok:true, message:'Se o endereço for válido, você receberá um e-mail de confirmação.' }, { headers:cors })
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
      const { data: allowed, error: rateError } = await admin.rpc('newsletter_rate_limit', { p_ip: ip })
      if (rateError || !allowed) return Response.json({ error:'Muitas tentativas. Aguarde alguns minutos.' }, { status:429, headers:cors })
      const { data: existing, error: lookupError } = await admin.from('newsletter_subscribers').select('id,status,unsubscribe_token').eq('email',email).maybeSingle()
      if (lookupError) throw lookupError
      let subscriber=existing, shouldSend=false
      if (!existing) {
        const created=await admin.from('newsletter_subscribers').insert({email,status:'active',consent_at:new Date().toISOString()}).select('id,unsubscribe_token').single()
        if (created.error) throw created.error
        subscriber=created.data; shouldSend=true
      } else if (existing.status==='unsubscribed') {
        const resumed=await admin.from('newsletter_subscribers').update({status:'active',consent_at:new Date().toISOString(),unsubscribe_token:crypto.randomUUID()}).eq('id',existing.id).select('id,unsubscribe_token').single()
        if (resumed.error) throw resumed.error
        subscriber=resumed.data; shouldSend=true
      }
      if (subscriber && shouldSend) {
        const result = await send(email,'Bem-vindo às novidades VELLIOR','<div style="font-family:Arial;color:#303236"><h1 style="font-family:Georgia">VELLIOR</h1><p>Seu e-mail foi inscrito para receber lançamentos e novidades da VELLIOR.</p><p>Elegância em cada detalhe.</p><p><a href="'+site+'/functions/v1/newsletter/unsubscribe?token='+subscriber.unsubscribe_token+'">Cancelar inscrição</a></p></div>','vellior-welcome-'+subscriber.id)
        if (!result.ok) console.error('Newsletter welcome email provider error',result.status)
        await admin.from('newsletter_events').insert({ subscriber_id:subscriber.id, event:result.ok?'welcome_sent':'send_failed' })
      }
      return Response.json({ ok:true, message:'Cadastro recebido. Confira seu e-mail para as novidades VELLIOR.' }, { headers:cors })
    }
    if (body.action === 'unsubscribe') {
      const token = String(body.token || '')
      if (!/^[0-9a-f-]{36}$/i.test(token)) return Response.json({ ok:true })
      await admin.rpc('newsletter_unsubscribe', { p_token:token })
      return Response.json({ ok:true, message:'Inscrição cancelada.' }, { headers:cors })
    }
    const authorization = req.headers.get('authorization')
    if (!authorization?.startsWith('Bearer ')) return Response.json({ error:'Sessão inválida.' }, { status:401, headers:cors })
    const userClient = createClient(url,anon,{global:{headers:{Authorization:authorization}}})
    const {data:{user}} = await userClient.auth.getUser()
    if (!user) return Response.json({error:'Sessão inválida.'},{status:401,headers:cors})
    const {data:role} = await userClient.from('user_roles').select('role').eq('user_id',user.id).maybeSingle()
    if (role?.role !== 'admin') return Response.json({error:'Acesso não autorizado.'},{status:403,headers:cors})
    if (body.action !== 'send_campaign' || typeof body.campaignId !== 'string') return Response.json({error:'Ação inválida.'},{status:400,headers:cors})
    const {data:campaign,error:campaignError} = await admin.from('newsletter_campaigns').select('id,subject,body,image_url,status').eq('id',body.campaignId).single()
    if (campaignError || !campaign || campaign.status === 'sent' || campaign.status === 'sending') return Response.json({error:'Novidade inexistente ou já processada.'},{status:409,headers:cors})
    await admin.from('newsletter_campaigns').update({status:'sending',created_by:user.id}).eq('id',campaign.id)
    const {data:recipients,error:recipientError} = await admin.from('newsletter_subscribers').select('id,email,unsubscribe_token').eq('status','active').limit(1000)
    if (recipientError) throw recipientError
    let sent=0,failed=0
    for (const recipient of recipients||[]) {
      const image = campaign.image_url && /^https:\/\//i.test(campaign.image_url) ? `<img src="${html(campaign.image_url)}" alt="" style="max-width:100%;height:auto">` : ''
      const content = `<div style="font-family:Arial;color:#303236;max-width:620px;margin:auto"><h1 style="font-family:Georgia">VELLIOR</h1>${image}<h2>${html(campaign.subject)}</h2><p style="white-space:pre-wrap">${html(campaign.body)}</p><p>Elegância em cada detalhe.</p><a href="${site}/functions/v1/newsletter/unsubscribe?token=${recipient.unsubscribe_token}">Cancelar inscrição</a></div>`
      const result=await send(recipient.email,campaign.subject,content,`vellior-campaign-${campaign.id}-${recipient.id}`)
      const event=result.ok?'campaign_sent':'send_failed'; if(result.ok)sent++;else failed++
      await admin.from('newsletter_events').insert({campaign_id:campaign.id,subscriber_id:recipient.id,event})
    }
    await admin.from('newsletter_campaigns').update({status:failed?'failed':'sent',recipient_count:sent,sent_at:new Date().toISOString()}).eq('id',campaign.id)
    return Response.json({ok:failed===0,message:`Enviados: ${sent}; falhas: ${failed}.`},{headers:cors})
  } catch (error) {
    console.error('newsletter function failed', error instanceof Error ? error.name : 'unknown')
    return Response.json({error:'Não foi possível processar a solicitação.'},{status:400,headers:cors})
  }
})

