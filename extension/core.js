export const normalize = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
// Original starter lists, ordered by estimated obscurity; not official acceptance/rarity data.
export const starterBanks = {
  nameaninsect:['Zorapteran','Grylloblattid','Strepsipteran','Webspinner','Snakefly','Alderfly','Dobsonfly','Scorpionfly','Twisted-wing parasite','Bristletail','Thrips','Lacewing'],
  nameaneggdish:['Oeufs en meurette','Gyeran-jjim','Chawanmushi','Kuku sabzi','Menemen','Çılbır','Oeufs en cocotte','Tamagoyaki','Shakshuka','Frittata','Scotch egg','Omelette'],
  nameacountryineastafrica:['Comoros','Djibouti','Eritrea','Seychelles','Burundi','Rwanda','Uganda','Tanzania','Kenya','Ethiopia','Somalia'],
  namesomethingthatusessteam:['Aeolipile','Cataplana','Couscoussier','Autoclave','Steam hammer','Steam whistle','Steam turbine','Pressure cooker','Espresso machine','Steam iron'],
  nameabuildingmaterial:['Mycelium','Cob','Hempcrete','Rammed earth','Pozzolan','Rammed chalk','Adobe','Bamboo','Cork','Limestone','Timber','Concrete']
};
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
    return [{answer, aliases, note: typeof item.note === 'string' ? item.note.slice(0, 150) : ''}];
  });
}
export function takeThree(pool, history, excluded = []) {
  const blocked = new Set([...history, ...excluded].map(normalize));
  const selected = [];
  for (const item of cleanCandidates(pool)) {
    const keys = [item.answer, ...item.aliases].map(normalize);
    if (keys.some(key => blocked.has(key))) continue;
    selected.push(item);
    keys.forEach(key => blocked.add(key));
    if (selected.length === 3) break;
  }
  return selected;
}
