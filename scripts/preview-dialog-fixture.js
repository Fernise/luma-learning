import {createApp} from '../server.js';

// Isolated memory-only UI checks. No .env, external provider or learner data.
const delay=Number(process.argv.find(a=>a.startsWith('--delay-settings-config='))?.split('=')[1]??0);
if(!Number.isInteger(delay)||delay<0||delay>5000)throw new Error('Invalid fixture delay');
const saveDelay=Number(process.argv.find(a=>a.startsWith('--delay-settings-save='))?.split('=')[1]??0);
if(!Number.isInteger(saveDelay)||saveDelay<0||saveDelay>5000)throw new Error('Invalid fixture save delay');
const saveSucceeds=process.argv.includes('--save-succeeds');
const simulatedAI=process.argv.includes('--simulate-ai');
const server=createApp({env:simulatedAI?{OPENAI_API_KEY:'simulated-dialog-only',OPENAI_MODEL:'simulated'}:{},fetchImpl:async()=>{throw new Error('No provider requests in dialog fixture');}}),handle=server.listeners('request')[0];
server.removeAllListeners('request');let configs=0,failedSave=false;
server.on('request',(req,res)=>{
 if(req.method==='GET'&&req.url==='/api/config'){
  configs++;
  if(configs>1&&delay){setTimeout(()=>handle(req,res),delay);return;}
 }
 if(req.method==='POST'&&req.url==='/api/progress/enable'){
  if(!saveSucceeds&&!failedSave){
   failedSave=true;req.resume();setTimeout(()=>{res.writeHead(503,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
   res.end(JSON.stringify({error:'Prueba local: guardado temporalmente no disponible.'}));},saveDelay);return;
  }
  if(saveDelay){setTimeout(()=>handle(req,res),saveDelay);return;}
 }
 handle(req,res);
});
server.listen(4174,'127.0.0.1',()=>console.log(`Dialog fixture: http://localhost:4174 · memory only · ${simulatedAI?'simulated AI settings, network blocked':'AI disabled'} · save delay ${saveDelay}ms · ${saveSucceeds?'save succeeds':'first enable fails without commit'}`));
