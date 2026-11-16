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
  let lastStatus = 0, failure = false, lastSubmit = '';
  let game = '', lifecycle = null, roomPath = '', shown = [];
  function syncGame() {
    const room = location.pathname;
    if (!/^\/party\/[^/]+/.test(room)) return false;
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
    game = next; shown = []; lastSubmit = ''; ++generation; busy = false; current = ''; $('#choices').replaceChildren();
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
    if (custom && custom.isConnected && visible(custom)) return custom.textContent.trim();
    const nodes = [...document.querySelectorAll('.pf-root .ds-card:not(.gone):not(.cleared) .prompt')];
    return nodes.reverse().find(el => visible(el) && !/^new category$/i.test(el.textContent.trim()))?.textContent.trim() || '';
  }
  function gameInput() {
    return [...document.querySelectorAll('.pf-root input.ds-input, .pf-root input[type="text"]')]
      .find(el => visible(el) && !el.disabled && !/chat|name|code/i.test([el.placeholder, el.getAttribute('aria-label')].join(' ')));
  }
  function updateButtons() { $('#next').disabled = !current || busy || !enabled; $('#next').textContent = failure ? 'Retry' : 'Next 3'; }
  async function suggest(excluded = []) {
    if (!current || !enabled || !game) return;
    const version = ++generation, prompt = current;
    busy = true; failure = false; updateButtons(); $('#choices').replaceChildren();
    $('#status').textContent = 'Finding obscure answers…';
    let result;
    try { result = await send({type: 'suggest', game, prompt, excluded}); }
    catch { result = {error: 'Could not load suggestions. Click Retry.'}; }
    if (version !== generation) return;
    busy = false;
    if (result?.error || !Array.isArray(result?.answers)) {
      failure = true; $('#status').textContent = result?.error || 'No response. Retry.'; updateButtons(); return;
    }
    shown = result.answers.map(item => item.answer);
    for (const [index, item] of result.answers.entries()) {
      const button = document.createElement('button'); button.className = 'pick';
      const title = document.createElement('b'); title.textContent = `${index + 1}. ${item.answer}`;
      const note = document.createElement('small'); note.textContent = item.note;
      button.append(title, note);
      button.addEventListener('click', () => {
        const input = gameInput();
        if (!input) { $('#status').textContent = 'Answer box isn’t available yet. Wait for your turn.'; return; }
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(input, item.answer); input.dispatchEvent(new Event('input', {bubbles: true})); input.focus();
        $('#status').textContent = 'Filled — press Enter in the game to submit.';
      });
      $('#choices').append(button);
    }
    $('#status').textContent = `${result.source === 'AI estimate' ? 'AI estimate' : result.source === 'imported bank' ? 'Answer bank' : 'Cached suggestions'} · ${result.answers.length} unused option${result.answers.length === 1 ? '' : 's'}`;
    updateButtons();
  }
  async function scan() {
    syncGame();
    if (Date.now() - lastStatus > 2500) {
      lastStatus = Date.now();
      const status = await send({type: 'status', game});
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
  $('#next').onclick = () => suggest(failure ? [] : shown);
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
    lastSubmit = answer; send({type: 'remember', game, answers: [answer]});
    // Prepare a fresh set after our own attempt, ready before the puffer comes back.
    if (enabled && current) setTimeout(() => { if (!busy) suggest(); }, 150);
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
  setInterval(scan, 200); scan();
})();
