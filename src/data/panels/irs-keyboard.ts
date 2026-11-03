/**
 * IRS keyboard, simplified from FCOM 11.10.12 – 11.10.13 (PDF pages 1234 – 1235):
 * N/S, E/W or H arm the keyboard for latitude, longitude or heading; the dual
 * keys then key digits; ENT enters the value if the IRS can take it, otherwise
 * the CLR cue lights illuminate; CLR clears what has not been entered.
 */

export interface Keyboard {
  field?: 'lat' | 'lon' | 'hdg';
  prefix: string;
  digits: string;
  /** An ENT attempt failed. */
  failed?: boolean;
  entered?: { lat?: string; lon?: string; hdg?: string };
}

type Code = { alpha?: string; digit?: string; ent?: true; clr?: true };

export const IRS_KEYS: Record<string, Code> = {
  '1': { digit: '1' },
  N2: { alpha: 'N', digit: '2' },
  '3': { digit: '3' },
  W4: { alpha: 'W', digit: '4' },
  H5: { alpha: 'H', digit: '5' },
  E6: { alpha: 'E', digit: '6' },
  '7': { digit: '7' },
  S8: { alpha: 'S', digit: '8' },
  '9': { digit: '9' },
  ENT: { ent: true },
  '0': { digit: '0' },
  CLR: { clr: true },
};

/** Digits per field; the last one is tenths (latitude ddmm.m, longitude dddmm.m, heading ddd.d). */
const LENGTH = { lat: 5, lon: 6, hdg: 4 };

function valid(kb: Keyboard): boolean {
  if (!kb.field || kb.digits.length !== LENGTH[kb.field]) return false;
  const n = (a: number, b: number) => Number(kb.digits.slice(a, b));
  if (kb.field === 'lat') return n(0, 2) <= 90 && n(2, 4) < 60;
  if (kb.field === 'lon') return n(0, 3) <= 180 && n(3, 5) < 60;
  return n(0, 3) < 360;
}

export function irsKeyboard(prev: Keyboard | undefined, code: Code, accept: { position: boolean; heading: boolean }): Keyboard {
  const kb: Keyboard = prev ?? { prefix: '', digits: '' };
  if (code.clr) return { prefix: '', digits: '', entered: kb.entered };
  if (code.ent) {
    const ok = valid(kb) && (kb.field === 'hdg' ? accept.heading : accept.position);
    if (!ok) return { ...kb, failed: Boolean(kb.field) || kb.failed };
    const value = kb.field === 'hdg' ? kb.digits : kb.prefix + kb.digits;
    return { prefix: '', digits: '', entered: { ...kb.entered, [kb.field!]: value } };
  }
  if (code.alpha && !kb.field) {
    const field = code.alpha === 'N' || code.alpha === 'S' ? 'lat' : code.alpha === 'H' ? 'hdg' : 'lon';
    return { ...kb, field, prefix: code.alpha === 'H' ? '' : code.alpha, digits: '', failed: false };
  }
  if (code.digit && kb.field && kb.digits.length < LENGTH[kb.field]) return { ...kb, digits: kb.digits + code.digit, failed: false };
  return kb;
}
