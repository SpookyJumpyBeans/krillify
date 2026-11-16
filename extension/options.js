import {normalize, cleanCandidates} from './core.js';
const $ = id => document.getElementById(id);
await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
async function load() {
  const {settings = {}, games = {}} = await chrome.storage.local.get(['settings', 'games']);
  $('enabled').checked = !!settings.enabled; $('apiKey').value = settings.apiKey || ''; $('model').value = settings.model || 'gpt-4.1-mini';
  $('count').textContent = 'Used answers are tracked separately for each game. New games can reuse previous answers.';
}
await load();
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
