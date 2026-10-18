(() => {
  const cfg = window.VELLIOR_SUPABASE_CONFIG, hero = document.querySelector('.hero');\n  const style=document.createElement('style');style.textContent='.hero-carousel-controls{position:absolute;z-index:2;right:28px;bottom:24px;display:flex;align-items:center;gap:14px}.hero-arrow{border:0;background:#ffffffd9;color:#303236;width:38px;height:38px;border-radius:50%;font:26px Georgia;line-height:1}.hero-dots{display:flex;gap:8px}.hero-dots button{width:8px;height:8px;border:1px solid #303236;border-radius:50%;padding:0;background:#fff9}.hero-dots button[aria-current=true]{background:#303236}.hero-image{transition:opacity .45s ease}.choice-group{border:1px solid #e5e6e8;padding:13px;margin:12px 0}.choice-label{font-size:12px;letter-spacing:.08em;margin-bottom:9px}.choice-chips{display:flex;flex-wrap:wrap;gap:8px}.choice-chip{border:1px solid #b7b7b7;background:#fffaf6;padding:8px 12px;border-radius:4px}.choice-chip[aria-pressed=true]{border-color:#303236;background:#e9e5e1;box-shadow:inset 0 0 0 1px #303236}.option-stock-note{font-size:11px;color:#777b80}.shipping-quote{border:1px solid #e5e6e8;padding:15px;margin:22px 0}.shipping-quote strong{display:block;font-weight:500;margin-bottom:10px}.shipping-form{display:flex;max-width:310px}.shipping-form input{height:42px;padding:0 12px;border:1px solid #d5d7da;min-width:0;flex:1}.shipping-form button{height:42px;padding:0 17px;border:1px solid #d5d7da;background:#fff}.shipping-quote .unavailable{font-size:12px;color:#777b80;margin:9px 0 0}@media(prefers-reduced-motion:reduce){.hero-image{transition:none}}';document.head.append(style);
  if (!hero) return;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let slides=[], current=0, timer=null;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const controls=document.createElement('div');controls.className='hero-carousel-controls';
  controls.innerHTML='<button type="button" class="hero-arrow hero-prev" aria-label="Imagem anterior">‹</button><div class="hero-dots" aria-label="Imagens da coleção"></div><button type="button" class="hero-arrow hero-next" aria-label="Próxima imagem">›</button>';
  hero.append(controls);const dots=controls.querySelector('.hero-dots');
  const apply=index=>{if(!slides.length)return;current=(index+slides.length)%slides.length;const s=slides[current],img=hero.querySelector('.hero-image');img.style.opacity='.25';const next=new Image();next.onload=()=>{img.src=s.image;img.alt=s.alt||s.title||'Coleção VELLIOR';requestAnimationFrame(()=>img.style.opacity='1')};next.onerror=()=>img.style.opacity='1';next.src=s.image;hero.querySelector('.eyebrow').textContent=s.eyebrow||'VELLIOR';hero.querySelector('h1').textContent=s.title||'Elegância em cada detalhe.';hero.querySelector('.hero-copy > p').textContent=s.description||'';const cta=hero.querySelector('.hero-actions a');cta.textContent=s.button||'Descobrir coleção';cta.href=s.href||'#catalogo';dots.querySelectorAll('button').forEach((b,i)=>{b.setAttribute('aria-current',String(i===current));b.setAttribute('aria-label','Exibir imagem '+(i+1))})};
  const restart=()=>{clearInterval(timer);if(!reduceMotion&&slides.length>1)timer=setInterval(()=>apply(current+1),8500)};
  controls.querySelector('.hero-prev').onclick=()=>{apply(current-1);restart()};controls.querySelector('.hero-next').onclick=()=>{apply(current+1);restart()};
  dots.addEventListener('click',e=>{const b=e.target.closest('button');if(b){apply([...dots.children].indexOf(b));restart()}});
  hero.addEventListener('mouseenter',()=>clearInterval(timer));hero.addEventListener('mouseleave',restart);hero.addEventListener('focusin',()=>clearInterval(timer));hero.addEventListener('focusout',restart);
  if(cfg?.url&&cfg?.publishableKey)import('https://esm.sh/@supabase/supabase-js@2.117.3').then(({createClient})=>createClient(cfg.url,cfg.publishableKey).from('store_settings').select('value').eq('key','home_carousel').maybeSingle()).then(({data})=>{if(Array.isArray(data?.value))slides=data.value.filter(s=>s&&typeof s.image==='string'&&s.image.startsWith('https://')).slice(0,8);if(!slides.length)return;dots.innerHTML=slides.map((_,i)=>'<button type="button" aria-label="Exibir imagem '+(i+1)+'"></button>').join('');apply(0);restart()}).catch(e=>console.warn('Carrossel indisponível; mantendo imagem padrão.',e));

  const commerce=window.VELLIOR_COMMERCE;
  if(commerce){
    const original=commerce.showProduct;
    commerce.showProduct=id=>{
      original(id);
      const p=commerce.products.find(x=>x.id===id),layer=document.querySelector('#viewLayer'),copy=layer?.querySelector('.detail-copy');
      if(!p||!copy)return;
      const options=Array.isArray(p.options)?p.options.filter(o=>o&&o.name&&Array.isArray(o.values)&&o.values.length):[];
      const selected={};
      const optionBox=document.createElement('div');optionBox.className='product-options';
      for(const group of options){const section=document.createElement('section');section.className='choice-group';const label=document.createElement('div');label.className='choice-label';label.textContent=group.name;section.append(label);const chips=document.createElement('div');chips.className='choice-chips';group.values.forEach((value,i)=>{const b=document.createElement('button');b.type='button';b.className='choice-chip';b.textContent=value;b.setAttribute('aria-pressed','false');b.onclick=()=>{selected[group.name]=value;chips.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)))};chips.append(b)});optionBox.append(section)}
      const stock=copy.querySelector('.detail-stock');if(options.length&&stock)stock.before(optionBox);
      const freight=document.createElement('section');freight.className='shipping-quote';freight.innerHTML='<strong>Meios de envio</strong><div class="shipping-form"><label class="sr-only" for="detailCep">Seu CEP</label><input id="detailCep" inputmode="numeric" maxlength="9" placeholder="Seu CEP"><button type="button" id="quoteUnavailable">Calcular</button></div><p class="unavailable" role="status">Cotação de frete temporariamente indisponível.</p>';
      const buy=copy.querySelector('.detail-buy');buy?.after(freight);
      freight.querySelector('#quoteUnavailable').onclick=()=>{freight.querySelector('.unavailable').textContent='A cotação automática ainda não está ativa. Consulte as opções de entrega no checkout.'};
      const add=copy.querySelector('#addDetail');
      if(add)add.onclick=()=>{if(options.some(g=>!selected[g.name])){toast('Selecione '+options.filter(g=>!selected[g.name]).map(g=>g.name).join(' e ')+'.');return}const qty=Number(layer.querySelector('#detailQty')?.textContent||1);commerce.addToCart(id,qty,selected);commerce.openBag()};
      if(options.length){const hint=document.createElement('p');hint.className='option-stock-note';hint.textContent='As opções usam o estoque total cadastrado para este produto.';optionBox.after(hint)}
    };
    if(location.hash.startsWith('#produto/'))commerce.showProduct(decodeURIComponent(location.hash.slice(9)));
  }
})();
