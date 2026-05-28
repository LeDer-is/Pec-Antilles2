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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-2 sm:p-4" onClick={onClose}>
      <div className="bg-raised border border-white/10 rounded-xl p-3 sm:p-5 w-full max-w-full sm:max-w-2xl md:max-w-4xl relative my-2 sm:my-6" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-2 right-2 w-8 h-8 rounded hover:bg-white/5 flex items-center justify-center z-10">
          <X className="w-4 h-4" />
        </button>
        <h2 className="text-base sm:text-xl font-semibold bg-gradient-to-r from-indigo to-emerald bg-clip-text text-transparent mb-1 pr-8">
          🤖 Mapping colonnes
        </h2>
        <p className="text-[10px] sm:text-xs text-slate-400 mb-3 sm:mb-4">
          {schema.label} · <span className="break-all">{filename}</span> · {mapping.headers.length} col. ·{' '}
          <span className={`${mapping.confidence >= 80 ? 'text-emerald' : mapping.confidence >= 50 ? 'text-amber' : 'text-rose'}`}>
            {mapping.aiUsed ? `🤖 IA ${mapping.confidence}%` : `⚡ Heuristique ${mapping.confidence}%`}
          </span>
        </p>

        {/* Mobile: card view / Desktop: table */}
        <div className="hidden sm:block overflow-x-auto border border-white/5 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-surface text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="text-left p-2">Champ</th>
                <th className="text-left p-2">Colonne</th>
                <th className="text-left p-2 hidden md:table-cell">Description</th>
                <th className="text-center p-2 w-14">Statut</th>
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
                    <td className="p-2 text-xs"><strong>{field}</strong>{isReq && <span className="ml-1 text-[9px] text-rose">*</span>}</td>
                    <td className="p-2 text-xs">
                      {mapped ? <code className="bg-surface px-1.5 py-0.5 rounded text-sky break-all">{mapped}</code>
                        : isSynth ? <code className="bg-surface px-1.5 py-0.5 rounded text-indigo break-all">{mapping.syntheticKey!.fields.join(' + ')}</code>
                        : <span className="text-slate-500">—</span>}
                    </td>
                    <td className="p-2 text-xs text-slate-400 hidden md:table-cell">{schema.descriptions[field]}</td>
                    <td className="p-2 text-center">{mapped ? '✅' : isSynth ? '🔗' : isReq ? '❌' : '➖'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile card view */}
        <div className="sm:hidden space-y-2">
          {allFields.map(field => {
            const isReq = (schema.required as readonly string[]).includes(field);
            const mapped = mapping.mapping[field];
            const isSynth = field === 'fse' && !mapped && mapping.syntheticKey;
            const bg = mapped ? 'bg-emerald/5 border-emerald/20' : isSynth ? 'bg-indigo/5 border-indigo/20' : isReq ? 'bg-rose/5 border-rose/20' : 'bg-white/[0.02] border-white/5 opacity-60';
            const icon = mapped ? '✅' : isSynth ? '🔗' : isReq ? '❌' : '➖';
            return (
              <div key={field} className={`p-2.5 rounded-lg border ${bg}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">{icon} {field}{isReq && <span className="text-rose ml-1">*</span>}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {mapped ? <code className="text-sky break-all">{mapped}</code>
                    : isSynth ? <code className="text-indigo break-all">{mapping.syntheticKey!.fields.join(' + ')}</code>
                    : 'Non mappé'}
                </div>
              </div>
            );
          })}
        </div>

        {mapping.warnings.length > 0 && (
          <div className="mt-3 p-2.5 rounded-lg bg-amber/10 border border-amber/30 text-xs">
            <strong className="text-amber">⚠️ Avertissements :</strong>
            <ul className="list-disc ml-4 mt-1 space-y-0.5">
              {mapping.warnings.map((w, i) => <li key={i} className="break-words">{w}</li>)}
            </ul>
          </div>
        )}

        <div className="mt-4">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">🔍 Aperçu (3 lignes)</h4>
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            <div className="border border-white/5 rounded-lg inline-block min-w-full">
              <table className="w-full text-[10px] sm:text-xs">
                <thead className="bg-surface">
                  <tr>
                    {Object.entries(mapping.mapping).filter(([_, h]) => h).map(([f, h]) => (
                      <th key={f} className="text-left p-1.5 sm:p-2 whitespace-nowrap">
                        {f}<br /><span className="text-[8px] sm:text-[9px] text-slate-500 font-normal">{h}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mapping.data.slice(0, 3).map((row, i) => (
                    <tr key={i} className="border-t border-white/5">
                      {Object.entries(mapping.mapping).filter(([_, h]) => h).map(([f, h]) => (
                        <td key={f} className="p-1.5 sm:p-2 whitespace-nowrap max-w-[120px] truncate">{String((row as any)[h!] ?? '').slice(0, 30)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
