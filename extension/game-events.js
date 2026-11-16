(() => {
  'use strict';
  // Independent read-only adapter. Never sends game actions or forwards credentials/chat.
  const channel = 'krillify-game-v1';
  const socketType = window.WebSocket;
  const streamType = window.EventSource;
  let owner = null, state = null, identity = '', used = new Map();
  const publish = () => window.postMessage({channel, room: {
    game: identity, phase: state.phase, prompt: state.category?.text || '',
    category: state.category?.index || 0, answers: [...used.values()].slice(-2500)
  }}, location.origin);
  function ingest(packet, token, code, snapshot = false) {
    if (owner !== token) return;
    if (snapshot || packet.t === 'snap') state = snapshot ? packet : packet.room;
    else if (packet.t === 'patch' && state) {
      const p = packet.patch;
      if (!p || p.base !== state.version) { state = null; window.postMessage({channel, disconnected:true}, location.origin); return; }
      state = {...state, ...p.set, version:p.v, events:p.eventsAll || [...(state.events || []), ...(p.events || [])]};
      if (Number.isInteger(p.eventsLength) && p.eventsLength >= 0) state.events = p.eventsLength ? state.events.slice(-p.eventsLength) : [];
    } else return;
    if (!state || !Array.isArray(state.events)) return;
    const next = code + ':' + (state.gameId || state.gameNumber || 0);
    if (next !== identity) { identity = next; used.clear(); }
    let start = 0;
    for (let i=0;i<state.events.length;i++) if (['start','lobby'].includes(state.events[i].kind)) start=i+1;
    for (const event of state.events.slice(start)) {
      if (event.kind === 'pass' && typeof event.answer === 'string' && event.answer.length <= 120) {
        used.set(event.answer.toLowerCase(), {answer:event.answer, tier:typeof event.tier === 'string' ? event.tier : ''});
      }
    }
    publish();
  }
  function attach(socket, code, eventName, snapshot) {
    const token = {};
    owner = token; state = null; identity = ''; used = new Map();
    socket.addEventListener(eventName, event => {
      try { ingest(JSON.parse(String(event.data)), token, code, snapshot); } catch {}
    });
    socket.addEventListener('close', () => { if (owner === token) window.postMessage({channel, disconnected:true}, location.origin); });
  }
  window.addEventListener('message', event => {
    if (event.source === window && event.origin === location.origin && event.data?.channel === 'krillify-request-state' && state) publish();
  });
  if (socketType) window.WebSocket = new Proxy(socketType, {construct(Target,args,NewTarget) {
    const socket = Reflect.construct(Target,args,NewTarget);
    try { const url = new URL(String(args[0]),location.href); const match = url.pathname.match(/^\/rooms\/([^/]+)\/ws$/);
      if (url.protocol === 'wss:' && url.hostname === 'party.krillion.io' && match) attach(socket,match[1],'message',false);
    } catch {} return socket;
  }});
  if (streamType) window.EventSource = new Proxy(streamType, {construct(Target,args,NewTarget) {
    const stream = Reflect.construct(Target,args,NewTarget);
    try { const url = new URL(String(args[0]),location.href); const match = url.pathname.match(/^\/api\/party\/([^/]+)\/stream$/);
      if (url.origin === location.origin && match) attach(stream,match[1],'room',true);
    } catch {} return stream;
  }});
})();
