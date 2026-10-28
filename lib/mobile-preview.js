import http from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {createApp} from '../server.js';
import {setSecurityHeaders} from './http-security.js';
export const privateIPv4 = host => /^(?:10\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/.test(host) && host.split('.').every(n=>Number(n)<=255);
const equal = (a,b) => typeof a==='string' && /^[a-f0-9]{48}$/.test(a) && a.length===b.length && timingSafeEqual(Buffer.from(a),Buffer.from(b));
// Separate adult-only demo: no .env, provider, disk progress or access to the main app.
export async function createMobilePreview({host='127.0.0.1',port=4176,lifetimeMs=1200000,now=Date.now}={}) {
 if(host!=='127.0.0.1'&&!privateIPv4(host))throw new Error('Use an explicit private IPv4 address.');
 const token=randomBytes(24).toString('hex');const expires=now()+lifetimeMs;
 const app=createApp({env:{},fetchImpl:()=>{throw new Error('Network provider disabled');}});
 await new Promise((resolve,reject)=>{app.once('error',reject);app.listen(0,'127.0.0.1',resolve);});
 let timer;const attempts=new Map();
 const gateway=http.createServer((req,res)=>{
  setSecurityHeaders(res);res.setHeader('Cache-Control','no-store');
  const deny=(status=403)=>{res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8'});res.end('Vista de prueba no disponible. Usa el enlace temporal del ordenador.');};
  const authority=`${host}:${gateway.address()?.port}`;
  if(now()>=expires)return deny(410);
  if(req.headers.host!==authority||req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin!==undefined&&req.headers.origin!==`http://${authority}`))return deny();
  if(!req.url?.startsWith('/')||req.url.startsWith('//'))return deny();
  const url=new URL(req.url,`http://${authority}`);
  if(req.method==='GET'&&url.pathname==='/entrar'){
   const ip=req.socket.remoteAddress;const count=attempts.get(ip)??0;
   if(count>=10)return deny(429);
   if(!equal(url.searchParams.get('codigo'),token)||[...url.searchParams.keys()].some(k=>k!=='codigo')||url.searchParams.getAll('codigo').length!==1){attempts.set(ip,count+1);return deny();}
   res.setHeader('Set-Cookie',`luma_preview=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.max(0,Math.floor((expires-now())/1000))}`);
   res.writeHead(303,{Location:'/'});res.end();return;
  }
  const cookies=(req.headers.cookie??'').split(';').map(s=>s.trim());const access=cookies.filter(s=>s.startsWith('luma_preview='));
  if(access.length!==1||!equal(access[0].slice(13),token))return deny();
  const upstreamAuthority=`127.0.0.1:${app.address().port}`;
  // Cookies span ports: namespace demo progress so loopback review cannot replace
  // the main application's device credential in the same browser.
  const headers={...req.headers,host:upstreamAuthority,cookie:cookies.filter(s=>s.startsWith('luma_demo_device=')).map(s=>s.replace(/^luma_demo_device=/,'luma_device=')).join('; ')};
  if(headers.origin!==undefined)headers.origin=`http://${upstreamAuthority}`;
  delete headers.forwarded;delete headers['x-forwarded-host'];delete headers['x-forwarded-for'];
  const proxy=http.request({hostname:'127.0.0.1',port:app.address().port,path:req.url,method:req.method,headers},upstream=>{
   const responseHeaders={...upstream.headers};
   if(responseHeaders['set-cookie'])responseHeaders['set-cookie']=responseHeaders['set-cookie'].map(c=>c.replace(/^luma_device=/,'luma_demo_device='));
   res.writeHead(upstream.statusCode,responseHeaders);upstream.pipe(res);
  });
  proxy.on('error',()=>{if(!res.headersSent)deny(502);else res.destroy();});req.on('aborted',()=>proxy.destroy());req.pipe(proxy);
 });
 const close=async()=>{clearTimeout(timer);gateway.closeAllConnections();app.closeAllConnections();await Promise.all([new Promise(r=>gateway.close(r)),new Promise(r=>app.close(r))]);};
 try{await new Promise((resolve,reject)=>{gateway.once('error',reject);gateway.listen(port,host,resolve);});}catch(error){await new Promise(r=>app.close(r));throw error;}
 timer=setTimeout(()=>{void close();},lifetimeMs);timer.unref();
 return {server:gateway,close,url:`http://${host}:${gateway.address().port}/entrar?codigo=${token}`,expires};
}
