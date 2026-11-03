/*
 * Bad-language check for comments, English and Spanish. Text is normalised
 * first so that letter swaps (sh1t, f*ck), repeated letters (fuuuck), spacing
 * (f u c k) and common short forms (wtf, stfu, hdp) are caught. Whole words
 * only, so place names and normal words that contain a match pass.
 */

const WORDS = [
  // English
  'fuck', 'fucker', 'fucking', 'fucked', 'motherfucker', 'shit', 'shitty', 'bullshit', 'bitch', 'bastard', 'asshole', 'arsehole',
  'cunt', 'dick', 'dickhead', 'prick', 'wanker', 'twat', 'bollocks', 'piss', 'pissed', 'crap', 'slut', 'whore', 'douche',
  'idiot', 'idiots', 'moron', 'morons', 'retard', 'retarded', 'dumbass', 'jackass', 'scumbag',
  // English short forms
  'wtf', 'stfu', 'gtfo', 'fck', 'fk', 'fuk', 'fcuk', 'sht', 'btch', 'mf', 'mofo', 'kys',
  // Spanish
  'mierda', 'joder', 'jodido', 'jodida', 'puta', 'puto', 'putas', 'putos', 'gilipollas', 'cabron', 'cabrona', 'cabrones',
  'pendejo', 'pendeja', 'culero', 'culera', 'chingar', 'chingada', 'chingado', 'verga', 'carajo', 'coño', 'hostia',
  'imbecil', 'idiota', 'idiotas', 'estupido', 'estupida', 'subnormal', 'capullo', 'mamon', 'zorra', 'maricon', 'polla',
  'cojones', 'huevon', 'boludo', 'pelotudo', 'malparido', 'gonorrea',
  // Spanish short forms
  'hdp', 'hdlgp', 'ctm', 'ptm', 'csm', 'qlo', 'mrd', 'mrda', 'jdr',
];

const PHRASES = ['hijo de puta', 'hija de puta', 'me cago en', 'vete a la mierda', 'piss off', 'son of a bitch', 'go to hell', 'shut up'];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '!': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '8': 'b', '*': 'u', '€': 'e' };

const words = new Set(WORDS);

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[01!3@4$578*€]/g, (c) => LEET[c] ?? c)
    .normalize('NFD')
    .replace(/(?<!n)[̀-ͯ]/g, '') // drop accents, keep ñ
    .normalize('NFC')
    .replace(/(.)\1{2,}/g, '$1$1'); // fuuuck -> fuuck
}

/** Words or phrases in the text that are not allowed. Empty when the text is fine. */
export function badLanguage(text: string): string[] {
  const t = normalise(text);
  const found = new Set<string>();
  const tokens = t.split(/[^a-zñ]+/).filter(Boolean);
  const squeeze = (w: string) => w.replace(/(.)\1+/g, '$1');
  for (const w of tokens) if (words.has(w) || words.has(squeeze(w))) found.add(w);
  // letters spaced or dotted out: "f u c k", "f.u.c.k"
  const singles = t.match(/(?:\b[a-zñ][\s._-]+){2,}[a-zñ]\b/g) ?? [];
  for (const run of singles) {
    const joined = run.replace(/[\s._-]+/g, '');
    if (words.has(joined) || words.has(squeeze(joined))) found.add(joined);
  }
  const flat = ` ${tokens.join(' ')} `;
  for (const p of PHRASES) if (flat.includes(` ${p} `)) found.add(p);
  return [...found];
}
