(() => {
  if (document.getElementById('puffer-helper-host')) return;
  const host = document.createElement('div'); host.id = 'puffer-helper-host';
  host.style.cssText = 'position:fixed;right:16px;top:90px;z-index:2147483646;max-width:calc(100vw - 24px)';
  const root = host.attachShadow({mode: 'open'});
  root.innerHTML = `<style>
    :host{color-scheme:dark}*{box-sizing:border-box}section{width:310px;max-width:calc(100vw - 24px);font:13px/1.45 system-ui,sans-serif;color:#e9f3ff;background:#0c1828f5;border:1px solid #36657e;border-radius:16px;box-shadow:0 12px 40px #0008;overflow:hidden}header{display:flex;align-items:center;gap:8px;padding:12px 14px;background:#14283c;cursor:move;touch-action:none}header strong{flex:1;color:#a4f5dc}button{font:inherit;cursor:pointer;border:1px solid #3b5974;background:#1d334a;color:#e9f3ff;border-radius:8px;padding:6px 9px}button:hover{background:#2b4966}button:disabled{opacity:.5;cursor:default}main{padding:12px 14px}#prompt{font-weight:650;margin:0 0 10px;overflow-wrap:anywhere}#status{color:#a4b9ce;font-size:12px;margin:8px 0}.pick{display:block;width:100%;text-align:left;margin:8px 0;padding:10px 12px;background:#122c37;border-color:#326458}.pick b{display:block;color:#bbffe2;font-size:15px}.pick small{display:block;color:#a7bdcb;margin-top:3px}.pick.used{opacity:.5}footer{display:flex;gap:7px;margin-top:10px}.fine{font-size:11px;color:#8ca7be;margin:10px 0 0}#min{padding:2px 8px}section.fold main{display:none}#next{flex:1}
    </style><section><header><strong>Krillify</strong><button id="min" aria-label="Minimize">−</button></header><main><p id="prompt">Waiting for a Puffer Party prompt…</p><div id="choices"></div><p id="status">Checking settings…</p><footer><button id="next">Next 3</button><button id="pick">Pick prompt</button><button id="settings">Settings</button></footer><p class="fine">Click an answer to fill the game box. You submit it.<br>Rarity is estimated; acceptance isn’t guaranteed.</p></main></section>`;
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
  const renumber = () => cards().forEach((button, index) => { button.querySelector('b').textContent = `${index + 1}. ${button.answer}`; });
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
  function updateButtons() { $('#next').disabled = !current || busy || !enabled; $('#next').textContent = failure ? 'Retry' : 'Next 3'; }
  function makeCard(item) {
    const button = document.createElement('button'); button.className = 'pick';
    button.answer = item.answer;
    button.answerTexts = [item.answer, ...(item.aliases || [])];
    button.answerKeys = button.answerTexts.map(answerKey);
    const title = document.createElement('b');
    const note = document.createElement('small'); note.textContent = item.note;
    button.append(title, note);
    button.addEventListener('click', () => {
      if (alreadyUsed(item)) { button.remove(); renumber(); $('#status').textContent = 'That answer was already used. Choose another.'; refill(); return; }
      const input = gameInput();
      if (!input) { $('#status').textContent = 'Answer box isn’t available yet. Wait for your turn.'; return; }
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, item.answer); input.dispatchEvent(new Event('input', {bubbles: true})); input.focus();
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
      $('#prompt').textContent = prompt || 'Waiting for a Puffer Party prompt…';
      if (prompt && enabled) suggest();
      else if (enabled) $('#status').textContent = 'Ready. Open a room to begin.';
      updateButtons();
    }
    host.style.display = /^\/party(?:\/|$)/.test(location.pathname) ? '' : 'none';
  }
  $('#next').onclick = () => failure && !lastReplace ? refill() : suggest({skipShown: !failure});
  $('#settings').onclick = () => send({type: 'settings'});
  $('#min').onclick = () => { const collapsed = $('section').classList.toggle('fold'); $('#min').textContent = collapsed ? '+' : '−'; };
  $('#pick').onclick = () => { picking = true; $('#status').textContent = 'Click the prompt text on the game page.'; };
  document.addEventListener('click', event => {
    if (!picking || event.composedPath().includes(host)) return;
    event.preventDefault(); event.stopImmediatePropagation(); custom = event.target; picking = false; current = ''; scan();
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
