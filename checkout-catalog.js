const cfg=window.VELLIOR_SUPABASE_CONFIG;
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
        const text=document.createElement('span');text.textContent=`${product.name}\nQtd. ${entry.quantity}`;
        const value=document.createElement('strong');value.textContent=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(price*entry.quantity);
        row.append(pic,text,value);host.append(row);
      }
      const amount=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(total);
      document.querySelector('#subtotal').textContent=amount;document.querySelector('#total').textContent=amount;
      if(!host.children.length)host.innerHTML='<div class="empty">Não há produtos publicados nesta sacola. <a href="index.html">Voltar à loja</a></div>';
    }
  }catch(error){console.error('Não foi possível carregar os itens do checkout:',error)}
}

