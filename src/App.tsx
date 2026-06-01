import React, { useState } from 'react';
import { Upload, FileSpreadsheet, Loader2, KeyRound, Bot, CheckCircle2, AlertTriangle, XCircle, Search, Download, Sparkles, Info, FileText } from 'lucide-react';
import { getApiKey } from '@/lib/ai';
import UploadCard from '@/components/UploadCard';
import MappingModal from '@/components/MappingModal';
import ApiKeyModal from '@/components/ApiKeyModal';
import ResultsTable from '@/components/ResultsTable';
import KpiCards from '@/components/KpiCards';
import AIVerifyModal from '@/components/AIVerifyModal';
import DetailPanel from '@/components/DetailPanel';
import { useUpload } from '@/hooks/useUpload';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useExport } from '@/hooks/useExport';

export default function App() {
  const upload = useUpload();
  const analysis = useAnalysis();
  const { exportCSV, exportXLSX, exportAudit, exportImpayes } = useExport(
    analysis.results,
    upload.recettes.file,
    upload.secu.file,
    upload.mutuelles,
    (a) => analysis.setAlert(a),
  );

  const [apiKeyOpen, setApiKeyOpen] = useState(false);
  const [mappingOpen, setMappingOpen] = useState<'recettes' | 'secu' | null>(null);
  const [aiVerifyOpen, setAiVerifyOpen] = useState(false);

  const hasApiKey = !!getApiKey();

  // Merge alerts: upload alert takes priority if set
  const alert = upload.alert || analysis.alert;

  const readyToAnalyse = !!(upload.recettes.file && upload.secu.file && !upload.recettes.loading && !upload.secu.loading);

  const handleRunAnalysis = () => {
    analysis.runAnalysis(upload.recettes, upload.secu, upload.mutuelles, upload.impayesM1);
  };

  const handleReset = () => {
    upload.resetUpload();
    analysis.reset();
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-white/5 bg-raised/80 backdrop-blur sticky top-0 z-40">
        <div className="w-full max-w-7xl mx-auto px-3 md:px-6 py-2 md:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald to-sky flex items-center justify-center text-lg shrink-0">🏥</div>
              <div className="min-w-0">
                <h1 className="text-sm md:text-lg font-semibold truncate">PEC Antilles Pro</h1>
                <p className="text-[10px] text-slate-400 hidden sm:block">Rapprochement Tiers Payant</p>
              </div>
            </div>
            <button onClick={() => setApiKeyOpen(true)} className="btn-ghost shrink-0">
              <KeyRound className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{hasApiKey ? '✓ Clé API' : 'Clé API'}</span>
            </button>
          </div>
          {analysis.results && (
            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/5 overflow-x-auto pb-0.5 -mx-1 px-1">
              <button onClick={() => setAiVerifyOpen(true)} className="btn-ghost shrink-0">
                <Bot className="w-3.5 h-3.5" /> <span className="hidden sm:inline">IA</span>
              </button>
              <button onClick={exportXLSX} className="btn-ghost shrink-0">
                <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Excel</span>
              </button>
              <button onClick={exportCSV} className="btn-ghost shrink-0">
                <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">CSV</span>
              </button>
              <button onClick={exportAudit} className="btn-ghost shrink-0">
                <FileText className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Audit</span>
              </button>
              <button onClick={exportImpayes} className="btn-ghost text-amber shrink-0">
                <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Impayés</span>
              </button>
              <button onClick={handleReset} className="btn-ghost text-rose font-semibold shrink-0 ml-auto">
                ✕ <span className="hidden sm:inline">Réinit.</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="w-full max-w-7xl mx-auto px-3 md:px-6 py-3 md:py-6 space-y-3 md:space-y-6">
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

        <section className="space-y-3 md:space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-2">
            <Upload className="w-4 h-4" /> Fichiers requis
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
            <UploadCard
              label="Livre de Recettes"
              icon="📋"
              iconBg="bg-amber/20"
              file={upload.recettes.file}
              mapping={upload.recettes.mapping}
              loading={upload.recettes.loading}
              onUpload={(f) => upload.handleUpload(f, 'recettes')}
              onShowMapping={() => setMappingOpen('recettes')}
            />
            <UploadCard
              label="Relevé Sécurité Sociale"
              icon="🏥"
              iconBg="bg-sky/20"
              file={upload.secu.file}
              mapping={upload.secu.mapping}
              loading={upload.secu.loading}
              onUpload={(f) => upload.handleUpload(f, 'secu')}
              onShowMapping={() => setMappingOpen('secu')}
            />
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" /> Mutuelles ({upload.mutuelles.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {upload.mutuelles.map((m, i) => (
                <div key={i} className="relative p-3 rounded-lg border border-emerald/30 bg-emerald/10">
                  <button onClick={() => upload.removeMutuelle(i)} className="absolute top-1 right-2 text-rose hover:text-rose/70 text-lg leading-none">×</button>
                  <div className="text-xs font-semibold truncate">{m.mapping?.notes?.includes('iSanté') ? '🟢' : m.mapping?.notes?.includes('Almerys') ? '🔵' : '➕'} {m.file.name}</div>
                  <div className="text-[10px] text-slate-400 mt-1">{m.mapping?.data.length} lignes</div>
                  {m.mapping?.aiUsed && <div className="text-[10px] text-emerald mt-1">🤖 IA {m.mapping.confidence}%</div>}
                </div>
              ))}
              <label className="p-3 rounded-lg border border-dashed border-white/20 hover:border-indigo text-center cursor-pointer text-sm text-slate-400 hover:text-indigo transition-colors flex items-center justify-center min-h-[60px]">
                + Ajouter une mutuelle
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload.handleUpload(f, 'mutuelle');
                  e.target.value = '';
                }} />
              </label>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Impayés du mois précédent (optionnel)
              <span className="text-[10px] normal-case text-slate-500 font-normal">— CSV exporté le mois dernier</span>
            </h2>
            <label className={`block p-4 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
              upload.impayesM1.file ? 'border-amber/50 bg-amber/10' : 'border-white/20 hover:border-amber'
            }`}>
              <input type="file" accept=".csv" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload.handleImpayesUpload(f);
                e.target.value = '';
              }} />
              {upload.impayesM1.file ? (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold flex items-center gap-2">⏳ {upload.impayesM1.file.name}</div>
                    <div className="text-xs text-slate-400 mt-1">{upload.impayesM1.rows.length} impayé(s) à réconcilier</div>
                  </div>
                  <button onClick={(e) => { e.preventDefault(); upload.setImpayesM1({ file: null, rows: [] }); }} className="text-rose hover:text-rose/70 text-sm">Retirer</button>
                </div>
              ) : (
                <div className="text-center text-sm text-slate-400">
                  <div className="text-2xl mb-1">⏳</div>
                  Cliquez pour charger le CSV des impayés du mois précédent
                  <div className="text-[10px] mt-1 text-slate-500">Permet de détecter les règlements décalés (sécu/mutuelle qui paient 7-30j après la FSE)</div>
                </div>
              )}
            </label>
          </div>

          <div className="flex justify-stretch sm:justify-end">
            <button
              disabled={!readyToAnalyse || !!analysis.loading}
              onClick={handleRunAnalysis}
              className="w-full sm:w-auto px-6 py-3 rounded-lg bg-gradient-to-r from-emerald to-sky text-black font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald/20 hover:shadow-emerald/40 transition-shadow"
            >
              {analysis.loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {analysis.loading || 'Lancer l\'analyse'}
            </button>
          </div>
        </section>

        {analysis.results && (
          <section className="space-y-4 animate-fade-in-up">
            <KpiCards recap={analysis.results.recap} loading={!!analysis.loading} />
            <ResultsTable
              items={analysis.results.items}
              filter={analysis.filter}
              setFilter={analysis.setFilter}
              search={analysis.search}
              setSearch={analysis.setSearch}
              recap={analysis.results.recap}
              onRowClick={(item) => analysis.setSelectedItem(item)}
            />
          </section>
        )}
      </main>

      <ApiKeyModal open={apiKeyOpen} onClose={() => setApiKeyOpen(false)} />
      <MappingModal
        open={!!mappingOpen}
        onClose={() => setMappingOpen(null)}
        mapping={mappingOpen === 'recettes' ? upload.recettes.mapping : upload.secu.mapping}
        fileType={mappingOpen as 'recettes' | 'secu' | null}
        filename={(mappingOpen === 'recettes' ? upload.recettes.file?.name : upload.secu.file?.name) || ''}
      />
      <AIVerifyModal
        open={aiVerifyOpen}
        onClose={() => setAiVerifyOpen(false)}
        results={analysis.results}
        onApplyVerdict={analysis.applyUserVerdict}
        onNeedApiKey={() => { setAiVerifyOpen(false); setApiKeyOpen(true); }}
      />
      <DetailPanel item={analysis.selectedItem} onClose={() => analysis.setSelectedItem(null)} />
    </div>
  );
}
