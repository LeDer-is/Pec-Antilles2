import { useMemo, useState, useEffect, useCallback } from 'react';
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { ResultItem, FilterKey, Recap } from '@/types';
import { fmt } from '@/lib/utils';

interface Props {
  items: ResultItem[];
  filter: FilterKey;
  setFilter: (f: FilterKey) => void;
  search: string;
  setSearch: (s: string) => void;
  recap: Recap;
  onRowClick?: (item: ResultItem) => void;
}

const PAGE_SIZE = 100;

type SortKey = 'fse' | 'patient' | 'date' | 'montant' | 'recuAMO' | 'recuAMC' | 'totalRecu' | 'ecart' | 'statut';
type SortDir = 'asc' | 'desc';

const SORT_COLS: { key: SortKey; label: string; align: string }[] = [
  { key: 'fse', label: 'FSE', align: 'text-left' },
  { key: 'patient', label: 'Patient', align: 'text-left' },
  { key: 'date', label: 'Date', align: 'text-left' },
  { key: 'montant', label: 'Facturé', align: 'text-right' },
  { key: 'recuAMO', label: 'Reçu AMO', align: 'text-right' },
  { key: 'recuAMC', label: 'Reçu AMC', align: 'text-right' },
  { key: 'totalRecu', label: 'Total reçu', align: 'text-right' },
  { key: 'ecart', label: 'Écart', align: 'text-right' },
  { key: 'statut', label: 'Statut', align: 'text-left' },
];

export default function ResultsTable({ items, filter, setFilter, search, setSearch, recap, onRowClick }: Props) {
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'montant' || key === 'ecart' || key === 'totalRecu' ? 'desc' : 'asc');
    }
    setPage(0);
  }, [sortKey]);

  // Filtering
  const filtered = useMemo(() => {
    let list = items;
    if (filter === 'ALL') list = list.filter(r => r.statut !== 'ORPHELIN');
    else list = list.filter(r => r.statut === filter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.patient.toLowerCase().includes(q) || r.fse.toLowerCase().includes(q)
      );
    }
    if (sortKey) {
      const dir = sortDir === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
        return String(av).localeCompare(String(bv), 'fr') * dir;
      });
    }
    return list;
  }, [items, filter, search, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);

  // Reset page if filter changes and current page is out of range
  useEffect(() => {
    if (page > 0 && page >= totalPages) setPage(0);
  }, [page, totalPages]);

  const chips: { key: FilterKey; label: string; cls: string }[] = [
    { key: 'ALL', label: `Tout (${recap.total - recap.nOrphelin})`, cls: 'chip-all' },
    { key: 'OK', label: `✅ OK (${recap.nOK})`, cls: 'chip-ok' },
    { key: 'ÉCART', label: `⚠️ Écarts (${recap.nEcart})`, cls: 'chip-ecart' },
    { key: 'IMPAYÉ', label: `❌ Impayés (${recap.nImpaye})`, cls: 'chip-impaye' },
    { key: 'À VÉRIFIER', label: `🔍 À vérifier (${recap.nVerif})`, cls: 'chip-verif' },
    { key: 'ORPHELIN', label: `🔍 Orphelins (${recap.nOrphelin})`, cls: 'chip-orphelin' },
  ];

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {chips.map(c => (
          <button
            key={c.key}
            onClick={() => { setFilter(c.key); setPage(0); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filter === c.key ? 'bg-white/10 border-white/20' : 'bg-white/[0.02] border-white/5 hover:bg-white/5'
            }`}
          >
            {c.label}
          </button>
        ))}
        <div className="flex-1" />
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Rechercher patient ou FSE…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-8 pr-3 py-1.5 bg-raised border border-white/10 rounded text-xs w-64 focus:border-indigo focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border border-white/5 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                {SORT_COLS.map(col => (
                  <th
                    key={col.key}
                    className={`${col.align} p-2.5 cursor-pointer select-none hover:text-slate-200 transition-colors`}
                    onClick={() => toggleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key ? (
                        sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((r, i) => (
                <tr key={r.fse + '_' + i} className="border-t border-white/5 hover:bg-white/[0.04] cursor-pointer transition-colors" onClick={() => onRowClick?.(r)}>
                  <td className="p-2.5 font-mono text-xs">{r.fse}</td>
                  <td className="p-2.5 truncate max-w-[180px]">{r.patient}</td>
                  <td className="p-2.5 text-xs text-slate-400">{r.date ? new Date(r.date).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmt(r.montant)}</td>
                  <td className="p-2.5 text-right tabular-nums text-sky">{fmt(r.recuAMO)}</td>
                  <td className="p-2.5 text-right tabular-nums text-indigo">{fmt(r.recuAMC)}</td>
                  <td className="p-2.5 text-right tabular-nums font-semibold">{fmt(r.totalRecu)}</td>
                  <td className={`p-2.5 text-right tabular-nums ${r.ecart > 0.02 ? 'text-rose' : r.ecart < -0.02 ? 'text-emerald' : 'text-slate-500'}`}>{fmt(r.ecart)}</td>
                  <td className="p-2.5"><StatusBadge statut={r.statut} validated={r.userValidated} /></td>
                </tr>
              ))}
              {!paginated.length && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500 text-sm">Aucune ligne à afficher</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-2 border-t border-white/5 text-xs bg-raised">
            <div className="text-slate-400">
              {filtered.length} lignes · Page {page + 1}/{totalPages}
            </div>
            <div className="flex gap-1">
              <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-2 py-1 rounded hover:bg-white/5 disabled:opacity-30">← Préc.</button>
              <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="px-2 py-1 rounded hover:bg-white/5 disabled:opacity-30">Suiv. →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ statut, validated }: { statut: string; validated?: boolean }) {
  const cls = {
    'OK': 'bg-emerald/15 text-emerald border-emerald/30',
    'ÉCART': 'bg-amber/15 text-amber border-amber/30',
    'IMPAYÉ': 'bg-rose/15 text-rose border-rose/30',
    'À VÉRIFIER': 'bg-sky/15 text-sky border-sky/30',
    'ORPHELIN': 'bg-indigo/15 text-indigo border-indigo/30',
  }[statut] || 'bg-white/5 text-slate-400';
  const icon = { 'OK': '✅', 'ÉCART': '⚠️', 'IMPAYÉ': '❌', 'À VÉRIFIER': '🔍', 'ORPHELIN': '🔍' }[statut] || '';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cls}`}>
      {icon} {statut}
      {validated && <span className="text-indigo ml-0.5" title="Validé manuellement">👤✓</span>}
    </span>
  );
}
