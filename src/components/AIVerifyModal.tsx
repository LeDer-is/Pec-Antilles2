import { useState, useEffect, useRef } from 'react';
import { X, Loader2, CheckCircle2, XCircle, HelpCircle, Sparkles } from 'lucide-react';
import type { AnalysisResults, Statut } from '@/types';
import { verifyCases, getApiKey, type SuspectCase } from '@/lib/ai';
import { nameScore } from '@/lib/utils';
import { fmt } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  results: AnalysisResults | null;
  onApplyVerdict: (fse: string, newStatut: Statut | 'KEEP') => void;
  onNeedApiKey: () => void;
}

interface Verdict {
  id: number;
  verdict: string;
  chosen?: string;
  reason: string;
}

export default function AIVerifyModal({ open, onClose, results, onApplyVerdict, onNeedApiKey }: Props) {
  const [loading, setLoading] = useState(false);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [cases, setCases] = useState<SuspectCase[]>([]);
  const [cost, setCost] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  // Build suspect cases
  const buildCases = (): SuspectCase[] => {
    if (!results) return [];
    const items = results.items;
    const cas: SuspectCase[] = [];

    items.filter(r => r.statut === 'À VÉRIFIER' || (r.confidence && r.confidence < 70)).forEach(r => {
      cas.push({
        row: { fse: r.fse, patient: r.patient, date: r.date, montant: r.montant, attenduAMC: r.attenduAMC },
        candidates: [],
        matched: r.totalRecu > 0 ? {
          patient: r.secuDetail?.patient || r.mutDetail?.lines?.[0]?.patient || 'inconnu',
          montant: r.totalRecu,
          source: r.matchType,
        } : null,
        warnings: r.warnings || [],
      });
    });

    const orphelins = items.filter(r => r.statut === 'ORPHELIN');
    items.filter(r => r.statut === 'IMPAYÉ' && r.patientNorm).slice(0, 10).forEach(r => {
      const candidates: NonNullable<SuspectCase['candidates']> = [];
      orphelins.forEach(o => {
        if (!o.patientNorm) return;
        const s = nameScore(r.patientNorm, o.patientNorm);
        if (s >= 70) {
          const src = o.matchType === 'orphelin-secu' ? 'Sécu' : (o.mutSources || 'Mutuelle');
          candidates.push({ source: src, fse: o.fse, patient: o.patient, montant: o.totalRecu, score: s });
        }
      });
      if (candidates.length) {
        candidates.sort((a, b) => (b.score || 0) - (a.score || 0));
        cas.push({
          row: { fse: r.fse, patient: r.patient, date: r.date, montant: r.montant, attenduAMC: r.attenduAMC },
          candidates: candidates.slice(0, 4),
          matched: null,
          warnings: ['Impayé avec candidats potentiels'],
        });
      }
    });
    return cas.slice(0, 20);
  };

  const run = async () => {
    if (!getApiKey()) { onNeedApiKey(); return; }
    if (!results) return;
    const cas = buildCases();
    if (!cas.length) {
      setCases([]);
      setVerdicts([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { verdicts, usage, durationMs } = await verifyCases(cas);
      setCases(cas);
      setVerdicts(verdicts);
      const inT = usage.input_tokens, outT = usage.output_tokens;
      const costUsd = (inT * 1 + outT * 5) / 1_000_000;
      setCost(`⏱️ ${(durationMs/1000).toFixed(1)}s · ${inT}+${outT} tokens · ~$${costUsd.toFixed(4)}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-run when opened
  const hasRun = useRef(false);
  useEffect(() => {
    if (open && !hasRun.current) {
      hasRun.current = true;
      run();
    }
    if (!open) hasRun.current = false;
  }, [open]);

  if (!open) return null;

  const apply = (fse: string, newStatut: Statut | 'KEEP') => {
    onApplyVerdict(fse, newStatut);
    setApplied(prev => new Set(prev).add(fse));
  };

  const bulkApproveValid = () => {
    cases.forEach((c, i) => {
      const v = verdicts.find(x => x.id === i + 1);
      if (v?.verdict === 'VALIDE' && !applied.has(c.row.fse)) {
        apply(c.row.fse, 'OK');
      }
    });
  };

  const validCount = verdicts.filter(v => v.verdict === 'VALIDE').length;
  const unappliedValidCount = cases.filter((c, i) => {
    const v = verdicts.find(x => x.id === i + 1);
    return v?.verdict === 'VALIDE' && !applied.has(c.row.fse);
  }).length;

  const close = () => {
    setApplied(new Set());
    setVerdicts([]);
    setCases([]);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center p-6 overflow-y-auto" onClick={close}>
      <div className="bg-raised border border-white/10 rounded-xl p-6 w-full max-w-4xl relative my-10" onClick={(e) => e.stopPropagation()}>
        <button onClick={close} className="absolute top-3 right-3 w-8 h-8 rounded hover:bg-white/5 flex items-center justify-center">
          <X className="w-4 h-4" />
        </button>
        <h2 className="text-xl font-semibold bg-gradient-to-r from-indigo to-sky bg-clip-text text-transparent mb-1">
          🤖 Analyse IA des cas douteux
        </h2>
        <p className="text-xs text-slate-400 mb-4">Claude analyse les rapprochements à faible confiance et propose un verdict. Tu valides manuellement.</p>

        {loading && (
          <div className="text-center py-10">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-sky mb-3" />
            <div className="text-sm">Claude analyse les cas douteux…</div>
            <div className="text-xs text-slate-400 mt-1">~5–10 secondes</div>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-rose/10 border border-rose/30 text-sm">
            <strong className="text-rose">❌ Erreur</strong>
            <div className="font-mono text-xs mt-2 p-2 bg-surface rounded whitespace-pre-wrap">{error}</div>
          </div>
        )}

        {!loading && !error && cases.length === 0 && results && (
          <div className="p-4 rounded-lg bg-emerald/10 border-l-4 border-emerald">
            <div className="font-semibold text-emerald">✅ Aucun cas douteux</div>
            <div className="text-xs text-slate-400 mt-1">Tous les rapprochements ont une confiance élevée.</div>
          </div>
        )}

        {!loading && !error && cases.length > 0 && (
          <>
            {unappliedValidCount > 0 && (
              <button
                onClick={bulkApproveValid}
                className="w-full mb-4 py-2.5 rounded-lg bg-emerald/15 border border-emerald/30 text-emerald font-semibold text-sm hover:bg-emerald/25 transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Tout valider les {unappliedValidCount} cas VALIDE → OK
              </button>
            )}

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {cases.map((c, i) => {
                const v = verdicts.find(x => x.id === i + 1) || { id: i + 1, verdict: '?', reason: 'Pas d\'analyse' };
                const done = applied.has(c.row.fse);
                return (
                  <div key={i} className={`p-3 rounded-lg border ${
                    done ? 'bg-emerald/5 border-emerald/30 opacity-70' :
                    v.verdict === 'VALIDE' ? 'bg-white/[0.02] border-white/5' :
                    v.verdict === 'INVALIDE' ? 'bg-rose/5 border-rose/20' :
                    'bg-amber/5 border-amber/20'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm">
                        <strong>{c.row.patient}</strong>
                        <span className="text-slate-400 text-xs ml-2">FSE {c.row.fse} — {fmt(c.row.montant)}</span>
                      </div>
                      <VerdictBadge verdict={v.verdict} />
                    </div>
                    {c.matched && (
                      <div className="text-xs text-slate-400 mb-1">Match actuel : {c.matched.patient} — {fmt(c.matched.montant)} ({c.matched.source})</div>
                    )}
                    {c.candidates && c.candidates.length > 0 && (
                      <div className="text-xs text-slate-500 mb-1">
                        Candidats : {c.candidates.map((cd, j) => `${String.fromCharCode(65+j)}=${cd.patient} (${fmt(cd.montant)})`).join(' · ')}
                        {v.chosen && v.chosen !== 'null' && <span className="text-sky font-semibold ml-2">→ IA : option {v.chosen}</span>}
                      </div>
                    )}
                    <div className="text-xs text-slate-300 mt-2 italic">💭 {v.reason}</div>

                    {/* Action buttons */}
                    <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                      {done ? (
                        <span className="text-xs text-emerald font-semibold">✅ Statut mis à jour</span>
                      ) : (
                        <>
                          <button onClick={() => apply(c.row.fse, 'OK')} className="px-3 py-1 rounded text-xs font-semibold bg-emerald/15 text-emerald border border-emerald/30 hover:bg-emerald/25">
                            ✅ Valider → OK
                          </button>
                          <button onClick={() => apply(c.row.fse, 'IMPAYÉ')} className="px-3 py-1 rounded text-xs font-semibold bg-rose/15 text-rose border border-rose/30 hover:bg-rose/25">
                            ❌ Marquer Impayé
                          </button>
                          <button onClick={() => apply(c.row.fse, 'KEEP')} className="px-3 py-1 rounded text-xs font-semibold bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10">
                            ⏸ Laisser
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {cost && (
              <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-slate-500 text-center">{cost}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: string }) {
  if (verdict === 'VALIDE') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald/15 text-emerald border border-emerald/30"><CheckCircle2 className="inline w-3 h-3 mr-1" />VALIDE</span>;
  if (verdict === 'INVALIDE') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose/15 text-rose border border-rose/30"><XCircle className="inline w-3 h-3 mr-1" />INVALIDE</span>;
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber/15 text-amber border border-amber/30"><HelpCircle className="inline w-3 h-3 mr-1" />{verdict}</span>;
}
