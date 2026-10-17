import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.3'
const origin='https://vellior.vercel.app'
const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return Response.json({error:'Método não permitido.'},{status:405,headers:cors})
  if(req.headers.get('origin')&&req.headers.get('origin')!==origin)return Response.json({error:'Origem não autorizada.'},{status:403,headers:cors})
  try{
    const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,auth=req.headers.get('authorization')
    if(!auth?.startsWith('Bearer '))return Response.json({error:'Sessão inválida.'},{status:401,headers:cors})
    const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}}),{data:{user}}=await userClient.auth.getUser()
    if(!user)return Response.json({error:'Sessão inválida.'},{status:401,headers:cors})
    const {data:role}=await userClient.from('user_roles').select('role').eq('user_id',user.id).maybeSingle()
    if(role?.role!=='admin')return Response.json({error:'Acesso não autorizado.'},{status:403,headers:cors})
    const body=await req.json(),admin=createClient(url,service,{auth:{persistSession:false}})
    if(body.action==='configure'){
      const token=String(body.accessToken||'').trim(),publicKey=String(body.publicKey||'').trim(),webhook=String(body.webhookSecret||'').trim()
      if(!token.startsWith('APP_USR-')&&!token.startsWith('TEST-'))return Response.json({error:'Access Token inválido; confira o formato no painel do Mercado Pago.'},{status:400,headers:cors})
      if(!/^APP_USR-[a-f0-9-]{20,}$/i.test(publicKey))return Response.json({error:'Public Key inválida.'},{status:400,headers:cors})
      const {error}=await userClient.rpc('set_vellior_secret',{p_name:'vellior_mp_access_token',p_value:token})
      if(error)return Response.json({error:'Não foi possível guardar o Access Token no Vault do Supabase.'},{status:500,headers:cors})
      if(webhook){const saved=await userClient.rpc('set_vellior_secret',{p_name:'vellior_mp_webhook_secret',p_value:webhook});if(saved.error)return Response.json({error:'Access Token salvo; não foi possível guardar a chave do webhook.'},{status:500,headers:cors})}
      const pref=await userClient.from('store_settings').upsert({key:'mp_public_key',value:publicKey,updated_at:new Date().toISOString()},{onConflict:'key'})
      if(pref.error)return Response.json({error:'Access Token salvo; falha ao salvar a Public Key.'},{status:500,headers:cors})
      return Response.json({ok:true,message:'Credenciais salvas no Vault. A cobrança continua desativada até publicar checkout, reservas de estoque e webhook verificado.'},{headers:cors})
    }
    if(body.action==='test'){
      const {data:token,error}=await admin.rpc('get_vellior_secret',{p_name:'vellior_mp_access_token'})
      if(error||!token)return Response.json({error:'Salve o Access Token antes de testar.'},{status:503,headers:cors})
      const response=await fetch('https://api.mercadopago.com/users/me',{headers:{Authorization:`Bearer ${token}`}})
      if(!response.ok)return Response.json({error:'Mercado Pago recusou o token. Verifique se ele está ativo e da conta correta.'},{status:502,headers:cors})
      return Response.json({ok:true,message:'Conexão válida com o Mercado Pago. Nenhuma cobrança foi criada.'},{headers:cors})
    }
    return Response.json({error:'Ação não reconhecida.'},{status:400,headers:cors})
  }catch(e){console.error('Mercado Pago admin error',e instanceof Error?e.name:'unknown');return Response.json({error:'Não foi possível processar a integração.'},{status:400,headers:cors})}
})

