import { X } from 'lucide-react';
import type { MappingResult } from '@/types';
import { COLUMN_SCHEMAS } from '@/lib/ai';

interface Props {
  open: boolean;
  onClose: () => void;
  mapping: MappingResult | null;
  fileType: 'recettes' | 'secu' | null;
  filename: string;
}

export default function MappingModal({ open, onClose, mapping, fileType, filename }: Props) {
  if (!open || !mapping || !fileType) return null;
  const schema = COLUMN_SCHEMAS[fileType];
  const allFields = [...schema.required, ...schema.optional];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center p-6 overflow-y-auto" onClick={onClose}>
      <div className="bg-raised border border-white/10 rounded-xl p-6 w-full max-w-4xl relative my-10" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded hover:bg-white/5 flex items-center justify-center">
          <X className="w-4 h-4" />
        </button>
        <h2 className="text-xl font-semibold bg-gradient-to-r from-indigo to-emerald bg-clip-text text-transparent mb-1">
          🤖 Mapping intelligent des colonnes
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          {schema.label} · {filename} · {mapping.headers.length} colonnes détectées ·{' '}
          <span className={`${mapping.confidence >= 80 ? 'text-emerald' : mapping.confidence >= 50 ? 'text-amber' : 'text-rose'}`}>
            {mapping.aiUsed ? `🤖 IA ${mapping.confidence}%` : `⚡ Heuristique ${mapping.confidence}%`}
          </span>
          {mapping.notes && ` — ${mapping.notes}`}
        </p>

        <div className="overflow-x-auto border border-white/5 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-surface text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="text-left p-2.5">Champ cible</th>
                <th className="text-left p-2.5">Colonne détectée</th>
                <th className="text-left p-2.5">Description</th>
                <th className="text-center p-2.5 w-20">Statut</th>
              </tr>
            </thead>
            <tbody>
              {allFields.map(field => {
                const isReq = (schema.required as readonly string[]).includes(field);
                const mapped = mapping.mapping[field];
                const isSynth = field === 'fse' && !mapped && mapping.syntheticKey;
                const bg = mapped ? 'bg-emerald/5' : isSynth ? 'bg-indigo/5' : isReq ? 'bg-rose/5' : 'opacity-50';
                return (
                  <tr key={field} className={`border-t border-white/5 ${bg}`}>
                    <td className="p-2.5"><strong>{field}</strong>{isReq && <span className="ml-2 text-[9px] text-rose">REQUIS</span>}</td>
                    <td className="p-2.5">
                      {mapped ? <code className="bg-surface px-2 py-0.5 rounded text-xs text-sky">{mapped}</code>
                        : isSynth ? <code className="bg-surface px-2 py-0.5 rounded text-xs text-indigo">{mapping.syntheticKey!.fields.join(' + ')}</code>
                        : <span className="text-slate-500">—</span>}
                    </td>
                    <td className="p-2.5 text-xs text-slate-400">{schema.descriptions[field]}</td>
                    <td className="p-2.5 text-center">{mapped ? '✅' : isSynth ? '🔗' : isReq ? '❌' : '➖'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {mapping.warnings.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-amber/10 border border-amber/30 text-xs">
            <strong className="text-amber">⚠️ Avertissements :</strong>
            <ul className="list-disc ml-5 mt-1 space-y-0.5">
              {mapping.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}

        <div className="mt-5">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">🔍 Aperçu (3 premières lignes)</h4>
          <div className="overflow-x-auto border border-white/5 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-surface">
                <tr>
                  {Object.entries(mapping.mapping).filter(([_, h]) => h).map(([f, h]) => (
                    <th key={f} className="text-left p-2 whitespace-nowrap">
                      {f}<br /><span className="text-[9px] text-slate-500 font-normal">{h}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mapping.data.slice(0, 3).map((row, i) => (
                  <tr key={i} className="border-t border-white/5">
                    {Object.entries(mapping.mapping).filter(([_, h]) => h).map(([f, h]) => (
                      <td key={f} className="p-2 whitespace-nowrap">{String((row as any)[h!] ?? '').slice(0, 40)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
