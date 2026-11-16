export const normalize = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
// Original starter lists, ordered by estimated obscurity; not official acceptance/rarity data.
export const starterBanks = {
  nameaninsect:['Zorapteran','Grylloblattid','Strepsipteran','Webspinner','Snakefly','Alderfly','Dobsonfly','Scorpionfly','Twisted-wing parasite','Bristletail','Thrips','Lacewing'],
  nameaneggdish:['Oeufs en meurette','Gyeran-jjim','Chawanmushi','Kuku sabzi','Menemen','Çılbır','Oeufs en cocotte','Tamagoyaki','Shakshuka','Frittata','Scotch egg','Omelette'],
  nameacountryineastafrica:['Comoros','Djibouti','Eritrea','Seychelles','Burundi','Rwanda','Uganda','Tanzania','Kenya','Ethiopia','Somalia'],
  namesomethingthatusessteam:['Aeolipile','Cataplana','Couscoussier','Autoclave','Steam hammer','Steam whistle','Steam turbine','Pressure cooker','Espresso machine','Steam iron'],
  nameabuildingmaterial:['Mycelium','Cob','Hempcrete','Rammed earth','Pozzolan','Rammed chalk','Adobe','Bamboo','Cork','Limestone','Timber','Concrete']
};
// Rarity tiers Puffer Party reports for accepted answers, plus "accepted" when none was given.
export const tiers = ['krillion', 'deepcut', 'rare', 'accepted', 'tooclever', 'schooler', 'plankton'];
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
  const open = [];
  for (const item of cleanCandidates(pool)) {
    const keys = [item.answer, ...item.aliases].map(normalize);
    if (keys.some(key => blocked.has(key))) continue;
    open.push(item);
    keys.forEach(key => blocked.add(key));
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
