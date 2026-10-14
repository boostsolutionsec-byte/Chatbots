const fs=require('fs');const src=fs.readFileSync(''+__dirname+'/nodo.js','utf8');
const T=require(__dirname+'/../tiendas.json').map(t=>({...t,marcas:(t.marcas||[]).join(',')}));
const run=(message)=>new Function('$','$input',src)(()=>({first:()=>({json:{message:{chat:{id:7},...message}}})}),{all:()=>T.map(j=>({json:j}))})[0].json;
for (const x of ["hola","donde compro posca en riobamba","soy de quito","vivo en loja","estoy en macas","cerca del mall del sol","qué posca uso para zapatillas","tengo un reclamo, el marcador vino seco","quiero ser distribuidor tengo una papeleria en ambato","cuanto cuesta el posca","quiero pintar una taza, soy de cuenca","👍","horario?","quiero hablar con una persona"]) { const r=run({text:x}); console.log('>>',x,'|',r.intencion,'|',(r.respuesta||'[IA] '+r.contexto).replace(/\n/g,' ⏎ ').slice(0,230)); }
const g=run({location:{latitude:-1.67,longitude:-78.65}}); console.log('>> GPS |',g.intencion,'|',g.respuesta.slice(0,120));
