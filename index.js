const json = (data, status=200) => new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json; charset=utf-8'}});
const auth = (req, env) => {
  const h = req.headers.get('Authorization') || '';
  if (!h.startsWith('Basic ')) return false;
  try { const [u,p] = atob(h.slice(6)).split(':'); return u === env.ADMIN_USER && p === env.ADMIN_PASSWORD; } catch { return false; }
};
const needAuth = () => new Response('Unauthorized', {status:401, headers:{'WWW-Authenticate':'Basic realm="Popion Admin"'}});
async function products(env){ return (await env.DB.prepare('SELECT * FROM products ORDER BY id').all()).results; }
async function seed(env){
  const count=(await env.DB.prepare('SELECT COUNT(*) c FROM products').first()).c;
  if(Number(count)) return;
  const data=await (await env.ASSETS.fetch(new Request(new URL('/products.json', 'https://popion.local')))).text();
  const rows=JSON.parse(data);
  for(const p of rows) await env.DB.prepare('INSERT OR IGNORE INTO products(id,name,price,image,stock) VALUES(?,?,?,?,?)').bind(p.id,p.name,p.price,p.image,p.stock).run();
}
export default { async fetch(req, env){
  const url=new URL(req.url);
  if(url.pathname.startsWith('/api/')){
    await seed(env);
    if(req.method==='GET' && url.pathname==='/api/products') return json(await products(env));
    if(req.method==='POST' && url.pathname==='/api/orders'){
      try{
        const {name,phone,address,items}=await req.json();
        if(!name||!phone||!address||!Array.isArray(items)||!items.length) return json({error:'اطلاعات سفارش کامل نیست'},400);
        const ps=await products(env), map=new Map(ps.map(p=>[Number(p.id),p])); const clean=[];
        for(const x of items){ const p=map.get(Number(x.id)); const q=Math.max(1,Math.min(99,Number(x.qty)||1)); if(!p) throw Error('محصول نامعتبر است'); if(q>p.stock) throw Error(`موجودی ${p.name} کافی نیست`); clean.push({id:p.id,name:p.name,price:p.price,qty:q,image:p.image}); }
        const total=clean.reduce((s,x)=>s+x.price*x.qty,0);
        const r=await env.DB.prepare('INSERT INTO orders(customer_name,phone,address,items,total) VALUES(?,?,?,?,?)').bind(name,phone,address,JSON.stringify(clean),total).run();
        for(const x of clean) await env.DB.prepare('UPDATE products SET stock=stock-? WHERE id=?').bind(x.qty,x.id).run();
        return json({orderId:r.meta.last_row_id,message:'سفارش ثبت شد. برای پرداخت با فروشگاه هماهنگ کنید.'});
      }catch(e){ return json({error:e.message},400); }
    }
    if(url.pathname.startsWith('/api/order/')){ const id=url.pathname.split('/').pop(); const o=await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(id).first(); if(!o)return json({error:'سفارش پیدا نشد'},404); o.items=JSON.parse(o.items); return json(o); }
    if(url.pathname==='/api/admin/login' && req.method==='POST'){
      const b=await req.json(); return b.user===env.ADMIN_USER&&b.password===env.ADMIN_PASSWORD ? json({ok:true}) : json({error:'ورود ناموفق'},401);
    }
    if(!auth(req,env)) return needAuth();
    if(url.pathname==='/api/admin/products') return json(await products(env));
    if(url.pathname.startsWith('/api/admin/products/') && req.method==='PATCH'){
      const id=url.pathname.split('/').pop(), b=await req.json(); const price=Math.max(0,Number(b.price)||0), stock=Math.max(0,Number(b.stock)||0); await env.DB.prepare('UPDATE products SET price=?,stock=? WHERE id=?').bind(price,stock,id).run(); return json(await env.DB.prepare('SELECT * FROM products WHERE id=?').bind(id).first());
    }
    if(url.pathname==='/api/admin/orders') { const os=(await env.DB.prepare('SELECT * FROM orders ORDER BY id DESC').all()).results.map(o=>({...o,items:JSON.parse(o.items)})); return json(os); }
    if(url.pathname.startsWith('/api/admin/orders/') && req.method==='PATCH'){
      const id=url.pathname.split('/').pop(), {status}=await req.json(); if(!['pending','confirmed','shipped','delivered','cancelled'].includes(status)) return json({error:'status نامعتبر'},400); await env.DB.prepare('UPDATE orders SET status=? WHERE id=?').bind(status,id).run(); return json({ok:true});
    }
  }
  return env.ASSETS.fetch(req);
}};
