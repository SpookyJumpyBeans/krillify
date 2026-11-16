(() => {
  'use strict';
  // Independent read-only adapter. Never sends game actions or forwards credentials/chat.
  const channel = 'krillify-game-v1';
  const socketType = window.WebSocket;
  const streamType = window.EventSource;
  let owner = null, state = null, identity = '', used = new Map(), rejects = new Map(), titles = new Map(), me = null;
  const publish = () => window.postMessage({channel, room: {
    game: identity, phase: state.phase, prompt: state.category?.text || '',
    category: state.category?.index || 0, answers: [...used.values()].slice(-2500), rejects: [...rejects.values()].slice(-500)
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
    if (next !== identity) { identity = next; used.clear(); rejects.clear(); titles.clear(); }
    // The game broadcasts each player's typing preview (first 40 characters). Whoever's preview
    // matches this tab's answer box is this player, so their accepted answers can be marked
    // "mine". Player ids stay inside this script; only the yes/no flag is forwarded.
    try {
      const typed = document.querySelector('.pf-root input.ds-input')?.value?.trim().toLowerCase().slice(0, 40);
      const matches = typed && typed.length >= 3 && Array.isArray(state.players) ? state.players.filter(p => typeof p?.typing === 'string' && p.typing.trim().toLowerCase().slice(0, 40) === typed) : [];
      if (matches.length === 1 && matches[0].id != null) me = matches[0].id;
    } catch {}
    // Category events carry only an index, so remember each index's text while it's on screen.
    const shown = state.category;
    if (Number.isInteger(shown?.index) && typeof shown.text === 'string' && shown.text.trim()) titles.set(shown.index, shown.text.trim().slice(0, 500));
    let start = 0;
    for (let i=0;i<state.events.length;i++) if (['start','lobby'].includes(state.events[i].kind)) start=i+1;
    // Each answer belongs to the category of the latest category event before it. Its prompt is
    // '' when that category's text was never seen (e.g. it ended before this tab joined).
    let index = null;
    for (const event of state.events.slice(start)) {
      if (event.kind === 'category' && Number.isInteger(event.index)) index = event.index;
      const prompt = index === null ? '' : titles.get(index) || '';
      if (event.kind === 'pass' && typeof event.answer === 'string' && event.answer.length <= 120) {
        const key = event.answer.toLowerCase();
        used.set(key, {answer:event.answer, tier:typeof event.tier === 'string' ? event.tier : '', prompt: used.get(key)?.prompt || prompt, mine: !!used.get(key)?.mine || (me !== null && event.from === me)});
      }
      // why "miss": not on the game's answer list. why "repeat": already said this game.
      if (event.kind === 'reject' && typeof event.text === 'string' && event.text.length <= 120 && typeof event.why === 'string') {
        const key = event.why + ':' + event.text.toLowerCase();
        rejects.set(key, {text:event.text, why:event.why.slice(0, 20), prompt: rejects.get(key)?.prompt || prompt});
      }
    }
    publish();
  }
  function attach(socket, code, eventName, snapshot) {
    const token = {};
    owner = token; state = null; identity = ''; used = new Map(); rejects = new Map(); titles = new Map(); me = null;
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
