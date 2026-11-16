import {normalize, cleanCandidates, tiers} from './core.js';

// Puffer Party rarity tiers, rarest first. Answers seen accepted in a real game carry the tier
// the game gave them; "accepted" marks a verified answer whose tier wasn't reported.
const rank = Object.fromEntries(tiers.map((tier, i) => [tier, [0, 1, 2, 2.5, 3, 4, 5, 99][i]]));
const acceptedTier = tier => !!tier && tier !== 'miss';
export const tierRank = item => rank[item?.tier] ?? 3;
export const cleanTier = value => {
  const tier = normalize(value);
  return tier in rank ? tier : '';
};

// Stable sort: verified rare answers move up, verified common ones move down, and unverified
// answers keep the order the AI or bank author gave them.
export const byRarity = list => list.map((item, index) => ({item, index}))
  .sort((a, b) => tierRank(a.item) - tierRank(b.item) || a.index - b.index).map(x => x.item);

export function indexBank(bank) {
  const index = new Map();
  if (!bank || typeof bank !== 'object' || Array.isArray(bank)) return index;
  for (const [prompt, values] of Object.entries(bank)) {
    const key = normalize(prompt);
    if (key && prompt.length <= 500) index.set(key, {prompt, answers: cleanCandidates(values)});
  }
  return index;
}

// Fold an answer into a list, matching on the answer and every alias.
function fold(list, item) {
  const keys = [item.answer, ...(item.aliases || [])].map(normalize).filter(Boolean);
  const existing = list.find(other => [other.answer, ...(other.aliases || [])].some(value => keys.includes(normalize(value))));
  // A rejection only demotes an answer we already have; other players' rejected guesses (typos,
  // junk) never become entries of their own.
  if (!existing) { if (item.tier === 'miss') return false; list.push({...item, aliases: [...(item.aliases || [])]}); return true; }
  let changed = false;
  for (const alias of [item.answer, ...(item.aliases || [])]) {
    const known = [existing.answer, ...existing.aliases].map(normalize);
    if (!known.includes(normalize(alias)) && existing.aliases.length < 8) { existing.aliases.push(alias); changed = true; }
  }
  // A verified acceptance always beats a rejection; a rejection only lands on an unverified answer.
  if (item.tier === 'miss') { if (!acceptedTier(existing.tier) && existing.tier !== 'miss') { existing.tier = 'miss'; changed = true; } }
  else if (item.tier && item.tier !== 'accepted' && existing.tier !== item.tier) { existing.tier = item.tier; changed = true; }
  else if (item.tier === 'accepted' && (!existing.tier || existing.tier === 'miss')) { existing.tier = 'accepted'; changed = true; }
  if (!existing.note && item.note) { existing.note = item.note; changed = true; }
  return changed;
}

const seenItems = record => Object.values(record?.answers || {}).filter(seen => typeof seen?.answer === 'string')
  .map(seen => ({answer: seen.answer, aliases: Array.isArray(seen.aliases) ? seen.aliases.filter(alias => typeof alias === 'string') : [], note: '', tier: cleanTier(seen.tier) || 'accepted'}));

// One ranked candidate list from several sources (earlier sources win ties), with tiers from
// answers seen accepted in real games applied on top.
export function combinePool(sources, record) {
  const list = [];
  for (const source of sources) for (const item of cleanCandidates(source)) fold(list, item);
  for (const item of seenItems(record)) fold(list, item);
  return byRarity(list).slice(0, 60);
}

// remote: the bank as committed. pools: local AI results. verified: answers seen accepted in games.
export function mergeBank(remote, pools = {}, verified = {}) {
  const index = indexBank(remote);
  let prompts = 0, answers = 0;
  const entry = prompt => {
    const key = normalize(prompt);
    if (!index.has(key)) { index.set(key, {prompt, answers: []}); prompts++; }
    return index.get(key);
  };
  for (const pool of Object.values(pools || {})) {
    if (pool?.source !== 'AI estimate' || typeof pool.prompt !== 'string') continue;
    const target = entry(pool.prompt);
    for (const item of cleanCandidates(pool.answers)) {
      const before = target.answers.length;
      fold(target.answers, item);
      answers += target.answers.length - before;
    }
  }
  for (const record of Object.values(verified || {})) {
    if (typeof record?.prompt !== 'string' || !record.answers) continue;
    const target = entry(record.prompt);
    for (const item of seenItems(record)) {
      const before = target.answers.length;
      fold(target.answers, item);
      answers += target.answers.length - before;
    }
  }
  const bank = {};
  for (const {prompt, answers: list} of [...index.values()].sort((a, b) => a.prompt.localeCompare(b.prompt))) {
    if (list.length) bank[prompt] = byRarity(list).slice(0, 60);
  }
  return {bank, prompts, answers};
}

// One answer per line keeps the diffs on the bank branch readable.
export function serializeBank(bank) {
  const entries = Object.entries(bank);
  if (!entries.length) return '{}\n';
  const compact = item => {
    const out = {answer: item.answer};
    if (item.aliases?.length) out.aliases = item.aliases;
    if (item.note) out.note = item.note;
    if (item.tier) out.tier = item.tier;
    return JSON.stringify(out);
  };
  return '{\n' + entries.map(([prompt, list]) =>
    `  ${JSON.stringify(prompt)}: [\n${list.map(item => '    ' + compact(item)).join(',\n')}\n  ]`).join(',\n') + '\n}\n';
}
