const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
(async()=>{
 const base=path.join(__dirname,'../extension/');
 const mods=await Promise.all(['core.js','bank.js','prompt.js'].map(f=>import(pathToFileURL(path.resolve(base+f)))));
 const {gameExamples}=mods[2];
 // Examples: verified answers rarest first with their tier, misses listed separately, unverified left out.
 assert.deepEqual(gameExamples([{answer:'Cow',tier:'plankton'},{answer:'Dexter cow',tier:'miss'},'Llama',{answer:'Zebu',tier:'deepcut'},{answer:'Yak',tier:'accepted'}]),
  {accepted:[{answer:'Zebu',tier:'deepcut'},{answer:'Yak',tier:'accepted'},{answer:'Cow',tier:'plankton'}],rejected:['Dexter cow']});
 // The worker sends the shared system prompt and the game's results for the prompt.
 let sent;
 const data={settings:{enabled:true,apiKey:'k',model:'m'},games:{},pools:{},
  verified:{'q:nameafarmanimal':{prompt:'Name a farm animal',answers:{cow:{answer:'Cow',tier:'plankton'},dextercow:{answer:'Dexter cow',tier:'miss'}}}}};
 const fetch=async(url,init)=>{
  if(String(url).startsWith('chrome-extension://'))return {ok:true,json:async()=>({'Name a farm animal':['Dexter cow','Cow','Llama']})};
  sent=JSON.parse(init.body);
  return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({answers:['Alpaca','Goose','Donkey']})}}]})};
 };
 let listener;
 const sandbox={...mods[0],...mods[1],...mods[2],console,AbortController,setTimeout,clearTimeout,fetch,
  chrome:{runtime:{getURL:p=>'chrome-extension://t/'+p,getManifest:()=>({version:'x'}),onMessage:{addListener:fn=>listener=fn}},
   storage:{local:{setAccessLevel:async()=>{},get:async keys=>Object.fromEntries([].concat(keys).map(k=>[k,structuredClone(data[k])])),set:async x=>Object.assign(data,structuredClone(x))}}}};
 vm.runInNewContext(fs.readFileSync(base+'background.js','utf8').replace(/^import .*;\r?\n/gm,''),sandbox);
 const send=m=>new Promise(r=>listener(m,{tab:{id:1},url:'https://krillion.io/party/T'},r));
 const result=await send({type:'suggest',game:'T:1',prompt:'Name a farm animal',excluded:['Cow','Llama']});
 assert(sent,'the AI was called once the bank ran out');
 assert.equal(sent.messages[0].content,mods[2].answerSystemPrompt);
 const user=JSON.parse(sent.messages[1].content);
 assert.equal(user.prompt,'Name a farm animal');
 assert.deepEqual(user.accepted_examples,[{answer:'Cow',tier:'plankton'}]);
 assert.deepEqual(user.rejected_examples,['Dexter cow']);
 assert(user.excluded.includes('Dexter cow')&&user.excluded.includes('Llama'));
 assert(result.answers.every(x=>['Alpaca','Goose','Donkey'].includes(x.answer)));
 console.log('PASS game examples (rarest first, misses separate) and the grounded prompt sent to the AI');
})().catch(e=>{console.error(e);process.exitCode=1});
