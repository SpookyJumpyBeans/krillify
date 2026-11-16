const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Socket extends EventTarget {constructor(url){super();this.url=url} packet(value,type='message'){const e=new Event(type);e.data=JSON.stringify(value);this.dispatchEvent(e)}}
const messages=[],listeners={};
const w={WebSocket:Socket,EventSource:Socket,postMessage:x=>messages.push(JSON.parse(JSON.stringify(x))),addEventListener:(name,fn)=>listeners[name]=fn};
const location={origin:'https://krillion.io',href:'https://krillion.io/party/TEST'};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../extension/game-events.js'),'utf8'),{window:w,location,URL,Map,Proxy,Reflect});
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
console.log('PASS structured snapshots, patches, state replay, game resets, SSE, stale transport isolation, patch-gap fallback, and private-field filtering');
