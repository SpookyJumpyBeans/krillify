const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
(async()=>{
 const base=require('node:path').join(__dirname,'../extension/');const core=await import(pathToFileURL(require('node:path').resolve(base+'core.js')));const bankMod=await import(pathToFileURL(require('node:path').resolve(base+'bank.js')));const promptMod=await import(pathToFileURL(require('node:path').resolve(base+'prompt.js')));
 let listener,fetches=0,fail=false;const data={settings:{enabled:true,apiKey:'test-key',model:'test'},games:{},pools:{'q:shortprompt':{answers:['One','Two'],source:'cache'}}};
 const fetch=async url=>{if(String(url).startsWith('chrome-extension://'))return {ok:true,json:async()=>({})};fetches++;if(fail)return {ok:false,status:401,json:async()=>({})};return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({answers:['Three','Four','Five']})}}]})}};
 const sandbox={...core,...bankMod,...promptMod,console,AbortController,setTimeout,clearTimeout,fetch,chrome:{runtime:{getURL:p=>'chrome-extension://test/'+p,getManifest:()=>({version:'1.2.1'}),onMessage:{addListener:fn=>listener=fn}},storage:{local:{setAccessLevel:async()=>{},get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,structuredClone(data[k])])),set:async x=>Object.assign(data,structuredClone(x))}}}};
 vm.runInNewContext(fs.readFileSync(base+'background.js','utf8').replace(/^import .*;\r?\n/gm,''),sandbox);
 const send=m=>new Promise(r=>listener(m,{tab:{id:1},url:'https://krillion.io/party/TEST'},r));
 // One free slot: exactly one answer, none of the cards already on screen.
 let result=await send({type:'suggest',game:'TEST:1',prompt:'Name an insect',want:1,topUp:true,excluded:['Zorapteran','Grylloblattid']});
 assert.equal(result.answers.length,1);assert(['Strepsipteran','Webspinner','Snakefly','Alderfly','Dobsonfly','Scorpionfly'].includes(result.answers[0].answer));assert.equal(fetches,0);
 // New prompt with a short cache: show the partial batch now and flag that a top-up can help.
 result=await send({type:'suggest',game:'TEST:1',prompt:'Short prompt'});
 assert.deepEqual(result.answers.map(x=>x.answer),['One','Two']);assert.equal(result.more,true);assert.equal(fetches,0);
 // The top-up asks the AI for the missing slot.
 result=await send({type:'suggest',game:'TEST:1',prompt:'Short prompt',want:1,topUp:true,excluded:['One','Two']});
 assert.equal(result.answers.length,1);assert(['Three','Four','Five'].includes(result.answers[0].answer));assert.equal(fetches,1);assert.equal(result.more,false);
 // A failed top-up still returns what the cache has instead of an error.
 fail=true;data.pools['q:otherprompt']={answers:['Solo'],source:'cache'};
 result=await send({type:'suggest',game:'TEST:1',prompt:'Other prompt',want:3,topUp:true});
 assert.deepEqual(result.answers.map(x=>x.answer),['Solo']);assert.equal(result.error,undefined);
 console.log('PASS slot-sized requests, partial batch with top-up flag, AI top-up for a free slot, and cached fallback when a top-up fails');
})().catch(e=>{console.error(e);process.exitCode=1});
