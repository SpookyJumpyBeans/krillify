const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
(async()=>{
 const base=path.join(__dirname,'../extension/');
 const mods=await Promise.all(['core.js','bank.js','prompt.js'].map(f=>import(pathToFileURL(path.resolve(base+f)))));
 function load(data){
  const opened=[];let onInstalled,listener;
  const sandbox={...mods[0],...mods[1],...mods[2],console,AbortController,setTimeout,clearTimeout,
   fetch:async()=>({ok:true,json:async()=>({})}),
   chrome:{tabs:{create:async o=>opened.push(o.url)},
    runtime:{getURL:p=>'chrome-extension://k/'+p,getManifest:()=>({version:'x'}),onMessage:{addListener:fn=>listener=fn},onInstalled:{addListener:fn=>onInstalled=fn}},
    storage:{local:{setAccessLevel:async()=>{},get:async keys=>Object.fromEntries([].concat(keys).map(k=>[k,structuredClone(data[k])])),set:async x=>Object.assign(data,structuredClone(x))}}}};
  vm.runInNewContext(fs.readFileSync(base+'background.js','utf8').replace(/^import .*;\r?\n/gm,''),sandbox);
  const status=()=>new Promise(r=>listener({type:'status'},{tab:{id:1},url:'https://krillion.io/party/T'},r));
  return {opened,onInstalled,status};
 }
 // Fresh install: suggestions on, Settings opens with the welcome note.
 let data={};let w=load(data);
 assert.equal((await w.status()).enabled,true,'on by default before anything is saved');
 await w.onInstalled({reason:'install'});
 assert.deepEqual(data.settings,{enabled:true,model:'gpt-4.1-mini',apiKey:''});
 assert.deepEqual(w.opened,['chrome-extension://k/options.html#welcome']);
 // Update: settings untouched, no tab.
 data={settings:{enabled:false,model:'m',apiKey:'k'}};w=load(data);
 await w.onInstalled({reason:'update'});
 assert.deepEqual(data.settings,{enabled:false,model:'m',apiKey:'k'});assert.equal(w.opened.length,0);
 assert.equal((await w.status()).enabled,false,'a user who turned it off stays off');
 // Reinstall over saved settings keeps them.
 data={settings:{enabled:false,model:'m',apiKey:''}};w=load(data);
 await w.onInstalled({reason:'install'});
 assert.equal(data.settings.enabled,false);
 console.log('PASS on by default, welcome tab on install only, saved settings never overwritten');
})().catch(e=>{console.error(e);process.exitCode=1});
