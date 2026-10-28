import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';
import {createMobilePreview,privateIPv4} from '../lib/mobile-preview.js';
test('mobile demo is private-address-only and never accepts broad bind addresses',async()=>{
 for(const host of ['0.0.0.0','example.com','8.8.8.8','192.168.999.1','172.32.0.1'])assert.equal(privateIPv4(host),false);
 for(const host of ['10.1.2.3','192.168.1.10','172.16.0.5'])assert.equal(privateIPv4(host),true);
 await assert.rejects(createMobilePreview({host:'0.0.0.0'}));
});
test('mobile demo requires a temporary credential, exact origin, and keeps AI and progress isolated',async t=>{
 let time=1000;const preview=await createMobilePreview({port:0,now:()=>time});t.after(()=>preview.close());
 const base=new URL(preview.url).origin;
 assert.equal((await fetch(base+'/api/config')).status,403);
 assert.equal((await fetch(base+'/entrar?codigo=wrong')).status,403);
 const login=await fetch(preview.url,{redirect:'manual'});assert.equal(login.status,303);assert.equal(login.headers.get('location'),'/');
 const cookie=login.headers.get('set-cookie').split(';')[0];assert.match(login.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  const malformedCookie=await fetch(base+'/api/config',{headers:{Cookie:'luma_preview='+'ñ'.repeat(48)}});assert.equal(malformedCookie.status,403);
 const config=await (await fetch(base+'/api/config',{headers:{Cookie:cookie}})).json();assert.equal(config.aiAvailable,false);assert.equal(config.ai.calls,0);
 const progress=await (await fetch(base+'/api/progress',{headers:{Cookie:cookie}})).json();assert.equal(progress.enabled,false);assert.deepEqual(progress.history,[]);
  const enable=await fetch(base+'/api/progress/enable',{method:'POST',headers:{Cookie:cookie+'; luma_device='+'a'.repeat(64),'Content-Type':'application/json'},body:JSON.stringify({consent:true})});
  assert.equal(enable.status,200);assert.match(enable.headers.get('set-cookie'),/^luma_demo_device=/);assert.ok(!enable.headers.get('set-cookie').includes('luma_device='));
 assert.equal((await fetch(base+'/api/config',{headers:{Cookie:cookie,Origin:'http://foreign.example'}})).status,403);
 assert.equal((await fetch(base+'/api/config',{headers:{Cookie:cookie+'; '+cookie}})).status,403);
 const hostile=await new Promise(resolve=>{http.get(base+'/api/config',{headers:{Cookie:cookie,Host:'foreign.example'}},r=>{r.resume();resolve(r.statusCode);});});assert.equal(hostile,403);
 time=1201001;assert.equal((await fetch(base+'/api/config',{headers:{Cookie:cookie}})).status,410);
});
