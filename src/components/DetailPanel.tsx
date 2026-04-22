import { X, CheckCircle2, AlertTriangle, XCircle, Shield } from 'lucide-react';
import type { ResultItem } from '@/types';
import { fmt } from '@/lib/utils';

interface Props {
  item: ResultItem | null;
  onClose: () => void;
}

export default function DetailPanel({ item, onClose }: Props) {
  if (!item) return null;
  const r = item;

  const confColor = r.confidence >= 90 ? 'text-emerald' : r.confidence >= 70 ? 'text-amber' : 'text-rose';
  const confBg = r.confidence >= 90 ? 'bg-emerald/10 border-emerald/30' : r.confidence >= 70 ? 'bg-amber/10 border-amber/30' : 'bg-rose/10 border-rose/30';
  const ecartCls = Math.abs(r.ecart) <= 0.02 ? 'text-emerald' : r.ecart > 0 ? 'text-rose' : 'text-amber';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-md bg-raised border-l border-white/10 h-full overflow-y-auto animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-raised/95 backdrop-blur border-b border-white/5 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <div className="font-semibold text-lg">{r.patient || `FSE ${r.fse}`}</div>
            <div className="text-xs text-slate-400">FSE {r.fse} · {r.date ? new Date(r.date).toLocaleDateString('fr-FR') : '—'}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded hover:bg-white/5 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Warnings */}
          {r.warnings && r.warnings.length > 0 && (
            <div className="p-3 rounded-lg bg-amber/10 border border-amber/30">
              <div className="text-xs font-semibold text-amber flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-3.5 h-3.5" /> Vérifications nécessaires
              </div>
              {r.warnings.map((w, i) => (
                <div key={i} className="text-xs text-slate-300 mt-1">{w}</div>
              ))}
            </div>
          )}

          {/* Confiance */}
          <div className={`p-3 rounded-lg border flex items-center justify-between ${confBg}`}>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Score de confiance
            </span>
            <span className={`text-xl font-bold ${confColor}`}>{r.confidence}%</span>
          </div>

          {/* Statut */}
          <div className="p-3 rounded-lg bg-surface border border-white/5 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Statut</span>
            <StatusTag statut={r.statut} validated={r.userValidated} />
          </div>

          {/* Informations */}
          <Section title="Informations">
            <Row label="N° FSE" value={r.fse} />
            <Row label="Date" value={r.date ? new Date(r.date).toLocaleDateString('fr-FR') : '—'} />
            <Row label="Match" value={r.matchType === 'fse' ? 'Par N° FSE' : r.matchType === 'nom' ? 'Par nom patient' : r.matchType} />
            {r.isCMU && <Row label="CMU" value="✅ Oui — AMC couvert par Sécu" />}
            {r.mutSources && <Row label="Source mutuelle" value={r.mutSources} />}
            {r.userValidated && (
              <>
                <Row label="Validé manuellement" value="👤 Oui" cls="text-indigo" />
                {r.previousStatut && <Row label="Ancien statut" value={r.previousStatut} cls="text-slate-500" />}
              </>
            )}
          </Section>

          {/* Montants facturés */}
          <Section title="Montants facturés">
            <Row label="Facturé" value={fmt(r.montant)} cls="text-white font-semibold" />
            <Row label="Attendu AMO" value={fmt(r.attenduAMO)} />
            <Row label="Attendu AMC" value={fmt(r.attenduAMC)} />
            <Row label="Reste à charge patient" value={fmt(r.resteCharge)} />
          </Section>

          {/* Encaissements */}
          <Section title="Encaissements">
            <Row label="Reçu AMO (Sécu)" value={fmt(r.recuAMO)} cls={r.recuAMO > 0 ? 'text-sky' : ''} />
            <Row label="Reçu AMC (Mutuelle)" value={fmt(r.recuAMC)} cls={r.recuAMC > 0 ? 'text-indigo' : ''} />
            <Row label="Total encaissé" value={fmt(r.totalRecu)} cls={r.totalRecu > 0 ? 'text-emerald font-semibold' : ''} />
            <Row label="Écart" value={fmt(r.ecart)} cls={`font-semibold ${ecartCls}`} />
          </Section>

          {/* Détail Sécu */}
          {r.secuDetail && (
            <Section title="Détail Sécu">
              <div className="p-2 rounded bg-sky/10 border border-sky/20 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">CPAM — {r.secuDetail.patient}</span>
                  <span className="text-sky font-semibold">{fmt(r.secuDetail.montantAMO)}</span>
                </div>
              </div>
            </Section>
          )}

          {/* Détail Mutuelles */}
          {r.mutDetail && r.mutDetail.lines.length > 0 && (
            <Section title={`Détail Mutuelles (${r.mutDetail.lines.length} lignes)`}>
              <div className="space-y-1.5">
                {r.mutDetail.lines.map((l, i) => (
                  <div key={i} className="p-2 rounded bg-indigo/10 border border-indigo/20 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">
                        <span className="text-indigo font-semibold">{l.type}</span>
                        {l.patient && ` — ${l.patient}`}
                      </span>
                      <span className="text-indigo font-semibold">{fmt(l.montantAMC)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">{title}</h4>
      <div className="bg-surface rounded-lg border border-white/5 divide-y divide-white/5">
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-xs tabular-nums ${cls || 'text-slate-200'}`}>{value}</span>
    </div>
  );
}

function StatusTag({ statut, validated }: { statut: string; validated?: boolean }) {
  const cls = {
    'OK': 'bg-emerald/15 text-emerald border-emerald/30',
    'ÉCART': 'bg-amber/15 text-amber border-amber/30',
    'IMPAYÉ': 'bg-rose/15 text-rose border-rose/30',
    'À VÉRIFIER': 'bg-sky/15 text-sky border-sky/30',
    'ORPHELIN': 'bg-indigo/15 text-indigo border-indigo/30',
  }[statut] || 'bg-white/5 text-slate-400';
  const icon = { 'OK': '✅', 'ÉCART': '⚠️', 'IMPAYÉ': '❌', 'À VÉRIFIER': '🔍', 'ORPHELIN': '🔍' }[statut] || '';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cls}`}>
      {icon} {statut}
      {validated && <span className="text-indigo ml-0.5">👤✓</span>}
    </span>
  );
}
