const MODEL = "@cf/black-forest-labs/flux-2-klein-4b";
const ALLOWED_ORIGINS = new Set(["https://pedrinhoolindio-alt.github.io"]);
const MAX_PROMPT_LENGTH = 7000;
const MAX_BODY_BYTES = 7 * 1024 * 1024;
const FORMATS = { story:[768,1344], feed:[1024,1280], square:[1024,1024], landscape:[1344,768] };
function corsHeaders(origin){return {"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Access-Control-Max-Age":"86400","Vary":"Origin"}}
function json(data,status,origin){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...corsHeaders(origin)}})}
function decodeDataUrl(value){
 if(typeof value!=="string")return null;
 const m=value.match(/^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/i);
 if(!m)throw new Error("Referência inválida. Use PNG, JPG ou WebP.");
 const bin=atob(m[2]); if(bin.length>512*1024)throw new Error("Cada referência deve ter no máximo 512 KB.");
 const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
 const ext=m[1].toLowerCase()==="jpg"?"jpeg":m[1].toLowerCase();
 return new File([bytes],"reference."+ext,{type:"image/"+ext});
}
export default {async fetch(request,env){
 const origin=request.headers.get("Origin")||"";
 if(!ALLOWED_ORIGINS.has(origin))return new Response("Forbidden origin",{status:403});
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:corsHeaders(origin)});
 if(request.method!=="POST")return json({error:"Method not allowed"},405,origin);
 if(!env.AI)return json({error:"Workers AI binding 'AI' is not configured."},503,origin);
 if(env.FLUX_RATE_LIMIT){const ip=request.headers.get("CF-Connecting-IP")||"unknown";const {success}=await env.FLUX_RATE_LIMIT.limit({key:"flux:"+ip});if(!success)return json({error:"Limite temporário de gerações atingido."},429,origin)}
 if(Number(request.headers.get("Content-Length")||0)>MAX_BODY_BYTES)return json({error:"As referências ultrapassam o limite de 7 MB."},413,origin);
 let body;try{body=await request.json()}catch{return json({error:"JSON inválido."},400,origin)}
 const prompt=typeof body.prompt==="string"?body.prompt.trim():"";
 if(!prompt||prompt.length>MAX_PROMPT_LENGTH)return json({error:"O prompt deve ter entre 1 e 7000 caracteres."},400,origin);
 const [width,height]=FORMATS[body.format]||FORMATS.story;
 try{
  const form=new FormData();form.append("prompt",prompt);form.append("width",String(width));form.append("height",String(height));
  if(Number.isInteger(body.seed)&&body.seed>=0)form.append("seed",String(body.seed));
  const refs=Array.isArray(body.references)?body.references.slice(0,4):[];
  for(let i=0;i<refs.length;i++){const file=decodeDataUrl(refs[i]);if(file)form.append("input_image_"+i,file,file.name)}
  const serialized=new Response(form);
  const result=await env.AI.run(MODEL,{multipart:{body:serialized.body,contentType:serialized.headers.get("content-type")}});
  if(!result||typeof result.image!=="string"||!result.image.length)return json({error:"O modelo não retornou imagem."},502,origin);
  return json({image:"data:image/jpeg;base64,"+result.image,model:MODEL,width,height,referencesUsed:refs.length},200,origin);
 }catch(error){
  const msg=String(error?.message||error);const quota=/limit|quota|neuron|exceed|billing/i.test(msg);
  return json({error:quota?"Limite diário ou saldo de Workers AI atingido. Confira o consumo no painel Cloudflare.":"Falha na geração: "+msg.slice(0,260)},quota?429:502,origin);
 }
}};
