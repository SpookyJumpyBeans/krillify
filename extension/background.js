import {normalize, cleanCandidates, takeThree, starterBanks} from './core.js';
import {indexBank, combinePool, mergeBank, serializeBank, cleanTier} from './bank.js';
import {answerSystemPrompt, answerUserMessage, gameExamples} from './prompt.js';

// Secrets and history are available to extension pages and the worker, not page scripts/content scripts.
const ready = chrome.storage.local.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'});
let queue = Promise.resolve();
const serial = action => { const result = queue.then(action); queue = result.catch(() => {}); return result; };
const defaults = {enabled: false, model: 'gpt-4.1-mini', apiKey: ''};
const active = new Map();

// The shared bank ships with the extension, so every install gets it without a key.
let bundledIndex;
const bundled = () => bundledIndex ??= fetch(chrome.runtime.getURL('banks.json'))
  .then(response => response.json()).then(indexBank).catch(() => new Map());

// Answers other players got accepted, with the rarity tier the game gave them.
async function recordSeen(message) {
  const prompt = typeof message.prompt === 'string' ? message.prompt.trim().slice(0, 500) : '';
  const values = Array.isArray(message.answers) ? message.answers.slice(0, 200) : [];
  if (!normalize(prompt) || !values.length) return {};
  const {verified = {}} = await chrome.storage.local.get('verified');
  const key = 'q:' + normalize(prompt);
  const record = verified[key] || {prompt, answers: {}};
  for (const value of values) {
    const answer = typeof value?.answer === 'string' ? value.answer.trim().slice(0, 120) : '';
    const id = normalize(answer);
    if (!id) continue;
    const previous = record.answers[id];
    // A verified acceptance is never overwritten by a later rejection of the same answer.
    let tier = cleanTier(value.tier) || previous?.tier || '';
    if (tier === 'miss' && previous?.tier && previous.tier !== 'miss') tier = previous.tier;
    // Other names the game accepted this answer under (what you submitted from a card).
    const aliases = [...(previous?.aliases || [])];
    const known = new Set([id, ...aliases.map(normalize)]);
    for (const alias of Array.isArray(value.aliases) ? value.aliases : []) {
      const text = typeof alias === 'string' ? alias.trim().slice(0, 120) : '';
      if (text && !known.has(normalize(text)) && aliases.length < 8) { aliases.push(text); known.add(normalize(text)); }
    }
    record.answers[id] = {answer: previous?.answer || answer, tier, n: (previous?.n || 0) + 1, ...(aliases.length ? {aliases} : {})};
  }
  record.answers = Object.fromEntries(Object.entries(record.answers).slice(-200));
  record.updated = Date.now(); verified[key] = record;
  await chrome.storage.local.set({verified: Object.fromEntries(Object.entries(verified).sort((a, b) => b[1].updated - a[1].updated).slice(0, 500))});
  return {};
}

// Maintainer mode: commit new prompts and verified answers to extension/banks.json on a branch.
const bankPath = 'extension/banks.json';
const fromBase64 = text => new TextDecoder().decode(Uint8Array.from(atob(text.replace(/\s/g, '')), c => c.charCodeAt(0)));
function toBase64(text) {
  const bytes = new TextEncoder().encode(text); let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
let syncing = null;
const syncBank = force => syncing ??= runSync(force).finally(() => { syncing = null; });
async function runSync(force) {
  const {maintainer = {}, pools = {}, verified = {}, syncState = {}} = await chrome.storage.local.get(['maintainer', 'pools', 'verified', 'syncState']);
  if (!maintainer.enabled) return {skipped: 'Maintainer mode is off.'};
  const repo = maintainer.repo || '', branch = maintainer.branch || 'bank-updates';
  if (!maintainer.token || !/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Set the repository and GitHub token in Settings.');
  if (!force && Date.now() - (syncState.at || 0) < 60000) return {skipped: 'Synced less than a minute ago.'};
  if (!await chrome.permissions.contains({origins: ['https://api.github.com/*']})) throw new Error('GitHub access isn’t granted. Save the maintainer settings again.');
  const api = (path, init = {}) => fetch(`https://api.github.com${path}`, {...init, headers: {
    Accept: 'application/vnd.github+json', Authorization: `Bearer ${maintainer.token}`, 'X-GitHub-Api-Version': '2022-11-28',
    ...(init.body ? {'Content-Type': 'application/json'} : {}), ...init.headers}});
  const github = (path, init) => api(`/repos/${repo}${path}`, init);
  // Without an explicit author, GitHub stamps commits with the account's public profile email.
  // Commit as the token owner's noreply address instead, and refuse to commit if it's unknown.
  let identity;
  const author = async () => {
    if (identity) return identity;
    const response = await api('/user');
    const user = response.ok ? await response.json() : {};
    if (!Number.isInteger(user.id) || typeof user.login !== 'string') throw new Error(`Couldn’t look up the token’s GitHub account (${response.status}), so nothing was committed.`);
    return identity = {name: user.login, email: `${user.id}+${user.login}@users.noreply.github.com`};
  };
  const fail = (response, what) => {
    if (response.status === 401) throw new Error('GitHub rejected the token. Check it in Settings.');
    if (response.status === 403 || response.status === 404) throw new Error(`GitHub ${what} failed (${response.status}). The token needs Contents: read and write on ${repo}.`);
    throw new Error(`GitHub ${what} failed (${response.status}).`);
  };
  const ref = await github(`/git/ref/heads/${encodeURIComponent(branch)}`);
  if (ref.status === 404) {
    const info = await github(''); if (!info.ok) fail(info, 'repository lookup');
    const base = (await info.json()).default_branch;
    const head = await github(`/git/ref/heads/${encodeURIComponent(base)}`); if (!head.ok) fail(head, 'branch lookup');
    const created = await github('/git/refs', {method: 'POST', body: JSON.stringify({ref: `refs/heads/${branch}`, sha: (await head.json()).object.sha})});
    if (!created.ok && created.status !== 422) fail(created, 'branch creation');
  } else if (!ref.ok) fail(ref, 'branch lookup');
  const at = `/contents/${bankPath}?ref=${encodeURIComponent(branch)}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const file = await github(at);
    let sha, current = '', remote = {};
    if (file.ok) {
      const meta = await file.json(); sha = meta.sha;
      if (meta.encoding === 'base64' && meta.content) current = fromBase64(meta.content);
      else { const raw = await github(at, {headers: {Accept: 'application/vnd.github.raw+json'}}); if (!raw.ok) fail(raw, 'bank download'); current = await raw.text(); }
      try { remote = JSON.parse(current); } catch { throw new Error(`${bankPath} on ${branch} isn’t valid JSON. Fix it on GitHub, then sync again.`); }
    } else if (file.status !== 404) fail(file, 'bank download');
    const {bank, prompts, answers} = mergeBank(remote, pools, verified);
    const text = serializeBank(bank);
    let result = 'Already up to date.';
    if (text !== current) {
      const plural = (n, word) => `${n} new ${word}${n === 1 ? '' : 's'}`;
      const message = prompts || answers ? `Update answer bank: ${plural(prompts, 'prompt')}, ${plural(answers, 'answer')}` : 'Update answer bank rarity tiers';
      const put = await github(`/contents/${bankPath}`, {method: 'PUT', body: JSON.stringify({message, content: toBase64(text), branch, author: await author(), committer: await author(), ...(sha ? {sha} : {})})});
      if ((put.status === 409 || put.status === 422) && !attempt) continue;
      if (!put.ok) fail(put, 'commit');
      result = `Committed to ${branch}: ${message}.`;
    }
    await chrome.storage.local.set({syncState: {at: Date.now(), result}});
    return {result};
  }
  throw new Error('The bank changed on GitHub during the sync. Try again.');
}

async function generate(prompt, settings, excluded, controller, examples) {
  if (!settings.apiKey) throw new Error('Open Settings and add an OpenAI API key, or import an answer bank.');
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 14000);
  let onAbort;
  const aborted = new Promise((_, reject) => {
    onAbort = () => reject(Object.assign(new Error('Cancelled'), {name: 'AbortError'}));
    controller.signal.addEventListener('abort', onAbort, {once: true});
    if (controller.signal.aborted) onAbort();
  });
  try {
    const response = await Promise.race([fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal: controller.signal,
      headers: {'Authorization': `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({model: settings.model, store: false, max_completion_tokens: 1800,
        response_format: {type: 'json_object'},
        messages: [{role: 'system', content: answerSystemPrompt},
          {role: 'user', content: answerUserMessage(prompt, excluded, examples)}]})
    }), aborted]);
    if (!response.ok) {
      const detail = await Promise.race([Promise.resolve().then(() => response.json?.()).catch(() => ({})), aborted]);
      const code = detail?.error?.code || detail?.error?.type;
      if (response.status === 401) throw new Error('API key rejected. Check your key in Settings.');
      if (response.status === 429) {
        if (/quota|credit|spend|usage_limit/.test(code || '')) throw new Error('API credits or spending limit reached. Check API billing, then Retry.');
        throw new Error('API rate limit reached. Wait a minute, then Retry.');
      }
      if (response.status === 404) throw new Error('Model unavailable. Check the model name in Settings.');
      const failure = new Error(`AI service returned ${response.status}. Check the model in Settings or Retry.`);
      failure.retryable = response.status >= 500; throw failure;
    }
    const data = await Promise.race([response.json(), aborted]);
    const raw = data.choices?.[0]?.message?.content;
    if (typeof raw !== 'string') throw new Error('AI returned no answers. Retry.');
    let parsed;
    try { parsed = JSON.parse(raw); } catch { throw new Error('AI response was incomplete. Retry.'); }
    return cleanCandidates(parsed.answers);
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(timedOut ? 'AI took more than 14 seconds. Retry; cached prompts are faster.' : 'Request cancelled because the prompt changed.');
    throw error;
  } finally { clearTimeout(timer); controller.signal.removeEventListener('abort', onAbort); }
}

async function handle(message, sender, controller) {
  await ready;
  const internal = sender.url?.startsWith(chrome.runtime.getURL(''));
  const game = sender.tab && /^https:\/\/(www\.)?krillion\.io\//.test(sender.url || '');
  if (!internal && !game) throw new Error('Unrecognized sender.');
  if (message.type === 'cancel') return {};
  if (message.type === 'settings') { await chrome.runtime.openOptionsPage(); return {}; }
  if (message.type === 'record') return serial(() => recordSeen(message));
  if (message.type === 'sync') {
    if (message.force && !internal) throw new Error('Unrecognized sender.');
    return syncBank(!!message.force).catch(async error => {
      await chrome.storage.local.set({syncState: {at: Date.now(), result: error.message, failed: true}});
      throw error;
    });
  }
  if (message.type === 'status') {
    const {settings = {}} = await chrome.storage.local.get('settings');
    return {enabled:!!settings.enabled,version:chrome.runtime.getManifest().version};
  }
  const data = await chrome.storage.local.get(['settings', 'games', 'pools', 'verified']);
  const settings = {...defaults, ...data.settings};
  const games = data.games && typeof data.games === 'object' ? data.games : {};
  const scope = typeof message.game === 'string' && /^[a-z0-9:._/-]{1,200}$/i.test(message.game) ? message.game : '';
  const history = Array.isArray(games[scope]?.used) ? games[scope].used : [];
  const pools = data.pools && typeof data.pools === 'object' ? data.pools : {};
  if (!scope) throw new Error('Game not detected yet. Refresh the game page.');
  if (message.type === 'remember') {
    const values = Array.isArray(message.answers) ? message.answers : [];
    const next = new Set([...history, ...values.slice(0, 2500).filter(x => typeof x === 'string').map(normalize)].filter(Boolean));
    // Expand a submitted name to its known aliases, without marking unused suggestions.
    for (const pool of Object.values(pools)) for (const item of cleanCandidates(pool.answers)) {
      const keys = [item.answer, ...item.aliases].map(normalize);
      if (keys.some(key => next.has(key))) keys.forEach(key => next.add(key));
    }
    games[scope] = {used: [...next], updated: Date.now()};
    await chrome.storage.local.set({games: Object.fromEntries(Object.entries(games).sort((a,b) => b[1].updated - a[1].updated).slice(0,30))}); return {};
  }
  if (message.type !== 'suggest') throw new Error('Unknown request.');
  if (!settings.enabled) throw new Error('Paused. Enable Krillify in Settings.');
  const prompt = typeof message.prompt === 'string' ? message.prompt.trim().slice(0, 500) : '';
  if (!prompt) throw new Error('No prompt detected.');
  const key = 'q:' + normalize(prompt);
  const excluded = Array.isArray(message.excluded) ? message.excluded.filter(x => typeof x === 'string').slice(0, 2500) : [];
  const shared = (await bundled()).get(normalize(prompt))?.answers || [];
  const seen = data.verified?.[key];
  let pool = combinePool([pools[key]?.answers, shared, starterBanks[normalize(prompt)]], seen);
  // The overlay asks only for the slots it has free, so a used answer is replaced in place.
  const want = Number.isInteger(message.want) ? Math.min(3, Math.max(1, message.want)) : 3;
  let picks = takeThree(pool, history, excluded, want);
  let source = pools[key]?.source || (shared.length ? 'Shared bank' : starterBanks[normalize(prompt)] ? 'Starter bank · acceptance unverified' : 'cache');
  let fresh = [];
  // A new prompt shows a partial cached batch at once; a top-up request may wait for the AI
  // because the answers already on screen stay visible meanwhile.
  if (settings.apiKey && (!picks.length || (message.topUp && picks.length < want))) {
    const retryStarted = Date.now();
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        try { fresh = await generate(prompt, settings, [...history, ...pool.flatMap(x => [x.answer, ...x.aliases]), ...excluded].slice(-2500), controller, gameExamples(pool)); break; }
        catch (error) {
          if (!error.retryable || attempt || controller.signal.aborted || Date.now()-retryStarted > 1500) throw error;
          await new Promise(resolve => setTimeout(resolve, 750));
        }
      }
    } catch (error) { if (!picks.length || controller.signal.aborted) throw error; }
    if (fresh.length) {
      // Retain the rarest cached entries for reuse in later games, but leave room for new answers.
      pool = combinePool([pool.slice(0, Math.max(0, 60 - fresh.length)), fresh], seen);
      picks = takeThree(pool, history, excluded, want);
      source = 'AI estimate';
    }
  }
  if (!picks.length) throw new Error(settings.apiKey ? 'No unused answers available for this prompt. Try another prompt or reset history in Settings.' : 'No answer bank for this prompt. Add an API key in Settings for automatic suggestions.');
  return serial(async () => {
    if (controller?.signal.aborted) throw new Error('Request cancelled because the prompt changed.');
    // Network calls run outside the storage lock. Merge against the latest state so other
    // tabs and answers submitted while a request was running cannot be overwritten.
    const latest = await chrome.storage.local.get(['pools', 'games']);
    const latestPools = latest.pools || {};
    const latestHistory = latest.games?.[scope]?.used || [];
    if (fresh.length) pool = combinePool([combinePool([latestPools[key]?.answers, pool], seen).slice(0, Math.max(0, 60 - fresh.length)), fresh], seen);
    picks = takeThree(pool, latestHistory, excluded, want);
    if (!picks.length) throw new Error('No unused answers left in this batch. Click Retry.');
    latestPools[key] = {prompt, answers: pool, source, updated: Date.now()};
    const entries = Object.entries(latestPools).sort((a,b) => b[1].updated - a[1].updated).slice(0, 300);
    await chrome.storage.local.set({pools: Object.fromEntries(entries)});
    return {answers: picks, source, count: latestHistory.length, more: picks.length < want && !message.topUp && !!settings.apiKey};
  });
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  let controller;
  // Cancel synchronously, before the next request can replace this tab's controller.
  if (message?.type === 'cancel' && sender.tab && /^https:\/\/(www\.)?krillion\.io\//.test(sender.url || '')) active.get(sender.tab.id)?.abort();
  if (message?.type === 'suggest') {
    active.get(sender.tab?.id)?.abort();
    controller = new AbortController(); active.set(sender.tab?.id, controller);
  }
  const run = () => handle(message || {}, sender, controller);
  const result = message?.type === 'remember' ? serial(run) : run();
  // 'record' takes the storage lock inside handle(); 'sync' runs its network calls outside it.
  result.then(reply, error => reply({error: error.message || 'Unexpected error. Reload the page.'})).finally(() => {
    if (controller && active.get(sender.tab?.id) === controller) active.delete(sender.tab?.id);
  });
  return true;
});
