import type { RecetteRow, SecuRow, MutuelleRow, ImpayeRow, ResultItem, AnalysisResults, Statut } from '@/types';
import { toNum, toStr, normName, findCol, getVal, nameScore } from './utils';

export function parseRecettes(data: Record<string, unknown>[]): RecetteRow[] {
  if (!data.length) return [];
  const h = Object.keys(data[0]);
  const cFSE = findCol(h, ['FSE', /N.*FSE/]);
  const cPatient = findCol(h, ['PATIENT']);
  const cNom = findCol(h, [/^NOM$/]);
  const cPrenom = findCol(h, ['PRENOM', 'PRÉNOM']);
  const cDate = findCol(h, ['DATE FSE', 'DATE ENCAISSEMENT', 'DATE']);
  const cMontant = findCol(h, ['MONTANT FACTURE', 'MONTANT']);
  const cAMO = findCol(h, ['AMO ORTHALIS', 'MONTANT AMO ORTH']);
  const cAMC = findCol(h, ['AMC ORTHALIS', 'MONTANT AMC ORTH']);
  const cReste = findCol(h, ['RESTE A CHARGE', 'RESTE CHARGE']);
  const cPaye = findCol(h, ['MONTANT PAYE']);
  const cRestePayer = findCol(h, ['RESTE A PAYER']);
  const cOrgAMO = h.find(x => normName(x) === 'AMO') || findCol(h, [/^AMO$/, 'CAISSE']);
  const cOrgAMC = h.find(x => normName(x) === 'AMC') || findCol(h, [/^AMC$/, 'MUTUELLE']);
  const cTypeLot = findCol(h, ['TYPE LOT']);
  const cMode = findCol(h, ['MODE DE PAIEMENT', 'MODE PAIEMENT', 'MODE']);

  return data.map(r => {
    const fse = toStr(getVal(r, cFSE));
    if (!fse) return null;
    let patient = toStr(getVal(r, cPatient));
    if (!patient && cNom) {
      const nom = toStr(getVal(r, cNom));
      const prenom = cPrenom ? toStr(getVal(r, cPrenom)) : '';
      patient = prenom ? `${nom} ${prenom}` : nom;
    }
    const mode = toStr(getVal(r, cMode)).toUpperCase();
    const mutuelle = toStr(getVal(r, cOrgAMC ?? null));
    return {
      fse, patient, patientNorm: normName(patient),
      date: toStr(getVal(r, cDate)),
      montant: toNum(getVal(r, cMontant)),
      attenduAMO: toNum(getVal(r, cAMO)),
      attenduAMC: toNum(getVal(r, cAMC)),
      resteCharge: toNum(getVal(r, cReste)),
      paye: toNum(getVal(r, cPaye)),
      restePayer: toNum(getVal(r, cRestePayer)),
      orgAMO: toStr(getVal(r, cOrgAMO ?? null)),
      orgAMC: mutuelle,
      typeLot: toStr(getVal(r, cTypeLot)),
      isCMU: mutuelle.toUpperCase().includes('CMU'),
      mode,
    };
  }).filter((r): r is RecetteRow => r !== null);
}

export function parseSecu(data: Record<string, unknown>[]): SecuRow[] {
  if (!data.length) return [];
  const h = Object.keys(data[0]);
  const cFSE = findCol(h, ['FSE', /N.*FSE/]);
  const cPatient = findCol(h, ['PATIENT']);
  const cAMO = findCol(h, ['MONTANT AMO', 'AMO', 'MONTANT']);
  const cDate = findCol(h, ['DATE PAIEMENT', 'DATE']);

  return data.map(r => {
    const fse = toStr(getVal(r, cFSE));
    if (!fse) return null;
    return {
      fse,
      patient: toStr(getVal(r, cPatient)),
      patientNorm: normName(toStr(getVal(r, cPatient))),
      montantAMO: toNum(getVal(r, cAMO)),
      date: toStr(getVal(r, cDate)),
    };
  }).filter((r): r is SecuRow => r !== null);
}

export function parseMutuelle(data: Record<string, unknown>[], filename: string): MutuelleRow[] {
  if (!data.length) return [];
  const h = Object.keys(data[0]);
  const fnUp = (filename || '').toUpperCase();

  const cFSE = findCol(h, ['FSE', /N.*FSE/]);
  if (!cFSE) return [];

  let cMontant: string | null, cPatient: string | null, cPrenom: string | null, type: string;

  if (fnUp.includes('ALMERYS') || findCol(h, ['MONTANT AMC'])) {
    type = 'Almerys';
    cMontant = findCol(h, ['MONTANT AMC']);
    cPatient = findCol(h, ['PATIENT']) || h.find(x => normName(x).includes('PATIENT')) || h[3] || null;
    cPrenom = findCol(h, ['PRENOM']);
  } else if (fnUp.includes('ISANTE') || fnUp.includes('SANTE') || findCol(h, ['MONTANT REGLE'])) {
    type = 'iSanté';
    cMontant = findCol(h, ['MONTANT REGLE']);
    cPatient = null;
    cPrenom = null;
  } else if (fnUp.includes('VIAMEDIS') || findCol(h, ['NOM'])) {
    type = 'Viamedis';
    cMontant = findCol(h, ['MONTANT AMC', 'AMC']);
    cPatient = findCol(h, ['NOM']);
    cPrenom = null;
  } else {
    type = 'Autre';
    cMontant = findCol(h, ['MONTANT AMC', 'MONTANT REGLE', 'MONTANT', 'AMC']);
    cPatient = findCol(h, ['PATIENT', 'NOM']);
    cPrenom = findCol(h, ['PRENOM']);
  }

  return data.map(r => {
    const fse = toStr(getVal(r, cFSE));
    if (!fse) return null;
    let patient = toStr(getVal(r, cPatient));
    if (cPrenom) {
      const prenom = toStr(getVal(r, cPrenom));
      if (prenom) patient = patient + ' ' + prenom;
    }
    return {
      fse, type, patient, patientNorm: normName(patient),
      montantAMC: toNum(getVal(r, cMontant)),
      date: toStr(getVal(r, 'DATE') || getVal(r, cMontant ? 'DATE PAIEMENT' : '')),
    };
  }).filter((r): r is MutuelleRow => r !== null);
}

// ─── Parser CSV d'impayés reportés ───
export function parseImpayesCSV(csvText: string): ImpayeRow[] {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headerLine = lines[0];
  const sep = headerLine.includes(';') ? ';' : ',';
  const headers = headerLine.split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
  const idx = (name: string) => {
    const n = normName(name);
    return headers.findIndex(h => normName(h) === n || normName(h).includes(n));
  };
  const iFse = idx('FSE');
  const iPatient = idx('PATIENT');
  const iDate = idx('DATE');
  const iMontant = idx('MONTANT');
  const iReste = idx('RESTE CHARGE');
  const iAMO = idx('ATTENDU AMO');
  const iAMC = idx('ATTENDU AMC');
  const iMois = idx('MOIS ORIGINE');

  const now = new Date();
  return lines.slice(1).map(line => {
    const cells = line.split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
    const fse = cells[iFse] || '';
    if (!fse) return null;
    const patient = cells[iPatient] || '';
    const moisOrigine = cells[iMois] || '';
    let ageMois = 1;
    if (moisOrigine && /^\d{4}-\d{2}$/.test(moisOrigine)) {
      const [y, m] = moisOrigine.split('-').map(Number);
      ageMois = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
    }
    return {
      fse, patient, patientNorm: normName(patient),
      date: cells[iDate] || '',
      montant: toNum(cells[iMontant]),
      resteCharge: toNum(cells[iReste]),
      attenduAMO: toNum(cells[iAMO]),
      attenduAMC: toNum(cells[iAMC]),
      moisOrigine, ageMois: Math.max(1, ageMois),
    } as ImpayeRow;
  }).filter((r): r is ImpayeRow => r !== null);
}

// ─── Agrégation par FSE + sous-groupes par patient ───

type FsePatientGroup<T> = {
  total: number;
  lines: T[];
  patients: Map<string, { total: number; lines: T[] }>;
};

function aggregateByFSEAndPatient<T extends { fse: string; patientNorm: string }>(
  rows: T[],
  valueKey: keyof T
): Map<string, FsePatientGroup<T>> {
  const map = new Map<string, FsePatientGroup<T>>();
  rows.forEach(r => {
    let existing = map.get(r.fse);
    if (!existing) {
      existing = { total: 0, lines: [] as T[], patients: new Map() };
      map.set(r.fse, existing);
    }
    const val = Number(r[valueKey]) || 0;
    existing.total += val;
    existing.lines.push(r);
    const pKey = r.patientNorm || 'INCONNU';
    let pExisting = existing.patients.get(pKey);
    if (!pExisting) {
      pExisting = { total: 0, lines: [] as T[] };
      existing.patients.set(pKey, pExisting);
    }
    pExisting.total += val;
    pExisting.lines.push(r);
  });
  return map;
}

function findBestPatientMatch<T extends { patientNorm: string }>(
  patientNorm: string,
  patients: Map<string, { total: number; lines: T[] }>
): { key: string; score: number; total: number; lines: T[] } | null {
  let best: { key: string; score: number; total: number; lines: T[] } | null = null;
  patients.forEach((data, pKey) => {
    const s = nameScore(patientNorm, pKey);
    if (!best || s > best.score) {
      best = { key: pKey, score: s, total: data.total, lines: data.lines };
    }
  });
  return best;
}

// ─── Rapprochement principal ───

export function rapprochement(
  recettes: RecetteRow[],
  secuRows: SecuRow[],
  mutRows: MutuelleRow[],
  impayesReportes: ImpayeRow[] = [],
  moisCourant: string = ''
): AnalysisResults {
  const secuMap = aggregateByFSEAndPatient(secuRows, 'montantAMO');
  const mutMap = aggregateByFSEAndPatient(mutRows, 'montantAMC');

  const results: ResultItem[] = [];
  const usedSecuKeys = new Set<string>();
  const usedMutKeys = new Set<string>();

  recettes.forEach(rec => {
    let recuAMO = 0, recuAMC = 0;
    let mutSources = '';
    const warnings: string[] = [];
    let matchType = 'fse+nom';
    let secuDetail: { patient: string; montantAMO: number } | undefined;
    let mutDetail: { lines: { patient: string; montantAMC: number; type: string }[] } | undefined;

    // ── SECU : match par FSE + meilleur nom ──
    let secuNameScore = 100;
    const secuFSEHit = secuMap.get(rec.fse);
    if (secuFSEHit && rec.patientNorm) {
      const best = findBestPatientMatch(rec.patientNorm, secuFSEHit.patients);
      if (best && best.score >= 50) {
        recuAMO = best.total;
        secuNameScore = best.score;
        secuDetail = { patient: best.lines[0].patient, montantAMO: best.total };
        usedSecuKeys.add(`${rec.fse}::${best.key}`);
        if (best.score < 70) {
          warnings.push(`⚠️ Nom approx. (${best.score}%): Sécu="${best.lines[0].patient}"`);
        }
      } else if (secuFSEHit.patients.size === 1 && !rec.patientNorm) {
        // Pas de nom côté recettes → on prend le seul patient dispo
        const only = [...secuFSEHit.patients.values()][0];
        recuAMO = only.total;
        secuDetail = { patient: only.lines[0].patient, montantAMO: only.total };
        usedSecuKeys.add(`${rec.fse}::${[...secuFSEHit.patients.keys()][0]}`);
        warnings.push('⚠️ Pas de nom patient côté recettes, match FSE seul');
      } else {
        warnings.push(`⚠️ FSE ${rec.fse} en Sécu mais patient différent (collision FSE recyclée)`);
        secuNameScore = 0;
      }
    } else if (secuFSEHit && !rec.patientNorm) {
      // Pas de nom → match FSE seul si un seul patient
      if (secuFSEHit.patients.size === 1) {
        const only = [...secuFSEHit.patients.values()][0];
        recuAMO = only.total;
        secuDetail = { patient: only.lines[0].patient, montantAMO: only.total };
        usedSecuKeys.add(`${rec.fse}::${[...secuFSEHit.patients.keys()][0]}`);
      }
    }

    // ── MUTUELLE : match par FSE + meilleur nom ──
    let mutNameScore = 100;
    const mutFSEHit = mutMap.get(rec.fse);
    if (mutFSEHit && rec.patientNorm) {
      const best = findBestPatientMatch(rec.patientNorm, mutFSEHit.patients);
      if (best && best.score >= 50) {
        recuAMC = best.total;
        mutNameScore = best.score;
        const types = new Set(best.lines.map((l: MutuelleRow) => l.type));
        mutSources = [...types].join(', ');
        mutDetail = { lines: best.lines.map((l: MutuelleRow) => ({ patient: l.patient, montantAMC: l.montantAMC, type: l.type })) };
        usedMutKeys.add(`${rec.fse}::${best.key}`);
        if (best.score < 70) {
          warnings.push(`⚠️ Nom approx. (${best.score}%): Mut="${best.lines[0].patient}"`);
        }
      } else {
        warnings.push(`⚠️ FSE ${rec.fse} en Mutuelle mais patient différent (collision FSE recyclée)`);
        mutNameScore = 0;
      }
    }

    const totalRecu = recuAMO + recuAMC;
    const ecart = rec.montant - rec.resteCharge - totalRecu;
    const ecartAbs = Math.abs(ecart);

    // ── Score de confiance ──
    let score = 0;
    if (recuAMO > 0 || recuAMC > 0) score += 30;
    const bestName = Math.min(
      recuAMO > 0 ? secuNameScore : 100,
      recuAMC > 0 ? mutNameScore : 100
    );
    score += Math.round((bestName / 100) * 30);
    const expectedTotal = rec.montant - rec.resteCharge;
    if (expectedTotal > 0 && totalRecu > 0) {
      const ecartPct = Math.abs(ecart) / expectedTotal;
      score += ecartPct <= 0.05 ? 25 : ecartPct <= 0.20 ? 15 : 5;
    }
    if (recuAMO > 0 && recuAMC > 0) score += 15;
    else if (recuAMO > 0 || recuAMC > 0) score += 10;
    const confidence = Math.min(score, 100);

    let statut: Statut;
    if (recuAMO === 0 && recuAMC === 0) {
      statut = 'IMPAYÉ';
    } else if (confidence < 60) {
      statut = 'À VÉRIFIER';
    } else if (ecartAbs <= 0.02) {
      statut = 'OK';
    } else if (rec.isCMU && Math.abs(rec.montant - recuAMO) <= 0.02) {
      statut = 'OK';
    } else {
      statut = 'ÉCART';
    }

    results.push({
      fse: rec.fse, patient: rec.patient, patientNorm: rec.patientNorm,
      date: rec.date, montant: rec.montant,
      attenduAMO: rec.attenduAMO, attenduAMC: rec.attenduAMC, resteCharge: rec.resteCharge,
      recuAMO, recuAMC, totalRecu, ecart, statut, matchType, mutSources,
      isCMU: rec.isCMU, confidence, warnings, secuDetail, mutDetail,
    });
  });

  // ── 2ème passe : réconciliation avec impayés du mois précédent ──
  impayesReportes.forEach(imp => {
    let recuAMO = 0, recuAMC = 0;
    let secuDetail: { patient: string; montantAMO: number } | undefined;
    let mutDetail: { lines: { patient: string; montantAMC: number; type: string }[] } | undefined;
    let mutSources = '';
    let resolvedBy: ResultItem['resolvedBy'];

    const secuFSE = secuMap.get(imp.fse);
    if (secuFSE) {
      const best = findBestPatientMatch(imp.patientNorm, secuFSE.patients);
      if (best && best.score >= 50 && !usedSecuKeys.has(`${imp.fse}::${best.key}`)) {
        recuAMO = best.total;
        secuDetail = { patient: best.lines[0].patient, montantAMO: best.total };
        usedSecuKeys.add(`${imp.fse}::${best.key}`);
        resolvedBy = { type: 'secu', montant: best.total, patient: best.lines[0].patient, date: best.lines[0].date };
      }
    }
    const mutFSE = mutMap.get(imp.fse);
    if (mutFSE) {
      const best = findBestPatientMatch(imp.patientNorm, mutFSE.patients);
      if (best && best.score >= 50 && !usedMutKeys.has(`${imp.fse}::${best.key}`)) {
        recuAMC = best.total;
        const types = new Set(best.lines.map((l: MutuelleRow) => l.type));
        mutSources = [...types].join(', ');
        mutDetail = { lines: best.lines.map((l: MutuelleRow) => ({ patient: l.patient, montantAMC: l.montantAMC, type: l.type })) };
        usedMutKeys.add(`${imp.fse}::${best.key}`);
        if (!resolvedBy) resolvedBy = { type: 'mutuelle', montant: best.total, patient: best.lines[0].patient, date: best.lines[0].date };
      }
    }

    const totalRecu = recuAMO + recuAMC;
    const ecart = imp.montant - imp.resteCharge - totalRecu;
    const isResolved = totalRecu > 0;
    const statut: Statut = isResolved ? 'RÉGLÉ M-1' : (imp.ageMois >= 2 ? 'IMPAYÉ PERSISTANT' : 'IMPAYÉ');

    results.push({
      fse: imp.fse, patient: imp.patient, patientNorm: imp.patientNorm,
      date: imp.date, montant: imp.montant,
      attenduAMO: imp.attenduAMO, attenduAMC: imp.attenduAMC, resteCharge: imp.resteCharge,
      recuAMO, recuAMC, totalRecu, ecart,
      statut, matchType: isResolved ? 'resolu-m1' : 'impaye-reporte',
      mutSources, isCMU: false,
      confidence: isResolved ? 95 : 80,
      warnings: isResolved
        ? [`✅ Impayé de ${imp.moisOrigine} réglé ce mois (${imp.ageMois} mois d'écart)`]
        : [`⏳ Impayé de ${imp.moisOrigine} toujours non réglé (${imp.ageMois} mois)`],
      secuDetail, mutDetail, moisOrigine: imp.moisOrigine, ageMois: imp.ageMois, resolvedBy,
    });
  });

  // ── Paiements d'actes antérieurs : (FSE, patient) non matchés ──
  secuMap.forEach((fseGroup, fse) => {
    fseGroup.patients.forEach((pData, pKey) => {
      if (usedSecuKeys.has(`${fse}::${pKey}`)) return;
      results.push({
        fse, patient: pData.lines[0].patient, patientNorm: pKey,
        date: pData.lines[0].date, montant: 0,
        attenduAMO: 0, attenduAMC: 0, resteCharge: 0,
        recuAMO: pData.total, recuAMC: 0, totalRecu: pData.total, ecart: 0,
        statut: impayesReportes.length > 0 ? 'ANTÉRIEUR INCONNU' : 'ANTÉRIEUR', matchType: 'anterieur-secu', mutSources: '', isCMU: false,
        confidence: impayesReportes.length > 0 ? 70 : 100,
        warnings: [impayesReportes.length > 0
          ? '⚠️ Paiement Sécu non rattaché (ni FSE du mois, ni impayé reporté — vérifier origine)'
          : 'Paiement Sécu d\u2019un acte antérieur (pas de FSE+patient correspondant dans les recettes)'],
      });
    });
  });
  mutMap.forEach((fseGroup, fse) => {
    fseGroup.patients.forEach((pData, pKey) => {
      if (usedMutKeys.has(`${fse}::${pKey}`)) return;
      const matchedLines = pData.lines;
      const types = new Set(matchedLines.map(l => l.type));
      results.push({
        fse, patient: matchedLines[0].patient, patientNorm: pKey,
        date: matchedLines[0].date, montant: 0,
        attenduAMO: 0, attenduAMC: 0, resteCharge: 0,
        recuAMO: 0, recuAMC: pData.total, totalRecu: pData.total, ecart: 0,
        statut: impayesReportes.length > 0 ? 'ANTÉRIEUR INCONNU' : 'ANTÉRIEUR', matchType: 'anterieur-mut', mutSources: [...types].join(', '), isCMU: false,
        confidence: impayesReportes.length > 0 ? 70 : 100,
        warnings: [impayesReportes.length > 0
          ? '⚠️ Paiement Mutuelle non rattaché (ni FSE du mois, ni impayé reporté — vérifier origine)'
          : 'Paiement Mutuelle d\u2019un acte antérieur (pas de FSE+patient correspondant dans les recettes)'],
      });
    });
  });

  return { items: results, recap: buildRecap(results) };
}

export function buildRecap(items: ResultItem[]) {
  const ANT_STATUTS: Statut[] = ['ANTÉRIEUR', 'ANTÉRIEUR INCONNU', 'RÉGLÉ M-1', 'IMPAYÉ PERSISTANT'];
  const items_mois = items.filter(r => !ANT_STATUTS.includes(r.statut) && r.statut !== 'ORPHELIN');
  const items_ant = items.filter(r => r.statut === 'ANTÉRIEUR' || r.statut === 'ANTÉRIEUR INCONNU');
  const items_orph = items.filter(r => r.statut === 'ORPHELIN');
  const items_regleM1 = items.filter(r => r.statut === 'RÉGLÉ M-1');
  const items_persist = items.filter(r => r.statut === 'IMPAYÉ PERSISTANT');
  const totalFact = items_mois.reduce((s, r) => s + r.montant, 0);
  const totalAMO = items_mois.reduce((s, r) => s + r.recuAMO, 0);
  const totalAMC = items_mois.reduce((s, r) => s + r.recuAMC, 0);
  const totalRecu = totalAMO + totalAMC;
  const reste = items_mois.reduce((s, r) => s + Math.max(r.ecart, 0), 0);
  const taux = totalFact ? (totalRecu / totalFact) * 100 : 0;

  const totalAnterieurAMO = items_ant.reduce((s, r) => s + r.recuAMO, 0);
  const totalAnterieurAMC = items_ant.reduce((s, r) => s + r.recuAMC, 0);

  return {
    totalFact, totalAMO, totalAMC, totalRecu, reste, taux,
    nOK: items_mois.filter(r => r.statut === 'OK').length,
    nEcart: items_mois.filter(r => r.statut === 'ÉCART').length,
    nImpaye: items_mois.filter(r => r.statut === 'IMPAYÉ').length,
    nVerif: items_mois.filter(r => r.statut === 'À VÉRIFIER').length,
    nOrphelin: items_orph.length,
    nAnterieur: items_ant.length,
    totalAnterieurAMO,
    totalAnterieurAMC,
    nRegleM1: items_regleM1.length,
    nImpayePersistant: items_persist.length,
    nAnterieurInconnu: items.filter(r => r.statut === 'ANTÉRIEUR INCONNU').length,
    totalRegleM1: items_regleM1.reduce((s, r) => s + r.totalRecu, 0),
    totalImpayePersistant: items_persist.reduce((s, r) => s + r.montant, 0),
    total: items.length,
  };
}
