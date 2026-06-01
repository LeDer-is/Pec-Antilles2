import { useCallback } from 'react';
import type { AnalysisResults } from '@/types';
import { fmt, pct } from '@/lib/utils';

export function useExport(
  results: AnalysisResults | null,
  recettesFile: File | null,
  secuFile: File | null,
  mutuelleFiles: { file: File }[],
  setAlert: (a: { type: 'error' | 'success' | 'info'; msg: string } | null) => void,
) {
  const exportImpayes = useCallback(() => {
    if (!results) return;
    const impayes = results.items.filter(r => r.statut === 'IMPAYÉ' || r.statut === 'IMPAYÉ PERSISTANT');
    if (!impayes.length) {
      setAlert({ type: 'info', msg: 'Aucun impayé à exporter' });
      return;
    }
    const now = new Date();
    const mois = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const BOM = '\uFEFF';
    const sep = ';';
    const header = ['FSE', 'Patient', 'Date', 'Montant', 'Reste charge', 'Attendu AMO', 'Attendu AMC', 'Mois origine', 'Age mois'];
    const lines = [header.join(sep)];
    impayes.forEach(r => {
      const origine = r.moisOrigine || mois;
      const age = (r.ageMois || 0) + 1;
      lines.push([
        r.fse, `"${r.patient}"`, r.date || '', r.montant, r.resteCharge, r.attenduAMO, r.attenduAMC, origine, age,
      ].join(sep));
    });
    const blob = new Blob([BOM + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pec-impayes-a-reporter-${mois}.csv`;
    a.click();
  }, [results, setAlert]);

  const exportXLSX = useCallback(async () => {
    if (!results) return;
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    const wsData = results.items.map(r => ({
      'N° FSE': r.fse,
      'Patient': r.patient,
      'Date': r.date || '',
      'Facturé': r.montant,
      'Attendu AMO': r.attenduAMO,
      'Attendu AMC': r.attenduAMC,
      'Reste charge': r.resteCharge,
      'Reçu AMO': r.recuAMO,
      'Reçu AMC': r.recuAMC,
      'Total reçu': r.totalRecu,
      'Écart': r.ecart,
      'Statut': r.statut,
      'Source mutuelle': r.mutSources,
      'CMU': r.isCMU ? 'Oui' : 'Non',
      'Confiance': `${r.confidence}%`,
      'Validé': r.userValidated ? 'Oui' : 'Non',
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 10 }, { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 6 }, { wch: 10 }, { wch: 8 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Rapprochement');

    const rc = results.recap;
    const synthData = [
      { 'Indicateur': 'Total facturé', 'Valeur': rc.totalFact },
      { 'Indicateur': 'Reçu AMO (Sécu)', 'Valeur': rc.totalAMO },
      { 'Indicateur': 'Reçu AMC (Mutuelles)', 'Valeur': rc.totalAMC },
      { 'Indicateur': 'Total encaissé', 'Valeur': rc.totalRecu },
      { 'Indicateur': 'Reste à percevoir', 'Valeur': rc.reste },
      { 'Indicateur': 'Taux recouvrement', 'Valeur': `${rc.taux.toFixed(1)}%` },
      { 'Indicateur': '', 'Valeur': '' },
      { 'Indicateur': 'OK', 'Valeur': rc.nOK },
      { 'Indicateur': 'Écarts', 'Valeur': rc.nEcart },
      { 'Indicateur': 'Impayés', 'Valeur': rc.nImpaye },
      { 'Indicateur': 'À vérifier', 'Valeur': rc.nVerif },
      { 'Indicateur': 'Orphelins', 'Valeur': rc.nOrphelin },
      { 'Indicateur': 'Total lignes', 'Valeur': rc.total },
    ];
    const wsSynth = XLSX.utils.json_to_sheet(synthData);
    wsSynth['!cols'] = [{ wch: 25 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsSynth, 'Synthèse');

    XLSX.writeFile(wb, `pec-rapprochement-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, [results]);

  const exportCSV = useCallback(() => {
    if (!results) return;
    const BOM = '\uFEFF';
    const sep = ';';
    const header = ['FSE', 'Patient', 'Date', 'Facturé', 'Reçu AMO', 'Reçu AMC', 'Total Reçu', 'Écart', 'Statut', 'Source', 'CMU', 'Validé manuellement'];
    const lines = [header.join(sep)];
    results.items.forEach(r => {
      lines.push([
        r.fse, `"${r.patient}"`, r.date || '', r.montant, r.recuAMO, r.recuAMC,
        r.totalRecu, r.ecart, r.statut, r.mutSources, r.isCMU ? 'Oui' : 'Non',
        r.userValidated ? 'Oui' : 'Non',
      ].join(sep));
    });
    const blob = new Blob([BOM + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pec-rapprochement-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }, [results]);

  const exportAudit = useCallback(() => {
    if (!results) return;
    const rc = results.recap;
    let txt = `RAPPORT DE RAPPROCHEMENT — PEC ANTILLES PRO v3\n`;
    txt += `${'═'.repeat(55)}\n`;
    txt += `Date du rapport : ${new Date().toLocaleString('fr-FR')}\n\n`;
    txt += `SYNTHÈSE GLOBALE\n${'─'.repeat(40)}\n`;
    txt += `Total facturé :       ${fmt(rc.totalFact)}\n`;
    txt += `Reçu AMO (Sécu) :     ${fmt(rc.totalAMO)}\n`;
    txt += `Reçu AMC (Mutuelles): ${fmt(rc.totalAMC)}\n`;
    txt += `Total encaissé :      ${fmt(rc.totalRecu)}\n`;
    txt += `Reste à percevoir :   ${fmt(rc.reste)}\n`;
    txt += `Taux recouvrement :   ${pct(rc.taux)}\n\n`;
    txt += `VENTILATION\n${'─'.repeat(40)}\n`;
    txt += `✅ OK :        ${rc.nOK}\n`;
    txt += `⚠️ Écarts :    ${rc.nEcart}\n`;
    txt += `❌ Impayés :   ${rc.nImpaye}\n`;
    txt += `🔍 À vérifier: ${rc.nVerif}\n`;
    txt += `📅 Actes ant.: ${rc.nAnterieur}\n`;
    txt += `Total :         ${rc.total}\n\n`;
    txt += `FICHIERS CHARGÉS\n${'─'.repeat(40)}\n`;
    if (recettesFile) txt += `Recettes : ${recettesFile.name}\n`;
    if (secuFile) txt += `Sécu :     ${secuFile.name}\n`;
    mutuelleFiles.forEach((m, i) => txt += `Mutuelle ${i + 1}: ${m.file.name}\n`);
    txt += '\n';
    const impayes = results.items.filter(r => r.statut === 'IMPAYÉ');
    if (impayes.length) {
      txt += `DÉTAIL IMPAYÉS (${impayes.length})\n${'─'.repeat(40)}\n`;
      impayes.forEach(r => txt += `  FSE ${r.fse} — ${r.patient} — ${fmt(r.montant)}\n`);
      txt += '\n';
    }
    const ecarts = results.items.filter(r => r.statut === 'ÉCART');
    if (ecarts.length) {
      txt += `DÉTAIL ÉCARTS (${ecarts.length})\n${'─'.repeat(40)}\n`;
      ecarts.forEach(r => txt += `  FSE ${r.fse} — ${r.patient} — Facturé: ${fmt(r.montant)} — Reçu: ${fmt(r.totalRecu)} — Écart: ${fmt(r.ecart)}\n`);
    }
    const anterieurs = results.items.filter(r => r.statut === 'ANTÉRIEUR');
    if (anterieurs.length) {
      txt += `\nPAIEMENTS ACTES ANTÉRIEURS (${anterieurs.length})\n${'\u2500'.repeat(40)}\n`;
      txt += `(Règlements Sécu/Mutuelle de FSE émises le mois précédent)\n`;
      anterieurs.forEach(r => txt += `  FSE ${r.fse} — ${r.patient} — AMO: ${fmt(r.recuAMO)} — AMC: ${fmt(r.recuAMC)} — Source: ${r.matchType}\n`);
    }
    const validated = results.items.filter(r => r.userValidated);
    if (validated.length) {
      txt += `\nLIGNES VALIDÉES MANUELLEMENT (${validated.length})\n${'─'.repeat(40)}\n`;
      validated.forEach(r => txt += `  FSE ${r.fse} — ${r.patient} — ${r.previousStatut} → ${r.statut}\n`);
    }
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pec-audit-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
  }, [results, recettesFile, secuFile, mutuelleFiles]);

  return { exportCSV, exportXLSX, exportAudit, exportImpayes };
}
