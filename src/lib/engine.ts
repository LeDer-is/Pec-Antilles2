import type { RecetteRow, SecuRow, MutuelleRow, ResultItem, AnalysisResults, Statut } from '@/types';
import { toNum, toStr, normName, findCol, getVal, nameScore } from './utils';

export function parseRecettes(data: Record<string, unknown>[]): RecetteRow[] {
  if (!data.length) return [];
  const h = Object.keys(data[0]);
  const cFSE = findCol(h, ['FSE', /N.*FSE/]);
  const cPatient = findCol(h, ['PATIENT']);
  const cDate = findCol(h, ['DATE FSE', 'DATE']);
  const cMontant = findCol(h, ['MONTANT FACTURE']);
  const cAMO = findCol(h, ['AMO ORTHALIS', 'MONTANT AMO ORTH']);
  const cAMC = findCol(h, ['AMC ORTHALIS', 'MONTANT AMC ORTH']);
  const cReste = findCol(h, ['RESTE A CHARGE', 'RESTE CHARGE']);
  const cPaye = findCol(h, ['MONTANT PAYE']);
  const cRestePayer = findCol(h, ['RESTE A PAYER']);
  const cOrgAMO = h.find(x => normName(x) === 'AMO') || findCol(h, [/^AMO$/]);
  const cOrgAMC = h.find(x => normName(x) === 'AMC') || findCol(h, [/^AMC$/]);
  const cTypeLot = findCol(h, ['TYPE LOT']);

  return data.map(r => {
    const fse = toStr(getVal(r, cFSE));
    if (!fse) return null;
    return {
      fse,
      patient: toStr(getVal(r, cPatient)),
      patientNorm: normName(toStr(getVal(r, cPatient))),
      date: toStr(getVal(r, cDate)),
      montant: toNum(getVal(r, cMontant)),
      attenduAMO: toNum(getVal(r, cAMO)),
      attenduAMC: toNum(getVal(r, cAMC)),
      resteCharge: toNum(getVal(r, cReste)),
      paye: toNum(getVal(r, cPaye)),
      restePayer: toNum(getVal(r, cRestePayer)),
      orgAMO: toStr(getVal(r, cOrgAMO ?? null)),
      orgAMC: toStr(getVal(r, cOrgAMC ?? null)),
      typeLot: toStr(getVal(r, cTypeLot)),
      isCMU: toStr(getVal(r, cOrgAMC ?? null)).toUpperCase().includes('CMU'),
    };
  }).filter((r): r is RecetteRow => r !== null);
}

export function parseSecu(data: Record<string, unknown>[]): SecuRow[] {
  if (!data.length) return [];
  const h = Object.keys(data[0]);
  const cFSE = findCol(h, ['FSE', /N.*FSE/]);
  const cPatient = findCol(h, ['PATIENT']);
  const cAMO = findCol(h, ['MONTANT AMO', 'AMO']);
  const cDate = findCol(h, ['DATE']);

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
      fse,
      type,
      patient,
      patientNorm: normName(patient),
      montantAMC: toNum(getVal(r, cMontant)),
      date: toStr(getVal(r, 'DATE') || getVal(r, cMontant ? 'DATE PAIEMENT' : '')),
    };
  }).filter((r): r is MutuelleRow => r !== null);
}

function aggregateByFSE<T extends { fse: string }>(
  rows: T[],
  valueKey: keyof T
): Map<string, { total: number; lines: T[] }> {
  const map = new Map<string, { total: number; lines: T[] }>();
  rows.forEach(r => {
    const existing = map.get(r.fse) || { total: 0, lines: [] };
    existing.total += Number(r[valueKey]) || 0;
    existing.lines.push(r);
    map.set(r.fse, existing);
  });
  return map;
}

export function rapprochement(
  recettes: RecetteRow[],
  secuRows: SecuRow[],
  mutRows: MutuelleRow[]
): AnalysisResults {
  const secuMap = aggregateByFSE(secuRows, 'montantAMO');
  const mutMap = aggregateByFSE(mutRows, 'montantAMC');

  const results: ResultItem[] = [];
  const recFSEs = new Set(recettes.map(r => r.fse));

  recettes.forEach(rec => {
    let recuAMO = 0, recuAMC = 0;
    let mutSources = '';
    const warnings: string[] = [];
    let confidence = 100;
    let matchType = 'fse';
    let secuDetail: { patient: string; montantAMO: number } | undefined;
    let mutDetail: { lines: { patient: string; montantAMC: number; type: string }[] } | undefined;

    // SECU match par FSE
    let secuNameScore = 100;
    const secuHit = secuMap.get(rec.fse);
    if (secuHit) {
      recuAMO = secuHit.total;
      secuDetail = { patient: secuHit.lines[0].patient, montantAMO: secuHit.total };
      if (rec.patientNorm && secuHit.lines[0].patientNorm) {
        secuNameScore = nameScore(rec.patientNorm, secuHit.lines[0].patientNorm);
        if (secuNameScore < 70) {
          warnings.push(`⚠️ FSE matche mais noms différents (${secuNameScore}%): Sécu="${secuHit.lines[0].patient}"`);
        }
      }
    }

    // MUTUELLE match par FSE
    let mutNameScore = 100;
    const mutHit = mutMap.get(rec.fse);
    if (mutHit) {
      recuAMC = mutHit.total;
      const types = new Set(mutHit.lines.map(l => l.type));
      mutSources = [...types].join(', ');
      mutDetail = { lines: mutHit.lines.map(l => ({ patient: l.patient, montantAMC: l.montantAMC, type: l.type })) };
      if (rec.patientNorm && mutHit.lines[0].patientNorm) {
        mutNameScore = nameScore(rec.patientNorm, mutHit.lines[0].patientNorm);
        if (mutNameScore < 70 && mutHit.lines[0].patientNorm) {
          warnings.push(`⚠️ FSE matche mais noms différents (${mutNameScore}%): Mut="${mutHit.lines[0].patient}"`);
        }
      }
    }

    const totalRecu = recuAMO + recuAMC;
    const ecart = rec.montant - rec.resteCharge - totalRecu;
    const ecartAbs = Math.abs(ecart);

    // ─── Score de confiance pondéré ───
    // 4 facteurs : FSE match (30pts), nom (30pts), montant cohérence (25pts), couverture (15pts)
    let score = 0;
    // FSE match : 30pts si trouvé dans sécu ou mutuelle
    if (secuHit || mutHit) score += 30;
    // Nom : 30pts pondéré par le meilleur score nom
    const bestName = Math.min(secuHit ? secuNameScore : 100, mutHit ? mutNameScore : 100);
    score += Math.round((bestName / 100) * 30);
    // Montant cohérence : 25pts si écart < 5%, 15pts si < 20%, 5pts sinon
    const expectedTotal = rec.montant - rec.resteCharge;
    if (expectedTotal > 0 && totalRecu > 0) {
      const ecartPct = Math.abs(ecart) / expectedTotal;
      score += ecartPct <= 0.05 ? 25 : ecartPct <= 0.20 ? 15 : 5;
    } else if (totalRecu === 0) {
      score += 0;
    }
    // Couverture : 15pts si AMO+AMC, 10pts si un seul, 0 sinon
    if (recuAMO > 0 && recuAMC > 0) score += 15;
    else if (recuAMO > 0 || recuAMC > 0) score += 10;
    confidence = Math.min(score, 100);

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
      fse: rec.fse,
      patient: rec.patient,
      patientNorm: rec.patientNorm,
      date: rec.date,
      montant: rec.montant,
      attenduAMO: rec.attenduAMO,
      attenduAMC: rec.attenduAMC,
      resteCharge: rec.resteCharge,
      recuAMO,
      recuAMC,
      totalRecu,
      ecart,
      statut,
      matchType,
      mutSources,
      isCMU: rec.isCMU,
      confidence,
      warnings,
      secuDetail,
      mutDetail,
    });
  });

  // Orphelins : paiements sans recette
  secuMap.forEach((hit, fse) => {
    if (recFSEs.has(fse)) return;
    results.push({
      fse, patient: hit.lines[0].patient, patientNorm: hit.lines[0].patientNorm,
      date: hit.lines[0].date, montant: 0, attenduAMO: 0, attenduAMC: 0, resteCharge: 0,
      recuAMO: hit.total, recuAMC: 0, totalRecu: hit.total, ecart: -hit.total,
      statut: 'ORPHELIN', matchType: 'orphelin-secu', mutSources: '', isCMU: false,
      confidence: 100, warnings: ['Paiement Sécu sans recette correspondante'],
    });
  });
  mutMap.forEach((hit, fse) => {
    if (recFSEs.has(fse)) return;
    const types = new Set(hit.lines.map(l => l.type));
    results.push({
      fse, patient: hit.lines[0].patient, patientNorm: hit.lines[0].patientNorm,
      date: hit.lines[0].date, montant: 0, attenduAMO: 0, attenduAMC: 0, resteCharge: 0,
      recuAMO: 0, recuAMC: hit.total, totalRecu: hit.total, ecart: -hit.total,
      statut: 'ORPHELIN', matchType: 'orphelin-mut', mutSources: [...types].join(', '), isCMU: false,
      confidence: 100, warnings: ['Paiement Mutuelle sans recette correspondante'],
    });
  });

  return { items: results, recap: buildRecap(results) };
}

export function buildRecap(items: ResultItem[]) {
  const items_mois = items.filter(r => r.statut !== 'ORPHELIN');
  const items_orph = items.filter(r => r.statut === 'ORPHELIN');
  const totalFact = items_mois.reduce((s, r) => s + r.montant, 0);
  const totalAMO = items_mois.reduce((s, r) => s + r.recuAMO, 0);
  const totalAMC = items_mois.reduce((s, r) => s + r.recuAMC, 0);
  const totalRecu = totalAMO + totalAMC;
  const reste = items_mois.reduce((s, r) => s + Math.max(r.ecart, 0), 0);
  const taux = totalFact ? (totalRecu / totalFact) * 100 : 0;

  return {
    totalFact, totalAMO, totalAMC, totalRecu, reste, taux,
    nOK: items_mois.filter(r => r.statut === 'OK').length,
    nEcart: items_mois.filter(r => r.statut === 'ÉCART').length,
    nImpaye: items_mois.filter(r => r.statut === 'IMPAYÉ').length,
    nVerif: items_mois.filter(r => r.statut === 'À VÉRIFIER').length,
    nOrphelin: items_orph.length,
    total: items.length,
  };
}
