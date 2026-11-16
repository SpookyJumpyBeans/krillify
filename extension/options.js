import {normalize, cleanCandidates} from './core.js';
const $ = id => document.getElementById(id);
await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
async function load() {
  const {settings = {}, games = {}} = await chrome.storage.local.get(['settings', 'games']);
  $('enabled').checked = !!settings.enabled; $('apiKey').value = settings.apiKey || ''; $('model').value = settings.model || 'gpt-4.1-mini';
  $('count').textContent = 'Used answers are tracked separately for each game. New games can reuse previous answers.';
}
await load();
$('version').textContent = 'v' + chrome.runtime.getManifest().version;
$('settings').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await chrome.storage.local.set({settings:{enabled:$('enabled').checked,apiKey:$('apiKey').value.trim(),model:$('model').value.trim() || 'gpt-4.1-mini'}});
    $('status').textContent = 'Saved. The game overlay updates automatically within a few seconds.';
  } catch { $('status').textContent = 'Could not save. Check extension storage.'; }
});
$('reset').onclick = async () => {
  if (!confirm('Clear used-answer lists for all tracked games? Cached answers and your API key will be kept.')) return;
  await chrome.storage.local.set({games:{},history:[]}); await load(); $('status').textContent = 'Used answers cleared. Press Next 3 in the overlay.';
};
$('bank').addEventListener('change', async () => {
  try {
    const file = $('bank').files[0]; if (!file) return;
    if (file.size > 2_000_000) throw new Error('Choose a JSON file smaller than 2 MB.');
    const bank = JSON.parse(await file.text());
    if (!bank || typeof bank !== 'object' || Array.isArray(bank)) throw new Error('Use a JSON object mapping prompts to lists of answers.');
    const {pools = {}} = await chrome.storage.local.get('pools'); let count = 0;
    for (const [prompt, values] of Object.entries(bank).slice(0,300)) {
      if (!normalize(prompt) || prompt.length > 500) continue;
      const answers = cleanCandidates(values); if (!answers.length) continue;
      const key = 'q:' + normalize(prompt);
      pools[key] = {prompt, answers:cleanCandidates([...answers,...(pools[key]?.answers || [])]),source:'imported bank',updated:Date.now()}; count++;
    }
    if (!count) throw new Error('No valid prompt/answer lists found.');
    await chrome.storage.local.set({pools}); $('status').textContent = `Imported ${count} prompt(s).`;
  } catch (error) { $('status').textContent = error.message; }
});

// Maintainer mode: GitHub access is an optional permission, requested only when it's turned on.
const github = {origins: ['https://api.github.com/*']};
// Store builds don't declare the GitHub permission, so there's no maintainer mode to show.
if (!(chrome.runtime.getManifest().optional_host_permissions || []).includes(github.origins[0])) $('maintainerPanel').hidden = true;
async function loadMaintainer() {
  const {maintainer = {}, syncState} = await chrome.storage.local.get(['maintainer', 'syncState']);
  $('mEnabled').checked = !!maintainer.enabled; $('mRepo').value = maintainer.repo || '';
  $('mBranch').value = maintainer.branch || 'bank-updates'; $('mToken').value = maintainer.token || '';
  if (syncState) $('mStatus').textContent = `Last sync ${new Date(syncState.at).toLocaleString()}: ${syncState.result}`;
}
await loadMaintainer();
$('maintainer').addEventListener('submit', async event => {
  event.preventDefault();
  const enabled = $('mEnabled').checked;
  // Ask before any await so the click still counts as the user gesture Chrome requires.
  const granted = enabled ? chrome.permissions.request(github) : chrome.permissions.remove(github).then(() => true);
  try {
    if (!await granted) { $('mStatus').textContent = 'GitHub access was declined, so maintainer mode stays off.'; $('mEnabled').checked = false; return; }
    await chrome.storage.local.set({maintainer: {enabled, repo: $('mRepo').value.trim(), branch: $('mBranch').value.trim() || 'bank-updates', token: $('mToken').value.trim()}});
    $('mStatus').textContent = enabled ? 'Saved. The bank syncs when each game ends.' : 'Saved. Maintainer mode is off.';
  } catch (error) { $('mStatus').textContent = error.message || 'Could not save.'; }
});
$('syncNow').onclick = async () => {
  $('mStatus').textContent = 'Syncing…';
  const result = await chrome.runtime.sendMessage({type: 'sync', force: true}).catch(error => ({error: error.message}));
  $('mStatus').textContent = result?.error || result?.skipped || result?.result || 'Done.';
};
