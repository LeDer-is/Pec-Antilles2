// Utilitaires de base
export const toNum = (v: unknown): number => {
  if (v == null || v === '') return 0;
  const s = String(v).replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

export const toStr = (v: unknown): string => (v == null ? '' : String(v).trim());

export const normName = (s: string): string => {
  if (!s) return '';
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
};

export const fmt = (n: number | null | undefined): string => {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
};

export const pct = (n: number | null | undefined): string => {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n / 100);
};

// Recherche de colonne par patterns
export function findCol(headers: string[], patterns: (string | RegExp)[]): string | null {
  for (const p of patterns) {
    const idx = headers.findIndex(h => {
      const hn = normName(h);
      if (typeof p === 'string') return hn.includes(p);
      return p.test(hn);
    });
    if (idx >= 0) return headers[idx];
  }
  return null;
}

export function getVal(row: Record<string, unknown>, key: string | null): unknown {
  if (!key) return '';
  return row[key] !== undefined ? row[key] : '';
}

// Fuzzy matching
export function jaro(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const m = a.length, n = b.length;
  const matchDist = Math.max(m, n) / 2 - 1;
  const aMatch = new Array(m).fill(false);
  const bMatch = new Array(n).fill(false);
  let matches = 0;
  for (let i = 0; i < m; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, n);
    for (let j = start; j < end; j++) {
      if (bMatch[j] || a[i] !== b[j]) continue;
      aMatch[i] = bMatch[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  let t = 0, k = 0;
  for (let i = 0; i < m; i++) {
    if (!aMatch[i]) continue;
    while (!bMatch[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  return (matches / m + matches / n + (matches - t / 2) / matches) / 3;
}

export function jaroWinkler(a: string, b: string): number {
  const j = jaro(a, b);
  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return j + prefix * 0.1 * (1 - j);
}

export function nameScore(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 100;
  const jw = jaroWinkler(a, b);
  // Bonus si un nom contient l'autre
  if (a.includes(b) || b.includes(a)) return Math.max(jw * 100, 85);
  // Bonus tokens communs
  const ta = new Set(a.split(' '));
  const tb = new Set(b.split(' '));
  let common = 0;
  ta.forEach(t => { if (tb.has(t)) common++; });
  const tokenScore = common / Math.max(ta.size, tb.size);
  return Math.round(Math.max(jw, tokenScore) * 100);
}
