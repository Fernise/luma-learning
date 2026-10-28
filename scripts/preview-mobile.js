import {networkInterfaces} from 'node:os';
import {createMobilePreview,privateIPv4} from '../lib/mobile-preview.js';
if(process.argv.includes('--help')){console.log('npm run preview:mobile -- --host=IP_PRIVADA_WIFI\nSin --host solo funciona en este ordenador. Enlace temporal 20 minutos; demo sin API ni datos reales.');process.exit(0);}
const host=process.argv.find(a=>a.startsWith('--host='))?.slice(7)??'127.0.0.1';
if(host!=='127.0.0.1'&&(!privateIPv4(host)||!Object.values(networkInterfaces()).flat().some(i=>i?.address===host&&!i.internal)))throw new Error('Elige una IPv4 privada de la Wi-Fi de este ordenador con --host=...');
const preview=await createMobilePreview({host});
console.log('Demo para adultos con ejemplos ficticios, sin IA ni datos del servidor principal. Caduca en 20 minutos.');
console.log(host==='127.0.0.1'?'Solo en este ordenador. Para móvil añade --host=IP_PRIVADA_WIFI.':'Abre este enlace solo en tu móvil conectado a la misma Wi-Fi:');
console.log(preview.url);
process.on('SIGINT',async()=>{await preview.close();process.exit(0);});
