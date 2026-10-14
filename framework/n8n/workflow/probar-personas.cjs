const fs=require('fs'),path=require('path');
const YAML=require('/home/user/Chatbots/framework/node_modules/yaml');
const src=fs.readFileSync('/home/user/Chatbots/framework/n8n/workflow/nodo.js','utf8');
const T=require('/home/user/Chatbots/framework/n8n/tiendas.json').map(t=>({...t,tienda_id:t.id}));
const memo={};
const run=(m,chat)=>new Function('$','$input','$getWorkflowStaticData',src)(()=>({first:()=>({json:{message:{chat:{id:chat},...m}}})}),{all:()=>T.map(j=>({json:j}))},()=>memo)[0].json;
const km=(a,b,c,d)=>{const r=Math.PI/180,x=Math.sin((c-a)*r/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin((d-b)*r/2)**2;return 6371*2*Math.asin(Math.sqrt(x));};
const dir='/home/user/Chatbots/validacion/personas'; const stats={}; const malos=[];
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.yaml'))){
  const ps=YAML.parse(fs.readFileSync(path.join(dir,f),'utf8'))||[];
  for(const p of ps){ if(!p.guion) continue;
    const chat=p.id; const out=[];
    for(const g of p.guion){ const m=g==="[UBICACION]"?{location:{latitude:p.ubicacion.lat,longitude:p.ubicacion.lng}}:typeof g==="string"?{text:g}:(g.ubicacion?{location:{latitude:g.ubicacion.lat,longitude:g.ubicacion.lng}}:{text:g.texto||g.usuario||JSON.stringify(g)}); out.push(run(m,chat)); }
    const e=p.espera||{}; const dest=String(e.destino||e.deriva_a||'');
    let veredicto;
    const tiendaDada=out.find(o=>o.intencion==='donde_compro');
    const deriv=out.map(o=>o.derivar).filter(Boolean);
    if(/tienda/.test(dest)&&p.ubicacion&&p.ubicacion.lat!=null){
      const best=T.map(t=>({t,d:km(p.ubicacion.lat,p.ubicacion.lng,t.lat,t.lng)})).sort((a,b)=>a.d-b.d)[0].t;
      if(tiendaDada) veredicto=tiendaDada.respuesta.includes(best.nombre)||tiendaDada.respuesta.includes(best.whatsapp)?'OK':'TIENDA_DISTINTA';
      else veredicto=out.some(o=>o.intencion==='ia'&&/TIENDAS \(/.test(o.contexto))?'IA_con_tienda':'SIN_TIENDA';
    } else if(/reclam|distrib|asesor|humano/.test(dest)) veredicto=deriv.length?(deriv.some(d=>dest.includes(d.split('_')[0]))?'OK':'DERIVA_OTRO:'+deriv[0]):'NO_DERIVA';
    else veredicto='IA/otro('+dest+')';
    stats[veredicto.split(':')[0]]=(stats[veredicto.split(':')[0]]||0)+1;
    if(!/^OK|IA/.test(veredicto)) malos.push(`${veredicto} | ${p.id} | esperado ${dest} | ${p.guion.map(g=>typeof g==='string'?g:JSON.stringify(g)).join(' / ').slice(0,140)} → ${out.map(o=>o.intencion).join(',')}`);
  }
}
console.log(stats); console.log(malos.join('\n'));
