const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const base=path.join(__dirname,'../extension/');
 const core=await import(pathToFileURL(path.resolve(base+'core.js')));const bankMod=await import(pathToFileURL(path.resolve(base+'bank.js')));
 const {takeThree,cleanCandidates}=core,{combinePool,mergeBank,serializeBank,indexBank}=bankMod;

 // Random picks stay inside the rarest six and keep bank order.
 const list=['A','B','C','D','E','F','G','H'];
 for(const r of [0,0.5,0.99]){const picks=takeThree(list,[],[],3,()=>r);assert(picks.length<=3&&picks.every(x=>list.slice(0,6).includes(x.answer)));}
 let i=0;const seq=[0.9,0.1,0.5];assert.deepEqual(takeThree(list,[],[],3,()=>seq[i++]).map(x=>x.answer),['B','E','F']);

 // Verified tiers reorder the pool: rare finds rise, common ones sink, the rest keep their order.
 const seen={prompt:'Name a fish',answers:{cod:{answer:'Cod',tier:'plankton'},oarfish:{answer:'Oarfish',tier:'deepcut'},ide:{answer:'Ide',tier:''}}};
 assert.deepEqual(combinePool([['Cod','Burbot','Oarfish','Wels']],seen).map(x=>x.answer+(x.tier?':'+x.tier:'')),['Oarfish:deepcut','Ide:accepted','Burbot','Wels','Cod:plankton']);
 assert.deepEqual(cleanCandidates([{answer:'X',tier:'Deep Cut'},{answer:'Y',tier:'bogus'}]).map(x=>x.tier),['deepcut',undefined]);

 // Merging local AI results and verified answers into the committed bank.
 const remote={'Name a fish':[{answer:'Burbot',note:'Freshwater cod'}]};
 const pools={'q:nameafish':{prompt:'Name a fish',source:'AI estimate',answers:[{answer:'Burbot',aliases:['Eelpout']},{answer:'Wels',aliases:['Wels catfish']}]},
  'q:imported':{prompt:'Imported',source:'imported bank',answers:['Skip me']}};
 const merged=mergeBank(remote,pools,{'q:nameafish':seen});
 assert.deepEqual(Object.keys(merged.bank),['Name a fish']);
 assert.deepEqual(merged.bank['Name a fish'].map(x=>x.answer),['Oarfish','Ide','Burbot','Wels','Cod']);
 assert.deepEqual(merged.bank['Name a fish'][2].aliases,['Eelpout']);assert.equal(merged.bank['Name a fish'][2].note,'Freshwater cod');
 assert.equal(merged.prompts,0);assert.equal(merged.answers,4);
 const text=serializeBank(merged.bank);assert.deepEqual(indexBank(JSON.parse(text)).get('nameafish').answers.map(x=>x.answer),['Oarfish','Ide','Burbot','Wels','Cod']);
 assert.equal(serializeBank(mergeBank(JSON.parse(text),pools,{'q:nameafish':seen}).bank),text,'a second merge is a no-op');

 // Worker: shared bank without a key, recording, and the maintainer sync.
 const shared={'Name a fish':[{answer:'Oarfish',tier:'deepcut'},'Burbot','Wels']};
 const data={settings:{enabled:true,apiKey:''},games:{},pools:{},maintainer:{enabled:false}};
 const gh={refs:{main:'abc'},file:null,puts:[],calls:[]};
 const json=(status,body)=>({ok:status<300,status,json:async()=>body,text:async()=>JSON.stringify(body)});
 const fetch=async(url,init={})=>{
  url=String(url);if(url.startsWith('chrome-extension://'))return json(200,shared);
  assert.equal(init.headers.Authorization,'Bearer tok');gh.calls.push((init.method||'GET')+' '+url.replace('https://api.github.com/repos/me/krillify',''));
  const p=url.replace('https://api.github.com/repos/me/krillify','');
  if(p==='')return json(200,{default_branch:'main'});
  let m=p.match(/^\/git\/ref\/heads\/(.+)$/);if(m)return gh.refs[m[1]]?json(200,{object:{sha:gh.refs[m[1]]}}):json(404,{});
  if(p==='/git/refs'){const b=JSON.parse(init.body);gh.refs[b.ref.replace('refs/heads/','')]=b.sha;return json(201,{});}
  if(p.startsWith('/contents/extension/banks.json')){
   if(init.method==='PUT'){const b=JSON.parse(init.body);gh.puts.push(b);gh.file={sha:'s'+gh.puts.length,content:b.content};return json(200,{});}
   return gh.file?json(200,{sha:gh.file.sha,encoding:'base64',content:gh.file.content}):json(404,{});
  }
  throw new Error('unexpected '+p);
 };
 let listener;
 const sandbox={...core,...bankMod,console,AbortController,setTimeout,clearTimeout,fetch,TextEncoder,TextDecoder,atob,btoa,
  chrome:{permissions:{contains:async()=>true},runtime:{getURL:p=>'chrome-extension://test/'+p,getManifest:()=>({version:'1.3.0'}),onMessage:{addListener:fn=>listener=fn}},
   storage:{local:{setAccessLevel:async()=>{},get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,structuredClone(data[k])])),set:async x=>Object.assign(data,structuredClone(x))}}}};
 vm.runInNewContext(fs.readFileSync(base+'background.js','utf8').replace(/^import .*;\r?\n/gm,''),sandbox);
 const tab={tab:{id:1},url:'https://krillion.io/party/TEST'},page={url:'chrome-extension://test/options.html'};
 const send=(m,from=tab)=>new Promise(r=>listener(m,from,r));

 let result=await send({type:'suggest',game:'TEST:1',prompt:'name a FISH!'});
 assert.equal(result.source,'Shared bank');assert.deepEqual(result.answers.map(x=>x.answer).sort(),['Burbot','Oarfish','Wels']);

 await send({type:'record',prompt:'Name a fish',answers:[{answer:'Oarfish',tier:'krillion'},{answer:'Cod',tier:'plankton'},{answer:'',tier:'rare'}]});
 await send({type:'record',prompt:'Name a fish',answers:[{answer:'oarfish',tier:''}]});
 assert.deepEqual(data.verified['q:nameafish'].answers,{oarfish:{answer:'Oarfish',tier:'krillion',n:2},cod:{answer:'Cod',tier:'plankton',n:1}});

 assert.equal((await send({type:'sync'})).skipped,'Maintainer mode is off.');assert.equal(gh.calls.length,0);
 assert.match((await send({type:'sync',force:true})).error,/Unrecognized sender/);

 data.maintainer={enabled:true,repo:'me/krillify',branch:'bank-updates',token:'tok'};
 data.pools={'q:nameabird':{prompt:'Name a bird',source:'AI estimate',answers:['Hoatzin','Kakapo']}};
 result=await send({type:'sync'});
 assert.match(result.result,/Committed to bank-updates: Update answer bank: 2 new prompts, 4 new answers/);
 assert.equal(gh.refs['bank-updates'],'abc');assert.equal(gh.puts.length,1);assert.equal(gh.puts[0].branch,'bank-updates');assert.equal(gh.puts[0].sha,undefined);
 const committed=JSON.parse(Buffer.from(gh.puts[0].content,'base64').toString('utf8'));
 assert.deepEqual(committed,{'Name a bird':[{answer:'Hoatzin'},{answer:'Kakapo'}],'Name a fish':[{answer:'Oarfish',tier:'krillion'},{answer:'Cod',tier:'plankton'}]});

 assert.match((await send({type:'sync'})).skipped,/less than a minute/,'game-over syncs are rate limited');
 result=await send({type:'sync',force:true},page);assert.equal(result.result,'Already up to date.');assert.equal(gh.puts.length,1);

 data.verified['q:nameafish'].answers.ide={answer:'Ide',tier:'rare'};
 result=await send({type:'sync',force:true},page);assert.equal(gh.puts.length,2);assert.equal(gh.puts[1].sha,'s1');
 assert.match(result.result,/1 new answer\b/);

 gh.file=null;data.maintainer.token='bad';
 result=await send({type:'sync',force:true},page);assert(result.error);assert.equal(data.syncState.failed,true);
 console.log('PASS random picks within the rarest six, tier ranking, bank merge and stable serialization, shared bank without a key, verified-answer recording, and maintainer sync (branch creation, commit, no-op, update with sha, rate limit, sender checks, failure state)');
})().catch(e=>{console.error(e);process.exitCode=1});
