import React, { useState, useMemo, useCallback } from 'react';
import { Upload, FileSpreadsheet, Loader2, KeyRound, Bot, CheckCircle2, AlertTriangle, XCircle, Search, Download, Sparkles, Info, FileText } from 'lucide-react';
import type { AnalysisResults, FilterKey, ResultItem, Statut, MappingResult } from '@/types';
import { fmt, pct } from '@/lib/utils';
import { smartLoadFile, applyMappingToDataset, getApiKey, setApiKey, testApiKey, verifyCases, type SuspectCase, COLUMN_SCHEMAS } from '@/lib/ai';
import { parseRecettes, parseSecu, parseMutuelle, rapprochement, buildRecap } from '@/lib/engine';
import UploadCard from '@/components/UploadCard';
import MappingModal from '@/components/MappingModal';
import ApiKeyModal from '@/components/ApiKeyModal';
import ResultsTable from '@/components/ResultsTable';
import KpiCards from '@/components/KpiCards';
import AIVerifyModal from '@/components/AIVerifyModal';
import DetailPanel from '@/components/DetailPanel';

// Lazy-load readXlsx — only pulled in when user uploads a file
const lazyReadXlsx = async (file: File) => {
  const { readXlsx } = await import('@/lib/xlsx-reader');
  return readXlsx(file);
};

export default function App() {
  const [recettes, setRecettes] = useState<{ file: File | null; mapping: MappingResult | null; loading: boolean }>({ file: null, mapping: null, loading: false });
  const [secu, setSecu] = useState<{ file: File | null; mapping: MappingResult | null; loading: boolean }>({ file: null, mapping: null, loading: false });
  const [mutuelles, setMutuelles] = useState<{ file: File; mapping: MappingResult | null }[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [search, setSearch] = useState('');
  const [apiKeyOpen, setApiKeyOpen] = useState(false);
  const [mappingOpen, setMappingOpen] = useState<'recettes' | 'secu' | null>(null);
  const [aiVerifyOpen, setAiVerifyOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ResultItem | null>(null);
  const [alert, setAlert] = useState<{ type: 'error' | 'success' | 'info'; msg: string } | null>(null);

  const hasApiKey = !!getApiKey();

  // ─── Upload handlers ───
  const handleUpload = useCallback(async (file: File, type: 'recettes' | 'secu' | 'mutuelle', idx?: number) => {
    if (!file.name.match(/\.xlsx?$/i)) {
      setAlert({ type: 'error', msg: 'Fichier Excel (.xlsx) requis' });
      return;
    }
    if (type === 'recettes') setRecettes(s => ({ ...s, loading: true, file }));
    else if (type === 'secu') setSecu(s => ({ ...s, loading: true, file }));

    try {
      const mapping = await smartLoadFile(file, type, lazyReadXlsx);
      if (type === 'recettes') setRecettes({ file, mapping, loading: false });
      else if (type === 'secu') setSecu({ file, mapping, loading: false });
      else if (type === 'mutuelle') {
        setMutuelles(prev => {
          const next = [...prev];
          if (idx != null) next[idx] = { file, mapping };
          else next.push({ file, mapping });
          return next;
        });
      }
      setAlert(null);
    } catch (err) {
      setAlert({ type: 'error', msg: (err as Error).message });
      if (type === 'recettes') setRecettes(s => ({ ...s, loading: false }));
      else if (type === 'secu') setSecu(s => ({ ...s, loading: false }));
    }
  }, []);

  const removeMutuelle = (idx: number) => {
    setMutuelles(prev => prev.filter((_, i) => i !== idx));
  };

  // ─── Run analysis ───
  const runAnalysis = async () => {
    if (!recettes.file || !secu.file) {
      setAlert({ type: 'error', msg: 'Recettes + Sécu requis' });
      return;
    }
    setLoading('Analyse en cours…');
    try {
      const recData = applyMappingToDataset(recettes.mapping?.data || [], recettes.mapping);
      const secuData = applyMappingToDataset(secu.mapping?.data || [], secu.mapping);
      const recettesRows = parseRecettes(recData);
      if (!recettesRows.length) throw new Error('Aucune recette trouvée');
      const secuRows = parseSecu(secuData);
      let mutRows: ReturnType<typeof parseMutuelle> = [];
      mutuelles.forEach(m => {
        if (m.mapping?.data?.length) {
          const md = applyMappingToDataset(m.mapping.data, m.mapping);
          mutRows = mutRows.concat(parseMutuelle(md, m.file.name));
        }
      });
      const res = rapprochement(recettesRows, secuRows, mutRows);
      setResults(res);
      setAlert(null);
    } catch (err) {
      setAlert({ type: 'error', msg: (err as Error).message });
    } finally {
      setLoading(null);
    }
  };

  const reset = () => {
    setRecettes({ file: null, mapping: null, loading: false });
    setSecu({ file: null, mapping: null, loading: false });
    setMutuelles([]);
    setResults(null);
    setFilter('ALL');
    setSearch('');
    setAlert(null);
  };

  // ─── Apply user verdict (batched) ───
  const applyUserVerdict = (fse: string, newStatut: Statut | 'KEEP') => {
    if (!results || newStatut === 'KEEP') return;
    setResults(prev => {
      if (!prev) return prev;
      const items = prev.items.map(item => {
        if (item.fse !== fse) return item;
        return {
          ...item,
          statut: newStatut,
          userValidated: true,
          validatedAt: new Date().toISOString(),
          previousStatut: item.statut,
          confidence: newStatut === 'OK' ? 100 : item.confidence,
        };
      });
      return { items, recap: buildRecap(items) };
    });
  };

  // ─── Export XLSX formatté ───
  const exportXLSX = async () => {
    if (!results) return;
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // Données principales
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

    // Largeurs colonnes
    ws['!cols'] = [
      { wch: 10 }, { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 6 }, { wch: 10 }, { wch: 8 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Rapprochement');

    // Feuille synthèse
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
  };

  // ─── Export CSV ───
  const exportCSV = () => {
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
  };

  // ─── Export Audit ───
  const exportAudit = () => {
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
    if (recettes.file) txt += `Recettes : ${recettes.file.name}\n`;
    if (secu.file) txt += `Sécu :     ${secu.file.name}\n`;
    mutuelles.forEach((m, i) => txt += `Mutuelle ${i + 1}: ${m.file.name}\n`);
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
  };

  const readyToAnalyse = !!(recettes.file && secu.file && !recettes.loading && !secu.loading);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-white/5 bg-raised/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gradient-to-br from-emerald to-sky flex items-center justify-center text-xl md:text-2xl">🏥</div>
            <div>
              <h1 className="text-sm md:text-lg font-semibold">PEC Antilles Pro</h1>
              <p className="text-[10px] md:text-xs text-slate-400 hidden sm:block">Rapprochement Tiers Payant · Powered by Claude</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 flex-wrap justify-end">
            <button onClick={() => setApiKeyOpen(true)} className="btn-ghost text-xs md:text-sm">
              <KeyRound className="w-3.5 h-3.5 md:w-4 md:h-4" /> <span className="hidden sm:inline">{hasApiKey ? '✓ Clé API' : 'Clé API'}</span><span className="sm:hidden">{hasApiKey ? '✓' : '🔑'}</span>
            </button>
            {results && (
              <>
                <button onClick={() => setAiVerifyOpen(true)} className="btn-ghost text-xs md:text-sm">
                  <Bot className="w-3.5 h-3.5 md:w-4 md:h-4" /> <span className="hidden md:inline">Vérifier IA</span>
                </button>
                <button onClick={exportXLSX} className="btn-ghost text-xs md:text-sm">
                  <Download className="w-3.5 h-3.5 md:w-4 md:h-4" /> <span className="hidden md:inline">Excel</span>
                </button>
                <button onClick={exportCSV} className="btn-ghost text-xs md:text-sm">
                  <Download className="w-3.5 h-3.5 md:w-4 md:h-4" /> <span className="hidden lg:inline">CSV</span>
                </button>
                <button onClick={exportAudit} className="btn-ghost text-xs md:text-sm">
                  <FileText className="w-3.5 h-3.5 md:w-4 md:h-4" /> <span className="hidden lg:inline">Audit</span>
                </button>
                <button onClick={reset} className="btn-ghost text-rose text-xs md:text-sm font-semibold">
                  Réinitialiser
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Alert */}
        {alert && (
          <div className={`px-4 py-3 rounded-lg border text-sm flex items-start gap-3 ${
            alert.type === 'error' ? 'bg-rose/10 border-rose/30 text-rose' :
            alert.type === 'success' ? 'bg-emerald/10 border-emerald/30 text-emerald' :
            'bg-sky/10 border-sky/30 text-sky'
          }`}>
            {alert.type === 'error' ? <XCircle className="w-5 h-5 shrink-0" /> :
             alert.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> :
             <Info className="w-5 h-5 shrink-0" />}
            <span>{alert.msg}</span>
          </div>
        )}

        {/* Upload section */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-2">
            <Upload className="w-4 h-4" /> Fichiers requis
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UploadCard
              label="Livre de Recettes"
              icon="📋"
              iconBg="bg-amber/20"
              file={recettes.file}
              mapping={recettes.mapping}
              loading={recettes.loading}
              onUpload={(f) => handleUpload(f, 'recettes')}
              onShowMapping={() => setMappingOpen('recettes')}
            />
            <UploadCard
              label="Relevé Sécurité Sociale"
              icon="🏥"
              iconBg="bg-sky/20"
              file={secu.file}
              mapping={secu.mapping}
              loading={secu.loading}
              onUpload={(f) => handleUpload(f, 'secu')}
              onShowMapping={() => setMappingOpen('secu')}
            />
          </div>

          {/* Mutuelles */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" /> Mutuelles ({mutuelles.length})
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {mutuelles.map((m, i) => (
                <div key={i} className="relative p-3 rounded-lg border border-emerald/30 bg-emerald/10">
                  <button onClick={() => removeMutuelle(i)} className="absolute top-1 right-2 text-rose hover:text-rose/70 text-lg leading-none">×</button>
                  <div className="text-xs font-semibold truncate">{m.mapping?.notes?.includes('iSanté') ? '🟢' : m.mapping?.notes?.includes('Almerys') ? '🔵' : '➕'} {m.file.name}</div>
                  <div className="text-[10px] text-slate-400 mt-1">{m.mapping?.data.length} lignes</div>
                  {m.mapping?.aiUsed && <div className="text-[10px] text-emerald mt-1">🤖 IA {m.mapping.confidence}%</div>}
                </div>
              ))}
              <label className="p-3 rounded-lg border border-dashed border-white/20 hover:border-indigo text-center cursor-pointer text-sm text-slate-400 hover:text-indigo transition-colors flex items-center justify-center min-h-[60px]">
                + Ajouter une mutuelle
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f, 'mutuelle');
                  e.target.value = '';
                }} />
              </label>
            </div>
          </div>

          {/* Run button */}
          <div className="flex justify-end">
            <button
              disabled={!readyToAnalyse || !!loading}
              onClick={runAnalysis}
              className="px-6 py-3 rounded-lg bg-gradient-to-r from-emerald to-sky text-black font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-emerald/20 hover:shadow-emerald/40 transition-shadow"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {loading || 'Lancer l\'analyse'}
            </button>
          </div>
        </section>

        {/* Results */}
        {results && (
          <section className="space-y-4 animate-fade-in-up">
            <KpiCards recap={results.recap} />
            <ResultsTable
              items={results.items}
              filter={filter}
              setFilter={setFilter}
              search={search}
              setSearch={setSearch}
              recap={results.recap}
              onRowClick={(item) => setSelectedItem(item)}
            />
          </section>
        )}
      </main>

      {/* Modals */}
      <ApiKeyModal open={apiKeyOpen} onClose={() => setApiKeyOpen(false)} />
      <MappingModal
        open={!!mappingOpen}
        onClose={() => setMappingOpen(null)}
        mapping={mappingOpen === 'recettes' ? recettes.mapping : secu.mapping}
        fileType={mappingOpen as 'recettes' | 'secu' | null}
        filename={(mappingOpen === 'recettes' ? recettes.file?.name : secu.file?.name) || ''}
      />
      <AIVerifyModal
        open={aiVerifyOpen}
        onClose={() => setAiVerifyOpen(false)}
        results={results}
        onApplyVerdict={applyUserVerdict}
        onNeedApiKey={() => { setAiVerifyOpen(false); setApiKeyOpen(true); }}
      />
      <DetailPanel item={selectedItem} onClose={() => setSelectedItem(null)} />
    </div>
  );
}
