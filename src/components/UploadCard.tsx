import { CheckCircle2, Loader2, Upload, Bot, Zap, AlertTriangle } from 'lucide-react';
import type { MappingResult } from '@/types';

interface Props {
  label: string;
  icon: string;
  iconBg: string;
  file: File | null;
  mapping: MappingResult | null;
  loading: boolean;
  onUpload: (file: File) => void;
  onShowMapping: () => void;
}

export default function UploadCard({ label, icon, iconBg, file, mapping, loading, onUpload, onShowMapping }: Props) {
  const loaded = !!file && !loading;
  const confClass = mapping && mapping.confidence >= 80 ? 'text-emerald' : mapping && mapping.confidence >= 50 ? 'text-amber' : 'text-rose';

  return (
    <label className={`relative block p-3 sm:p-4 rounded-lg border transition-all cursor-pointer overflow-hidden
      ${loaded ? 'border-emerald bg-emerald/10' : 'border-dashed border-white/15 hover:border-indigo bg-white/[0.02]'}
    `}>
      <input
        type="file"
        accept=".xlsx,.xls"
        className="absolute inset-0 opacity-0 cursor-pointer"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = '';
        }}
        disabled={loading}
      />
      <div className="flex items-start gap-2.5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 ${loaded ? 'bg-emerald text-black' : iconBg}`}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : loaded ? <CheckCircle2 className="w-4 h-4" /> : icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{label}</div>
          <div className="text-[10px] sm:text-xs text-slate-400">Fichier Excel (.xlsx)</div>

          {loading && (
            <div className="text-[10px] sm:text-xs text-sky mt-2 italic">🤖 Analyse IA des colonnes…</div>
          )}

          {loaded && mapping && (
            <div className="mt-2 space-y-1">
              <div className="text-[10px] sm:text-xs text-emerald truncate">✓ {file?.name} — {mapping.data.length} lignes</div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {mapping.aiUsed ? (
                  <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 flex items-center gap-0.5 ${confClass}`}>
                    <Bot className="w-3 h-3" /> IA {mapping.confidence}%
                  </span>
                ) : (
                  <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full bg-amber/15 text-amber flex items-center gap-0.5">
                    <Zap className="w-3 h-3" /> Heuristique
                  </span>
                )}
                {mapping.syntheticKey && (
                  <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full bg-indigo/15 text-indigo">
                    🔗 Clé synth.
                  </span>
                )}
                {mapping.warnings.length > 0 && (
                  <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full bg-amber/15 text-amber flex items-center gap-0.5">
                    <AlertTriangle className="w-3 h-3" /> {mapping.warnings.length}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onShowMapping(); }}
                className="text-[10px] text-sky hover:text-emerald underline mt-1"
              >
                Voir le mapping →
              </button>
            </div>
          )}
        </div>
      </div>
    </label>
  );
}
