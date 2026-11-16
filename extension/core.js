export const normalize = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
// content.js keeps a copy of answerWords and sameThing (content scripts can't import modules);
// change both together.
const articles = new Set(['the', 'a', 'an']);
export function answerWords(value) {
  const words = String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  while (words.length > 1 && articles.has(words[0])) words.shift();
  return words;
}
// Krillion often accepts and reports a short form of a longer answer ("Hiball" for "Hiball
// Energy"), so two answers count as the same when one, spaces ignored, equals the first whole
// words of the other. "Cat" matches "Cat shark" but never "Catfish".
const leads = (short, long) => {
  const target = short.join('');
  if (target.length < 3) return false;
  let joined = '';
  for (const word of long) { joined += word; if (joined === target) return true; if (joined.length >= target.length) return false; }
  return false;
};
export function sameThing(a, b) {
  const x = Array.isArray(a) ? a : answerWords(a), y = Array.isArray(b) ? b : answerWords(b);
  return leads(x, y) || leads(y, x);
}
// Original starter lists, ordered by estimated obscurity; not official acceptance/rarity data.
export const starterBanks = {
  nameaninsect:['Zorapteran','Grylloblattid','Strepsipteran','Webspinner','Snakefly','Alderfly','Dobsonfly','Scorpionfly','Twisted-wing parasite','Bristletail','Thrips','Lacewing'],
  nameaneggdish:['Oeufs en meurette','Gyeran-jjim','Chawanmushi','Kuku sabzi','Menemen','Çılbır','Oeufs en cocotte','Tamagoyaki','Shakshuka','Frittata','Scotch egg','Omelette'],
  nameacountryineastafrica:['Comoros','Djibouti','Eritrea','Seychelles','Burundi','Rwanda','Uganda','Tanzania','Kenya','Ethiopia','Somalia'],
  namesomethingthatusessteam:['Aeolipile','Cataplana','Couscoussier','Autoclave','Steam hammer','Steam whistle','Steam turbine','Pressure cooker','Espresso machine','Steam iron'],
  nameabuildingmaterial:['Mycelium','Cob','Hempcrete','Rammed earth','Pozzolan','Rammed chalk','Adobe','Bamboo','Cork','Limestone','Timber','Concrete']
};
// Rarity tiers Puffer Party reports for accepted answers, plus "accepted" when none was given,
// and "miss" for an answer the game rejected as not on its list (never suggested).
export const tiers = ['krillion', 'deepcut', 'rare', 'accepted', 'tooclever', 'schooler', 'plankton', 'miss'];
export function cleanCandidates(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  return values.slice(0, 60).flatMap(value => {
    const item = typeof value === 'string' ? {answer: value} : value;
    if (!item || typeof item.answer !== 'string') return [];
    const answer = item.answer.trim().slice(0, 120);
    const aliases = Array.isArray(item.aliases) ? item.aliases.filter(x => typeof x === 'string').slice(0, 8).map(x => x.slice(0, 120)) : [];
    const keys = [answer, ...aliases].map(normalize).filter(Boolean);
    if (!keys.length || keys.some(key => seen.has(key))) return [];
    keys.forEach(key => seen.add(key));
    const out = {answer, aliases, note: typeof item.note === 'string' ? item.note.slice(0, 150) : ''};
    const tier = normalize(item.tier);
    if (tiers.includes(tier)) out.tier = tier;
    return [out];
  });
}
// Picks at random from the rarest few unused answers, so players sharing a bank don't all
// give the same ones. The picks keep their bank order, rarest first.
export function takeThree(pool, history, excluded = [], limit = 3, random = Math.random) {
  const blocked = new Set([...history, ...excluded].map(normalize));
  // Word lists for short-form matching, so a used "Hiball" also blocks "Hiball Energy" and two
  // forms of one answer are never offered side by side.
  const blockedWords = [...new Set([...history, ...excluded].map(String))].map(answerWords).filter(words => words.length);
  const open = [];
  for (const item of cleanCandidates(pool)) {
    const texts = [item.answer, ...item.aliases], keys = texts.map(normalize), words = texts.map(answerWords);
    if (item.tier === 'miss' || keys.some(key => blocked.has(key)) || words.some(w => blockedWords.some(b => sameThing(w, b)))) continue;
    open.push(item);
    keys.forEach(key => blocked.add(key));
    blockedWords.push(...words.filter(w => w.length));
    if (open.length >= Math.max(6, limit * 2)) break;
  }
  // Partial Fisher-Yates shuffle of the indexes: always ends, never repeats a pick.
  const order = open.map((_, index) => index), count = Math.min(limit, open.length);
  for (let k = 0; k < count; k++) {
    const j = k + Math.min(order.length - k - 1, Math.floor(random() * (order.length - k)));
    [order[k], order[j]] = [order[j], order[k]];
  }
  const chosen = new Set(order.slice(0, count));
  return open.filter((_, index) => chosen.has(index));
}
