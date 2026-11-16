const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Socket extends EventTarget {constructor(url){super();this.url=url} packet(value,type='message'){const e=new Event(type);e.data=JSON.stringify(value);this.dispatchEvent(e)}}
const messages=[],listeners={},box={value:''};
const w={WebSocket:Socket,EventSource:Socket,postMessage:x=>messages.push(JSON.parse(JSON.stringify(x))),addEventListener:(name,fn)=>listeners[name]=fn};
const location={origin:'https://krillion.io',href:'https://krillion.io/party/TEST'};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../extension/game-events.js'),'utf8'),{window:w,location,URL,Map,Proxy,Reflect,document:{querySelector:()=>box}});
const last=()=>messages.at(-1);
new w.WebSocket('wss://unrelated.example/rooms/TEST/ws').packet({t:'snap',room:{}});assert.equal(messages.length,0);
const s=new w.WebSocket('wss://party.krillion.io/rooms/TEST/ws');
const room={version:1,gameNumber:1,phase:'round',category:{text:'Name a thing',index:0},events:[{kind:'pass',answer:'Old game'},{kind:'start'},{kind:'pass',answer:'Alpha',tier:'rare'},{kind:'chat',answer:'secret chat'},{kind:'no',answer:'Reject'}],secret:'credential'};
s.packet({t:'snap',room});assert.deepEqual(last().room.answers.map(x=>x.answer),['Alpha']);assert(!JSON.stringify(last()).includes('credential'));assert(!JSON.stringify(last()).includes('secret chat'));
s.packet({t:'patch',patch:{base:1,v:2,set:{category:{text:'Other prompt',index:1}},events:[{kind:'pass',answer:'Beta'}]}});assert.equal(last().room.prompt,'Other prompt');assert.deepEqual(last().room.answers.map(x=>x.answer),['Alpha','Beta']);
listeners.message({source:w,origin:location.origin,data:{channel:'krillify-request-state'}});assert.equal(last().room.prompt,'Other prompt');
s.packet({t:'snap',room:{...room,version:3,gameNumber:2,events:[{kind:'start'}]}});assert.equal(last().room.game,'TEST:2');assert.equal(last().room.answers.length,0);
s.packet({t:'patch',patch:{base:999,v:4}});assert.equal(last().disconnected,true);
const stream=new w.EventSource('https://krillion.io/api/party/TEST/stream');stream.packet({...room,gameNumber:3},'room');assert.equal(last().room.game,'TEST:3');
const n=messages.length;s.packet({t:'snap',room});assert.equal(messages.length,n);
// Category tagging: each answer gets the text of the category it was given under, once seen.
const t=new w.WebSocket('wss://party.krillion.io/rooms/CAT/ws');
t.packet({t:'snap',room:{version:1,gameNumber:1,phase:'round',category:{text:'First',index:1},events:[{kind:'pass',answer:'Before start'},{kind:'start'},{kind:'category',index:1,why:'start'},{kind:'pass',answer:'Ant',tier:'rare'}]}});
t.packet({t:'patch',patch:{base:1,v:2,set:{category:{text:'Second',index:2}},events:[{kind:'reject',playerId:'p1',text:'Antt',why:'repeat'},{kind:'category',index:2,why:'cleared'},{kind:'pass',answer:'Bee',tier:'plankton'},{kind:'reject',playerId:'p2',text:'Bogus',why:'miss'},{kind:'chat',text:'hi'}]}});
assert.deepEqual(last().room.answers,[{answer:'Ant',tier:'rare',prompt:'First',mine:false},{answer:'Bee',tier:'plankton',prompt:'Second',mine:false}]);
assert.deepEqual(last().room.rejects,[{text:'Antt',why:'repeat',prompt:'First'},{text:'Bogus',why:'miss',prompt:'Second'}]);
assert(!JSON.stringify(last()).includes('p2'),'player ids are not forwarded');
const u=new w.WebSocket('wss://party.krillion.io/rooms/LATE/ws');
u.packet({t:'snap',room:{version:1,gameNumber:1,phase:'round',category:{text:'Now',index:3},events:[{kind:'start'},{kind:'category',index:2,why:'start'},{kind:'pass',answer:'Old'},{kind:'category',index:3,why:'cleared'},{kind:'pass',answer:'New'}]}});
assert.deepEqual(last().room.answers.map(x=>x.prompt),['','Now'],'a category this tab never saw stays untagged');
// "mine": the player whose typing preview matches this tab's answer box.
const v=new w.WebSocket('wss://party.krillion.io/rooms/ME/ws');box.value='Gyeran-jjim';
v.packet({t:'snap',room:{version:1,gameNumber:1,phase:'round',category:{text:'Name an egg dish',index:1},players:[{id:'p1',typing:'gyeran-jjim'},{id:'p2',typing:'omel'}],events:[{kind:'start'},{kind:'category',index:1,why:'start'}]}});
v.packet({t:'patch',patch:{base:1,v:2,set:{players:[{id:'p1',typing:null},{id:'p2',typing:null}]},events:[{kind:'pass',from:'p1',to:'p2',answer:'Korean steamed eggs',tier:'rare'},{kind:'pass',from:'p2',to:'p1',answer:'Omelette',tier:'plankton'}]}});
assert.deepEqual(last().room.answers.map(x=>x.answer+':'+x.mine),['Korean steamed eggs:true','Omelette:false']);
assert(!JSON.stringify(last()).includes('p1'),'player ids are not forwarded');
box.value='';
console.log('PASS structured snapshots, patches, state replay, game resets, SSE, stale transport isolation, patch-gap fallback, and private-field filtering, category tagging of accepted and rejected answers, own-answer detection');
