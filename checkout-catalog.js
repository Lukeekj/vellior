const cfg=window.VELLIOR_SUPABASE_CONFIG;
// A checkout sempre oferece retorno à sacola, inclusive em telas pequenas.
const back=document.createElement('a');back.href='index.html';back.textContent='← Voltar à loja e à sacola';back.style='display:block;max-width:1120px;margin:20px auto 0;padding:0 24px;font-size:12px';document.querySelector('main.layout')?.before(back);
const shippingNote=document.createElement('p');shippingNote.textContent='Origem do envio: Atibaia/SP · CEP 12949-052. O endereço é preenchido pelo CEP; a cotação dos Correios será ativada após configurar as credenciais do serviço.';shippingNote.style='font-size:12px;line-height:1.6;color:#707277';document.querySelector('.summary .notice')?.before(shippingNote);
// Consulta de CEP: busca somente dados postais públicos; número/complemento continuam manuais.
const cep=document.querySelector('#cep');
if(cep){let lastCep='';const lookup=async()=>{const digits=cep.value.replace(/\D/g,'');if(digits.length!==8||digits===lastCep)return;lastCep=digits;cep.setCustomValidity('');try{const response=await fetch(`https://viacep.com.br/ws/${digits}/json/`);if(!response.ok)throw Error();const address=await response.json();if(address.erro)throw Error();for(const [id,value] of [['street',address.logradouro],['district',address.bairro],['city',address.localidade],['state',address.uf]]){const input=document.getElementById(id);if(input&&value)input.value=value}document.querySelector('#number')?.focus()}catch{lastCep='';cep.setCustomValidity('CEP não localizado. Confira ou preencha o endereço manualmente.');cep.reportValidity()}};cep.addEventListener('input',()=>{const digits=cep.value.replace(/\D/g,'').slice(0,8);cep.value=digits.length>5?`${digits.slice(0,5)}-${digits.slice(5)}`:digits});cep.addEventListener('blur',lookup)}
if(cfg?.url&&cfg?.publishableKey){
  try{
    const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.117.3');
    const db=createClient(cfg.url,cfg.publishableKey);
    const cart=JSON.parse(localStorage.getItem('vellior_cart')||'[]').filter(item=>/^[0-9a-f-]{36}$/i.test(item.id));
    if(cart.length){
      const ids=cart.map(item=>item.id);
      const {data:products,error}=await db.from('products').select('id,name,price_cents,sale_price_cents,product_images(storage_path,alt_text,sort_order)').in('id',ids).eq('published',true);
      if(error)throw error;
      const byId=new Map((products||[]).map(p=>[p.id,p]));
      const host=document.querySelector('#items');let total=0;host.replaceChildren();
      for(const entry of cart){
        const product=byId.get(entry.id);if(!product)continue;
        const price=(product.sale_price_cents??product.price_cents)/100;total+=price*entry.quantity;
        const row=document.createElement('div');row.className='item';
        const pic=document.createElement('img');pic.alt='';
        const photo=(product.product_images||[]).sort((a,b)=>a.sort_order-b.sort_order)[0];
        pic.src=photo?.storage_path?db.storage.from('product-images').getPublicUrl(photo.storage_path).data.publicUrl:'assets/hero-product.jpg';
        pic.onerror=()=>pic.src='assets/hero-product.jpg';
        const text=document.createElement('span');const picked=Object.entries(entry.options||{}).map(([k,v])=>k+': '+v).join(' · ');text.textContent=`${product.name}${picked?'\n'+picked:''}\nQtd. ${entry.quantity}`;
        const value=document.createElement('strong');value.textContent=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(price*entry.quantity);
        const remove=document.createElement('button');remove.type='button';remove.textContent='Remover';remove.setAttribute('aria-label',`Remover ${product.name}`);remove.addEventListener('click',()=>{const next=JSON.parse(localStorage.getItem('vellior_cart')||'[]').filter((item,index)=>index!==cart.indexOf(entry));localStorage.setItem('vellior_cart',JSON.stringify(next));location.reload()});
        row.append(pic,text,value,remove);host.append(row);
      }
      const amount=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(total);
      document.querySelector('#subtotal').textContent=amount;document.querySelector('#total').textContent=amount;
      if(!host.children.length)host.innerHTML='<div class="empty">Não há produtos publicados nesta sacola. <a href="index.html">Voltar à loja</a></div>';
    }
  }catch(error){console.error('Não foi possível carregar os itens do checkout:',error)}
}

