(() => {
  if (document.getElementById('puffer-helper-host')) return;
  const host = document.createElement('div'); host.id = 'puffer-helper-host';
  host.style.cssText = 'position:fixed;right:16px;top:90px;z-index:2147483646;max-width:calc(100vw - 24px)';
  const root = host.attachShadow({mode: 'open'});
  // Styled after Puffer Party: VT323 (already loaded by the page), square double-ring
  // panels, wide-tracked uppercase labels and a cyan ring for the active item.
  root.innerHTML = `<style>
    :host{color-scheme:dark;--ink:#e8f1ff;--drift:#7d93b8;--dim:#5d739c;--abyss:#060d1a;--rim:#1b3050;--cyan:#4de3ff;--key:rgba(11,21,38,.9);--hair:#7d93b838;--warn:#ff9f43}
    *{box-sizing:border-box;margin:0}
    section{width:300px;max-width:calc(100vw - 24px);font:18px/1.15 VT323,"VT323 Fallback",ui-monospace,monospace;color:var(--ink);background:rgba(8,15,28,.9);backdrop-filter:blur(6px);box-shadow:0 0 0 2px var(--abyss),0 0 0 4px var(--rim),0 0 40px rgba(0,0,0,.45);-webkit-font-smoothing:none}
    header{display:flex;align-items:center;gap:10px;padding:12px 14px 10px;cursor:move;touch-action:none;user-select:none}
    h2{font:inherit;font-size:16px;letter-spacing:3.3px;color:var(--ink)}
    h2 span{color:var(--cyan);text-shadow:0 0 10px rgba(77,227,255,.5)}
    .rule{flex:1;height:0;border-top:2px dashed var(--hair)}
    button{font:inherit;color:inherit;cursor:pointer;border:0;background:none;padding:0}
    button:focus-visible{outline:2px solid var(--cyan);outline-offset:2px}
    #min{width:26px;height:22px;font-size:18px;line-height:20px;color:var(--drift);background:var(--key);box-shadow:0 0 0 2px var(--abyss),0 0 0 3px var(--rim)}
    #min:hover{color:var(--ink)}
    main{padding:2px 14px 14px}
    section.fold main{display:none}
    section.fold header{padding-bottom:12px}
    .label{display:block;font-size:12px;letter-spacing:2.9px;color:var(--drift);text-transform:uppercase;margin-bottom:4px}
    #prompt{font-size:22px;line-height:1.05;letter-spacing:.5px;overflow-wrap:anywhere;margin-bottom:14px}
    #prompt.idle{font-size:18px;color:var(--dim)}
    #choices{display:grid;gap:10px;padding:4px}
    .pick,.slot{display:flex;align-items:flex-start;gap:10px;width:100%;min-height:52px;text-align:left;padding:8px 10px 7px;background:var(--key);box-shadow:0 0 0 2px var(--abyss),0 0 0 4px var(--rim);transition:box-shadow .12s}
    .pick:hover,.pick:focus-visible{outline:0;box-shadow:0 0 0 2px var(--abyss),0 0 0 4px var(--cyan),0 0 16px rgba(77,227,255,.35)}
    .pick:active{transform:translateY(1px)}
    .pick.filled{box-shadow:0 0 0 2px var(--abyss),0 0 0 4px var(--cyan),0 0 16px rgba(77,227,255,.35)}
    .num{flex:none;width:22px;height:22px;display:grid;place-items:center;font-size:16px;color:var(--abyss);background:var(--cyan);margin-top:1px}
    .body{min-width:0}
    .pick b{display:block;font-weight:400;font-size:21px;line-height:1;letter-spacing:.6px;overflow-wrap:anywhere}
    .pick small{display:block;font-size:14px;line-height:1.1;color:var(--dim);margin-top:3px;letter-spacing:.3px}
    .slot{align-items:center;justify-content:center;font-size:14px;letter-spacing:2.9px;color:var(--dim);text-transform:uppercase;background:transparent;box-shadow:inset 0 0 0 2px var(--hair)}
    section.busy .slot{animation:pulse 1.1s steps(2) infinite}
    @keyframes pulse{50%{color:var(--cyan)}}
    #status{display:flex;align-items:center;gap:8px;min-height:18px;font-size:14px;letter-spacing:.5px;color:var(--drift);margin:14px 0 12px}
    #status::before{content:"";flex:none;width:6px;height:6px;background:var(--dim)}
    section.busy #status::before{background:var(--cyan);animation:blink .6s steps(2) infinite}
    section.failed #status{color:var(--warn)}
    section.failed #status::before{background:var(--warn)}
    @keyframes blink{50%{opacity:0}}
    footer{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:8px}
    footer button{padding:7px 4px 5px;font-size:15px;letter-spacing:1.4px;text-transform:uppercase;color:var(--drift);background:rgba(11,21,38,.85);border:1px solid var(--rim)}
    footer button:hover:not(:disabled){color:var(--ink);border-color:var(--drift)}
    #next{color:var(--cyan);border-color:var(--cyan);box-shadow:0 0 12px rgba(77,227,255,.2)}
    #next:hover:not(:disabled){color:var(--ink);background:rgba(77,227,255,.12)}
    footer button:disabled{opacity:.4;cursor:default;box-shadow:none}
    #pick.on{color:var(--cyan);border-color:var(--cyan)}
    .fine{font-size:13px;line-height:1.2;color:var(--dim);margin-top:12px;padding-top:10px;border-top:2px dashed var(--hair)}
    @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
    </style><section><header><h2>KRILL<span>IFY</span></h2><div class="rule"></div><button id="min" aria-label="Minimize" title="Minimize">−</button></header><main><span class="label">Category</span><p id="prompt" class="idle">Waiting for a Puffer Party prompt…</p><span class="label">Deep cuts</span><div id="choices" aria-live="polite"></div><p id="status" role="status">Checking settings…</p><footer><button id="next">Next 3</button><button id="pick" title="Click the prompt text on the page">Pick</button><button id="settings">Settings</button></footer><p class="fine">Click an answer to fill the game box, then press Enter. Rarity is estimated; acceptance isn’t guaranteed.</p></main></section>`;
  document.documentElement.append(host);
  const $ = selector => root.querySelector(selector);
  let current = '', generation = 0, busy = false, enabled = false, picking = false, custom = null;
  let lastStatus = 0, failure = false, lastSubmit = '', lastReplace = true;
  let game = '', lifecycle = null, roomPath = '';
  const usedInRoom = new Set();
  const bubbleVersions = new WeakMap();
  let replacementTimer;
  let liveRoom = null;
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.channel !== 'krillify-game-v1') return;
    if (event.data.disconnected) { liveRoom = null; return; }
    const r = event.data.room;
    if (!r || typeof r.game !== 'string' || !/^[a-z0-9:._/-]{1,140}$/i.test(r.game) || !['lobby','countdown','round','over'].includes(r.phase) || typeof r.prompt !== 'string' || r.prompt.length > 500 || !Array.isArray(r.answers)) return;
    liveRoom = r; syncGame();
    const fresh = r.answers.slice(0,2500).filter(x => typeof x?.answer === 'string' && x.answer.length <= 120 && !usedInRoom.has(answerKey(x.answer)));
    for (const item of fresh) usedInRoom.add(answerKey(item.answer));
    const removed = dropUsed();
    if (fresh.length) {
      const scope = game;
      send({type:'remember', game:scope, answers:fresh.map(x=>x.answer)}).then(() => { if (removed && game === scope) refill(); });
    }
    scan();
  });
  const answerKey = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  window.postMessage({channel:'krillify-request-state'}, location.origin);
  const cards = () => [...$('#choices').querySelectorAll('.pick')];
  function renumber() {
    cards().forEach((button, index) => { button.querySelector('.num').textContent = index + 1; });
    for (const slot of $('#choices').querySelectorAll('.slot')) slot.remove();
    if (!current || !enabled) return;
    for (let i = cards().length; i < 3; i++) {
      const slot = document.createElement('div'); slot.className = 'slot';
      slot.textContent = busy ? 'Diving…' : 'Empty';
      $('#choices').append(slot);
    }
  }
  // Remove only the cards that were used; the rest stay where they are.
  function dropUsed() {
    let removed = false;
    for (const button of cards()) if (button.answerKeys.some(key => usedInRoom.has(key))) { button.remove(); removed = true; }
    if (removed) renumber();
    return removed;
  }
  const refill = () => { if (current && enabled && game && cards().length < 3) suggest({replace: false}); };
  const alreadyUsed = item => [item.answer, ...(item.aliases || [])].some(value => usedInRoom.has(answerKey(value)));
  function trackAcceptedAnswers() {
    if (!game || lifecycle?.stage !== 'round') return;
    const answers = [];
    for (const bubble of document.querySelectorAll('.pf-root .pf-seat .pf-say')) {
      const text = bubble.textContent.trim();
      const stamp = bubble.className + ':' + text;
      if (bubbleVersions.get(bubble) === stamp) continue;
      bubbleVersions.set(bubble, stamp);
      // Accepted pass bubbles are "ok"; restored accepted answers are "rest".
      if (!bubble.matches('.ok, .rest') || !text || text.length > 120) continue;
      const key = answerKey(text);
      if (!key || usedInRoom.has(key)) continue;
      usedInRoom.add(key); answers.push(text);
    }
    if (!answers.length) return;
    const scope = game;
    const removed = dropUsed();
    const saved = send({type:'remember', game:scope, answers});
    if (removed) {
      $('#status').textContent = 'An answer was used in this game. Filling its slot…';
      clearTimeout(replacementTimer);
      replacementTimer = setTimeout(async () => {
        await saved;
        if (game === scope) refill();
      }, 150);
    }
  }
  function syncGame() {
    const room = location.pathname;
    if (!/^\/party\/[^/]+/.test(room)) return false;
    if (liveRoom && liveRoom.game.split(':')[0].toLowerCase() === room.split('/')[2]?.toLowerCase()) {
      const next = room + ':server:' + liveRoom.game;
      lifecycle = {id:'server:' + liveRoom.game, stage:liveRoom.phase, category:0};
      if (next === game) return false;
      if (game) for (const bubble of document.querySelectorAll('.pf-root .pf-seat .pf-say')) bubbleVersions.set(bubble, bubble.className + ':' + bubble.textContent.trim());
      game = next; usedInRoom.clear(); lastSubmit = ''; ++generation; busy = false; current = ''; $('#choices').replaceChildren(); return true;
    }
    const gameRoot = document.querySelector('.pf-root');
    if (!gameRoot || gameRoot.hasAttribute('data-loading')) return false;
    if (room !== roomPath) {
      roomPath = room;
      try { lifecycle = JSON.parse(sessionStorage.getItem('puffer-helper:' + room) || 'null'); } catch { lifecycle = null; }
    }
    const label = document.querySelector('.pf-root .pf-hud-label')?.textContent.trim() || '';
    const stage = /GAME OVER/i.test(label) ? 'over' : /GET READY/i.test(label) ? 'countdown' : /LOBBY/i.test(label) || gameRoot.dataset.mode === 'lobby' ? 'lobby' : /CATEGORY/i.test(label) || detect() ? 'round' : '';
    if (!stage) return false;
    const category = Number(label.match(/CATEGORY\s+(\d+)/i)?.[1] || 0);
    const newGame = !lifecycle ||
      (stage === 'lobby' && ['round', 'over', 'countdown'].includes(lifecycle.stage)) ||
      (stage === 'countdown' && ['round', 'over'].includes(lifecycle.stage)) ||
      (stage === 'round' && lifecycle.stage === 'over') ||
      (stage === 'round' && category > 0 && lifecycle.category > category) ||
      (stage === 'lobby' && lifecycle.stage === 'lobby' && label && lifecycle.label && label !== lifecycle.label);
    if (newGame) lifecycle = {id: crypto.randomUUID(), stage, category, label};
    else lifecycle = {...lifecycle, stage, label, category: category || lifecycle.category};
    try { sessionStorage.setItem('puffer-helper:' + room, JSON.stringify(lifecycle)); } catch {}
    const next = room + ':' + lifecycle.id;
    if (next === game) return false;
    if (game) {
      // Ignore lingering bubbles from the preceding game until they change.
      for (const bubble of document.querySelectorAll('.pf-root .pf-seat .pf-say')) bubbleVersions.set(bubble, bubble.className + ':' + bubble.textContent.trim());
    }
    usedInRoom.clear(); clearTimeout(replacementTimer);
    game = next; lastSubmit = ''; ++generation; busy = false; current = ''; $('#choices').replaceChildren();
    return true;
  }
  async function send(data) {
    let timer;
    try {
      return await Promise.race([
        chrome.runtime.sendMessage(data),
        new Promise(resolve => { timer = setTimeout(() => resolve({error: 'Extension response timed out. Click Retry. If it happens again, reload the extension and refresh Krillion.'}), data.type === 'suggest' ? 18000 : 4000); })
      ]);
    }
    catch { return {error: 'Extension reloaded. Refresh the game page.'}; }
    finally { clearTimeout(timer); }
  }
  function visible(el) { return !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'; }
  function detect() {
    if (!/^\/party(?:\/|$)/.test(location.pathname)) return '';
    if (liveRoom && liveRoom.game.split(':')[0].toLowerCase() === location.pathname.split('/')[2]?.toLowerCase()) return liveRoom.phase === 'round' ? liveRoom.prompt.trim() : '';
    if (custom && custom.isConnected && visible(custom)) return custom.textContent.trim();
    const nodes = [...document.querySelectorAll('.pf-root .ds-card .prompt')];
    return nodes.reverse().find(el => visible(el) && !/^new category$/i.test(el.textContent.trim()))?.textContent.trim() || '';
  }
  function gameInput() {
    return [...document.querySelectorAll('.pf-root input.ds-input, .pf-root input[type="text"]')]
      .find(el => visible(el) && !el.disabled && !/chat|name|code/i.test([el.placeholder, el.getAttribute('aria-label')].join(' ')));
  }
  function updateButtons() {
    $('#next').disabled = !current || busy || !enabled; $('#next').textContent = failure ? 'Retry' : 'Next 3';
    $('section').classList.toggle('busy', busy); $('section').classList.toggle('failed', failure);
    renumber();
  }
  function makeCard(item) {
    const button = document.createElement('button'); button.className = 'pick';
    button.answer = item.answer;
    button.answerTexts = [item.answer, ...(item.aliases || [])];
    button.answerKeys = button.answerTexts.map(answerKey);
    const num = document.createElement('span'); num.className = 'num';
    const body = document.createElement('span'); body.className = 'body';
    const title = document.createElement('b'); title.textContent = item.answer;
    const note = document.createElement('small'); note.textContent = item.note;
    body.append(title, note); button.append(num, body);
    button.addEventListener('click', () => {
      if (alreadyUsed(item)) { button.remove(); renumber(); $('#status').textContent = 'That answer was already used. Choose another.'; refill(); return; }
      const input = gameInput();
      if (!input) { $('#status').textContent = 'Answer box isn’t available yet. Wait for your turn.'; return; }
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, item.answer); input.dispatchEvent(new Event('input', {bubbles: true})); input.focus();
      for (const other of cards()) other.classList.toggle('filled', other === button);
      $('#status').textContent = 'Filled. Press Enter in the game to submit.';
    });
    return button;
  }
  // replace: swap the whole bank (new prompt, Next 3). Otherwise only fill the empty slots
  // and leave the cards already shown untouched.
  async function suggest({replace = true, skipShown = false} = {}) {
    if (!current || !enabled || !game) return;
    const keep = replace ? [] : cards();
    const need = 3 - keep.length;
    if (need <= 0) return;
    const version = ++generation, prompt = current;
    lastReplace = replace;
    busy = true; failure = false; updateButtons();
    $('#status').textContent = replace ? 'Finding obscure answers…' : 'Filling the empty slot…';
    const avoid = (replace ? (skipShown ? cards() : []) : keep).flatMap(button => button.answerTexts);
    let result;
    try { result = await send({type: 'suggest', game, prompt, want: need, topUp: !replace, excluded: [...avoid, ...usedInRoom]}); }
    catch { result = {error: 'Could not load suggestions. Click Retry.'}; }
    if (version !== generation) return;
    busy = false;
    if (result?.error || !Array.isArray(result?.answers)) {
      failure = true; $('#status').textContent = result?.error || 'No response. Retry.'; updateButtons(); return;
    }
    const onScreen = new Set((replace ? [] : cards()).flatMap(button => button.answerKeys));
    const available = result.answers.filter(item => !alreadyUsed(item) && ![item.answer, ...(item.aliases || [])].some(value => onScreen.has(answerKey(value))));
    if (replace) $('#choices').replaceChildren();
    for (const item of available.slice(0, Math.max(0, 3 - cards().length))) $('#choices').append(makeCard(item));
    renumber();
    const count = cards().length;
    $('#status').textContent = `${result.source || 'Cached suggestions'} · ${count} unused option${count === 1 ? '' : 's'}`;
    updateButtons();
    if (count < 3 && (available.length < result.answers.length || result.more)) {
      // An answer was used while this request ran, or the cache was short: top up the free slots.
      clearTimeout(replacementTimer);
      replacementTimer = setTimeout(() => { if (!busy && current === prompt) refill(); }, 150);
    }
  }
  async function scan() {
    syncGame();
    trackAcceptedAnswers();
    if (Date.now() - lastStatus > 2500) {
      lastStatus = Date.now();
      const status = await send({type: 'status', game});
      if (status?.error) { if (!busy && !cards().length) $('#status').textContent = status.error; return; }
      const wasEnabled = enabled; enabled = !!status?.enabled;
      if (!enabled) {
        if (wasEnabled) { ++generation; busy = false; $('#choices').replaceChildren(); }
        $('#status').textContent = status?.error || 'Paused — open Settings to enable.'; updateButtons();
      } else if (!wasEnabled && current) suggest();
    }
    const prompt = detect();
    if (prompt !== current) {
      if (busy) send({type: 'cancel'});
      ++generation; busy = false; current = prompt; failure = false; $('#choices').replaceChildren();
      $('#prompt').textContent = prompt || 'Waiting for a Puffer Party prompt…'; $('#prompt').classList.toggle('idle', !prompt);
      if (prompt && enabled) suggest();
      else if (enabled) $('#status').textContent = 'Ready. Open a room to begin.';
      updateButtons();
    }
    host.style.display = /^\/party(?:\/|$)/.test(location.pathname) ? '' : 'none';
  }
  $('#next').onclick = () => failure && !lastReplace ? refill() : suggest({skipShown: !failure});
  $('#settings').onclick = () => send({type: 'settings'});
  $('#min').onclick = () => { const collapsed = $('section').classList.toggle('fold'); $('#min').textContent = collapsed ? '+' : '−'; };
  $('#pick').onclick = () => { picking = !picking; $('#pick').classList.toggle('on', picking); $('#status').textContent = picking ? 'Click the prompt text on the game page.' : 'Pick cancelled.'; };
  document.addEventListener('click', event => {
    if (!picking || event.composedPath().includes(host)) return;
    event.preventDefault(); event.stopImmediatePropagation(); custom = event.target; picking = false; $('#pick').classList.remove('on'); current = ''; scan();
  }, true);
  // Also remember answers the user types independently of the helper.
  const rememberInput = () => {
    const input = gameInput(), answer = input?.value?.trim();
    if (!answer || !game || answer === lastSubmit) return;
    lastSubmit = answer;
    const scope = game, saved = send({type: 'remember', game, answers: [answer]});
    // Submitting a bank answer removes just that card and fills its slot. A typed answer
    // that isn't in the bank leaves the bank alone.
    const key = answerKey(answer);
    const card = cards().find(button => button.answerKeys.includes(key));
    if (!card) return;
    usedInRoom.add(key); card.remove(); renumber();
    saved.then(() => { if (game === scope) refill(); });
  };
  document.addEventListener('keydown', event => { if (event.key === 'Enter' && event.target === gameInput()) rememberInput(); }, true);
  document.addEventListener('submit', event => { if (event.target.contains(gameInput())) rememberInput(); }, true);
  document.addEventListener('click', event => {
    if (event.target.closest?.('.pf-root button[aria-label="Send answer"]')) rememberInput();
  }, true);
  // Drag the panel away from game controls.
  $('header').addEventListener('pointerdown', event => {
    if (event.target.closest('button')) return;
    const rect = host.getBoundingClientRect(), dx = event.clientX - rect.left, dy = event.clientY - rect.top;
    $('header').setPointerCapture(event.pointerId);
    const move = e => { host.style.right = 'auto'; host.style.left = Math.max(0, Math.min(innerWidth - rect.width, e.clientX - dx)) + 'px'; host.style.top = Math.max(0, Math.min(innerHeight - 45, e.clientY - dy)) + 'px'; };
    const stop = () => { $('header').removeEventListener('pointermove', move); $('header').removeEventListener('pointerup', stop); $('header').removeEventListener('pointercancel', stop); };
    $('header').addEventListener('pointermove', move); $('header').addEventListener('pointerup', stop); $('header').addEventListener('pointercancel', stop);
  });
  // Polling avoids rerunning on the game's continuously animated DOM; 200 ms detection delay.
  const answersObserver = new MutationObserver(records => {
    if (records.some(record => {
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      return target && (target.closest('.pf-say') || [...record.addedNodes].some(node => node instanceof Element && (node.matches('.pf-say, .pf-seat') || node.querySelector('.pf-say'))));
    })) {
      syncGame(); trackAcceptedAnswers();
    }
  });
  answersObserver.observe(document.documentElement, {subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});
  setInterval(scan, 200); scan();
})();
