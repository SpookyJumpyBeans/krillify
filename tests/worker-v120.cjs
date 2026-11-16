const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
(async()=>{
 const base=require('node:path').join(__dirname,'../extension/');const core=await import(pathToFileURL(require('node:path').resolve(base+'core.js')));const bankMod=await import(pathToFileURL(require('node:path').resolve(base+'bank.js')));const promptMod=await import(pathToFileURL(require('node:path').resolve(base+'prompt.js')));
 let listener,fetches=0,mode='retry';const reads=[],data={settings:{enabled:true,apiKey:'test-key',model:'test'},games:{},pools:{}};
 const sandbox={...core,...bankMod,...promptMod,console,AbortController,setTimeout,clearTimeout,fetch:async url=>{if(String(url).startsWith('chrome-extension://'))return {ok:true,json:async()=>({})};fetches++;if(mode==='auth')return {ok:false,status:401,json:async()=>({})};if(fetches===1)return {ok:false,status:503,json:async()=>({})};return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({answers:['Alpha','Beta','Gamma']})}}]})}},chrome:{runtime:{getURL:p=>'chrome-extension://test/'+p,getManifest:()=>({version:'1.2.0'}),onMessage:{addListener:fn=>listener=fn}},storage:{local:{setAccessLevel:async()=>{},get:async keys=>{reads.push(keys);return Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,structuredClone(data[k])]))},set:async x=>Object.assign(data,structuredClone(x))}}}};
 vm.runInNewContext(fs.readFileSync(base+'background.js','utf8').replace(/^import .*;\r?\n/gm,''),sandbox);
 const send=m=>new Promise(r=>listener(m,{tab:{id:1},url:'https://krillion.io/party/TEST'},r));
 assert.equal((await send({type:'status'})).version,'1.2.0');assert.deepEqual(reads,['settings']);
 let result=await send({type:'suggest',game:'TEST:1',prompt:'Name an insect'});assert.equal(result.answers.length,3);assert.equal(fetches,0);assert.match(result.source,/unverified/);
 result=await send({type:'suggest',game:'TEST:1',prompt:'Uncached prompt'});assert.equal(result.answers.length,3);assert.equal(fetches,2);
 mode='auth';fetches=0;result=await send({type:'suggest',game:'TEST:1',prompt:'Other uncached prompt'});assert.match(result.error,/key rejected/);assert.equal(fetches,1);
 console.log('PASS lightweight status reads, key-free starter bank, exactly one fast 503 retry, and no automatic authentication retry');
})().catch(e=>{console.error(e);process.exitCode=1});
