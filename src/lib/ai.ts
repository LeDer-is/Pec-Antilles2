import type { MappingResult } from '@/types';
import { findCol } from './utils';

const AI_KEY_STORAGE = 'pec_anthropic_key_v1';
export const AI_MODEL = 'claude-haiku-4-5';
const AI_API_URL = 'https://api.anthropic.com/v1/messages';
const MAX_RETRIES = 3;

// Retry with exponential backoff for rate limits
async function fetchWithRetry(url: string, init: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    const resp = await fetch(url, init);
    if (resp.status === 429 && i < retries) {
      const retryAfter = resp.headers.get('retry-after');
      const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : Math.min(1000 * Math.pow(2, i), 30000);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }
    return resp;
  }
  throw new Error('Rate limit exceeded after retries');
}

export const getApiKey = (): string => localStorage.getItem(AI_KEY_STORAGE) || '';
export const setApiKey = (k: string): void => {
  if (k) localStorage.setItem(AI_KEY_STORAGE, k);
  else localStorage.removeItem(AI_KEY_STORAGE);
};

export async function testApiKey(key: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const resp = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 5,
        messages: [{ role: 'user', content: 'test' }],
      }),
    });
    if (resp.ok) return { ok: true };
    const err = await resp.text();
    return { ok: false, error: `${resp.status}: ${err.slice(0, 200)}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Schémas cibles
export const COLUMN_SCHEMAS = {
  recettes: {
    label: 'Livre de recettes',
    required: ['fse', 'patient', 'montant'],
    optional: ['date', 'attenduAMO', 'attenduAMC', 'resteCharge', 'paye', 'restePayer', 'orgAMO', 'orgAMC', 'typeLot'],
    descriptions: {
      fse: 'Numéro FSE — clé primaire',
      patient: 'Nom (et prénom) du patient',
      date: "Date de l'acte / FSE",
      montant: 'Montant total facturé',
      attenduAMO: 'Part attendue de la Sécu (AMO)',
      attenduAMC: 'Part attendue de la Mutuelle (AMC)',
      resteCharge: 'Reste à charge patient',
      paye: 'Montant déjà payé',
      restePayer: 'Reste à payer',
      orgAMO: 'Organisme AMO (Sécu)',
      orgAMC: 'Organisme AMC (Mutuelle)',
      typeLot: 'Type de lot / paiement',
    } as Record<string, string>,
  },
  secu: {
    label: 'Relevé Sécu',
    required: ['fse', 'montantAMO'],
    optional: ['patient', 'date'],
    descriptions: {
      fse: 'Numéro FSE — clé primaire',
      patient: 'Nom du patient',
      montantAMO: 'Montant remboursé par la Sécu (AMO)',
      date: 'Date de paiement',
    } as Record<string, string>,
  },
  mutuelle: {
    label: 'Relevé Mutuelle',
    required: ['fse', 'montantAMC'],
    optional: ['patient', 'prenom', 'date'],
    descriptions: {
      fse: 'Numéro FSE — clé primaire',
      patient: 'Nom du patient',
      prenom: 'Prénom du patient (si colonne séparée)',
      montantAMC: 'Montant remboursé par la Mutuelle (AMC)',
      date: 'Date de paiement',
    } as Record<string, string>,
  },
} as const;

export type FileType = keyof typeof COLUMN_SCHEMAS;

// Patterns heuristiques
const PATTERNS: Record<string, (string | RegExp)[]> = {
  fse: ['FSE', /N.*FSE/, /NUM.*FSE/, /N.*FACTUR/],
  patient: ['PATIENT', 'NOM PATIENT', 'NOM ET PRENOM', /^NOM$/],
  prenom: ['PRENOM', 'PRÉNOM'],
  date: ['DATE FSE', 'DATE ACTE', 'DATE SOINS', 'DATE'],
  montant: ['MONTANT FACTURE', 'MONTANT TOTAL', 'TOTAL FACTURE', 'MONTANT'],
  attenduAMO: ['AMO ORTHALIS', 'MONTANT AMO ORTH', 'PART AMO', 'ATTENDU AMO'],
  attenduAMC: ['AMC ORTHALIS', 'MONTANT AMC ORTH', 'PART AMC', 'ATTENDU AMC'],
  resteCharge: ['RESTE A CHARGE', 'RESTE CHARGE', 'RAC'],
  paye: ['MONTANT PAYE', 'PAYE', 'REGLE'],
  restePayer: ['RESTE A PAYER', 'RESTE PAYER', 'IMPAYE'],
  orgAMO: [/^AMO$/, 'CAISSE'],
  orgAMC: [/^AMC$/, 'MUTUELLE'],
  typeLot: ['TYPE LOT', 'LOT'],
  montantAMO: ['MONTANT AMO', 'AMO REMBOURSE', /^AMO$/],
  montantAMC: ['MONTANT AMC', 'MONTANT REGLE', 'MONTANT REMBOURSE', /^AMC$/],
};

export function heuristicMap(headers: string[], fileType: FileType): Record<string, string> {
  const schema = COLUMN_SCHEMAS[fileType];
  const mapping: Record<string, string> = {};
  const allFields: string[] = [...schema.required, ...schema.optional];
  allFields.forEach(field => {
    if (PATTERNS[field]) {
      const found = findCol(headers, PATTERNS[field]);
      if (found) mapping[field] = found;
    }
  });
  return mapping;
}

export async function aiSuggestMapping(
  headers: string[],
  sampleRows: Record<string, unknown>[],
  fileType: FileType,
  filename: string
): Promise<Omit<MappingResult, 'data' | 'headers'> | null> {
  const key = getApiKey();
  if (!key) return null;
  const schema = COLUMN_SCHEMAS[fileType];

  const fieldsList = [...schema.required, ...schema.optional]
    .map(f => `  - ${f}${(schema.required as readonly string[]).includes(f) ? ' (REQUIS)' : ''} : ${schema.descriptions[f]}`)
    .join('\n');

  const sample = sampleRows.slice(0, 3).map((r, i) =>
    `Ligne ${i + 1}: ${JSON.stringify(r).slice(0, 600)}`
  ).join('\n');

  // System prompt is static → cacheable across all mapping calls
  const systemPrompt = `Tu es un agent expert en analyse de fichiers Excel comptables (cabinet dentaire France).
Objectif : mapper les colonnes du fichier vers un schéma cible normalisé.

CONTRAINTES :
- Tu DOIS trouver une colonne pour chaque champ REQUIS. Si aucune ne correspond (ex: pas de FSE), propose une clé synthétique via "syntheticKey".
- Pour chaque champ, indique le NOM EXACT de l'en-tête source (copié-collé), ou null si absent.
- Donne un score de confiance global (0-100).

Réponds UNIQUEMENT en JSON strict (pas de markdown) :
{
  "mapping": { "fse": "<header exact>", "patient": "...", ... },
  "syntheticKey": null | { "fields": ["header1"], "separator": "|" },
  "confidence": 0-100,
  "warnings": ["..."],
  "notes": "explication courte"
}`;

  const prompt = `TYPE DE FICHIER : ${schema.label}
NOM DU FICHIER : ${filename || 'inconnu'}

COLONNES DÉTECTÉES (en-têtes bruts) :
${headers.map((h, i) => `  ${i + 1}. "${h}"`).join('\n')}

ÉCHANTILLON (3 premières lignes) :
${sample}

CHAMPS CIBLES À IDENTIFIER :
${fieldsList}`;

  try {
    const resp = await fetchWithRetry(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 1500,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!resp.ok) throw new Error(`API ${resp.status}`);
    const data = await resp.json();
    const text = data.content?.[0]?.text || '';
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    return {
      mapping: parsed.mapping || {},
      syntheticKey: parsed.syntheticKey || null,
      confidence: parsed.confidence ?? 50,
      warnings: parsed.warnings || [],
      notes: parsed.notes || '',
      aiUsed: true,
    };
  } catch (err) {
    console.warn('[IA mapping] erreur:', (err as Error).message);
    return null;
  }
}

export async function smartLoadFile(
  file: File,
  fileType: FileType,
  readXlsxFn: (f: File) => Promise<Record<string, unknown>[]>
): Promise<MappingResult> {
  const data = await readXlsxFn(file);
  if (!data.length) throw new Error('Fichier vide');
  const headers = Object.keys(data[0]);

  const heuristic = heuristicMap(headers, fileType);
  const aiResult = getApiKey() ? await aiSuggestMapping(headers, data, fileType, file.name) : null;

  const finalMapping = { ...heuristic, ...(aiResult?.mapping || {}) };
  Object.keys(finalMapping).forEach(k => {
    if (!finalMapping[k] || !headers.includes(finalMapping[k])) delete finalMapping[k];
  });

  const reqCount = COLUMN_SCHEMAS[fileType].required.length;
  const hasAllReq = (COLUMN_SCHEMAS[fileType].required as readonly string[]).every(f => finalMapping[f] || (f === 'fse' && aiResult?.syntheticKey));

  return {
    data,
    headers,
    mapping: finalMapping,
    syntheticKey: aiResult?.syntheticKey || null,
    confidence: aiResult?.confidence ?? (hasAllReq ? 75 : 30),
    warnings: aiResult?.warnings || [],
    notes: aiResult?.notes || (getApiKey() ? '' : 'Mode heuristique (pas de clé IA)'),
    aiUsed: !!aiResult,
  };
}

// Normalise un dataset selon le mapping pour que les parseurs reconnaissent les colonnes
export function applyMappingToDataset(
  data: Record<string, unknown>[],
  mappingInfo: MappingResult | null
): Record<string, unknown>[] {
  if (!data || !data.length || !mappingInfo) return data;
  const { mapping, syntheticKey } = mappingInfo;

  const ALIAS: Record<string, string> = {
    fse: 'FSE', patient: 'PATIENT', prenom: 'PRENOM', date: 'DATE FSE',
    montant: 'MONTANT FACTURE', attenduAMO: 'AMO ORTHALIS', attenduAMC: 'AMC ORTHALIS',
    resteCharge: 'RESTE A CHARGE', paye: 'MONTANT PAYE', restePayer: 'RESTE A PAYER',
    orgAMO: 'AMO', orgAMC: 'AMC', typeLot: 'TYPE LOT',
    montantAMO: 'MONTANT AMO', montantAMC: 'MONTANT AMC',
  };

  return data.map(row => {
    const enriched: Record<string, unknown> = { ...row };
    if (syntheticKey && !mapping.fse) {
      const sep = syntheticKey.separator || '|';
      const parts = syntheticKey.fields.map(f => String(row[f] ?? '').trim()).filter(Boolean);
      enriched['FSE'] = parts.join(sep);
    }
    Object.entries(mapping).forEach(([field, header]) => {
      if (header && row[header] !== undefined && ALIAS[field]) {
        if (enriched[ALIAS[field]] === undefined || enriched[ALIAS[field]] === '') {
          enriched[ALIAS[field]] = row[header];
        }
      }
    });
    return enriched;
  });
}

// ─── Vérification IA des cas douteux ───
export interface SuspectCase {
  row: {
    fse: string;
    patient: string;
    date: string;
    montant: number;
    attenduAMC: number;
  };
  candidates?: { source: string; fse: string; patient: string; montant: number; score?: number; date?: string }[];
  matched?: { patient: string; montant: number; source: string } | null;
  warnings?: string[];
}

export async function verifyCases(cas: SuspectCase[]): Promise<{
  verdicts: { id: number; verdict: string; chosen?: string; reason: string }[];
  usage: { input_tokens: number; output_tokens: number };
  durationMs: number;
}> {
  const key = getApiKey();
  if (!key) throw new Error('Aucune clé API enregistrée');

  const lines: string[] = [];
  cas.forEach((c, i) => {
    const r = c.row;
    lines.push(`CAS ${i + 1} — FSE ${r.fse}`);
    lines.push(`  Patient en recettes : "${r.patient}"`);
    lines.push(`  Date : ${r.date || 'N/A'} | Facturé : ${r.montant}€ | Attendu AMC : ${r.attenduAMC}€`);
    if (c.candidates && c.candidates.length) {
      lines.push(`  CANDIDATS :`);
      c.candidates.forEach((cand, j) => {
        lines.push(`    ${String.fromCharCode(65 + j)}. Source: ${cand.source} | FSE: ${cand.fse} | Patient: "${cand.patient}" | Montant: ${cand.montant}€`);
      });
    }
    if (c.matched) {
      lines.push(`  DÉJÀ MATCHÉ : "${c.matched.patient}" — ${c.matched.montant}€ (${c.matched.source})`);
    }
    if (c.warnings?.length) lines.push(`  Warnings : ${c.warnings.join(' ; ')}`);
    lines.push('');
  });

  // System prompt is static → cacheable
  const verifySystemPrompt = `Tu es un expert en recouvrement médical (cabinet dentaire France).
Analyse les CAS DOUTEUX de rapprochement. Pour chacun, dis :
- VALIDE : bon paiement
- INVALIDE : mauvais paiement (collision FSE, homonyme)
- DOUTEUX : impossible de trancher

JSON strict UNIQUEMENT :
{"cases":[{"id":1,"verdict":"VALIDE|INVALIDE|DOUTEUX","chosen":"A|B|null","reason":"courte explication"}]}`;

  const prompt = `CAS :
${lines.join('\n')}`;

  const t0 = Date.now();
  const resp = await fetchWithRetry(AI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 2000,
      system: [{ type: 'text', text: verifySystemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!resp.ok) throw new Error(`API ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const data = await resp.json();
  const text = data.content?.[0]?.text || '';
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  const parsed = match ? JSON.parse(match[0]) : { cases: [] };

  return {
    verdicts: parsed.cases || [],
    usage: data.usage || { input_tokens: 0, output_tokens: 0 },
    durationMs: Date.now() - t0,
  };
}
