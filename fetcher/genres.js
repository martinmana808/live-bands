/**
 * MusicBrainz tags are fine-grained ("nwobhm", "organic house", "contemporary
 * r&b"). A filter chip per tag would be a hundred chips with one show each,
 * so tags are folded into families. An artist can belong to more than one.
 */
export const FAMILY_ORDER = [
  'rock', 'metal', 'punk', 'electronic', 'pop', 'hip-hop', 'soul', 'jazz',
  'latin', 'reggae', 'folk', 'classical',
];

// Order matters within a tag: the first family whose pattern matches claims
// the tag, then later ones may also claim it. "pop punk" is punk and pop;
// "alternative rock" must not be metal because of the word "alternative".
const FAMILIES = [
  ['metal',      /\b(metal|nwobhm|grindcore|deathcore|metalcore|thrash|doom|sludge|djent)\b/],
  ['punk',       /\b(punk|hardcore|emo|ska|oi|crust|screamo)\b/],
  ['rock',       /\b(rock|grunge|shoegaze|indie|garage|psychedelic|post-rock|stoner|britpop|alt-rock|new wave|post-punk)\b|\balternative(?= rock)/],
  // "electropop" and "dance-pop" are pop, not electronic
  ['electronic', /\b(electro|electronic|electronica|techno|house|idm|ambient|edm|trance|drum and bass|dnb|dubstep|synth|synthwave|breakbeat|downtempo|trip hop|bass|club)\b|\bdance(?!-?pop)\b/],
  ['pop',        /pop\b/],
  ['hip-hop',    /\b(hip hop|hip-hop|rap|trap|drill|grime|boom bap)\b/],
  ['soul',       /\b(soul|r&b|rnb|funk|disco|neo soul|motown)\b/],
  ['jazz',       /\bjazz\b/],
  ['latin',      /\b(latin|reggaeton|cumbia|salsa|bachata|tango|bossa nova|samba|mpb|regional mexican|corrido|urbano|dembow|bolero|merengue|trova)\b/],
  ['reggae',     /\b(reggae|dub|dancehall|roots)\b/],
  ['folk',       /\b(folk|country|americana|singer-songwriter|acoustic|bluegrass|folclore|folklore)\b/],
  ['classical',  /\b(classical|orchestra|orchestral|opera|baroque|chamber|symphony)\b/],
];

/**
 * @param {string[]} [tags]
 * @returns {string[]}  families in FAMILY_ORDER
 */
export function genreFamilies(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return [];
  const found = new Set();
  for (const raw of tags) {
    const tag = String(raw).toLowerCase();
    for (const [family, re] of FAMILIES) {
      if (re.test(tag)) found.add(family);
    }
  }
  return FAMILY_ORDER.filter(f => found.has(f));
}

/**
 * @param {Array<{genres?: string[]}>} events
 * @returns {Array<[string, number]>}  [family, count] in FAMILY_ORDER, empties dropped
 */
export function familyCounts(events) {
  const counts = new Map();
  for (const e of events) {
    for (const f of genreFamilies(e.genres)) counts.set(f, (counts.get(f) ?? 0) + 1);
  }
  return FAMILY_ORDER.filter(f => counts.has(f)).map(f => [f, counts.get(f)]);
}
