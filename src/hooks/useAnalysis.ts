import { useState, useCallback } from 'react';
import type { AnalysisResults, FilterKey, ResultItem, Statut } from '@/types';
import { applyMappingToDataset } from '@/lib/ai';
import { parseRecettes, parseSecu, parseMutuelle, rapprochement, buildRecap } from '@/lib/engine';
import type { RecetteState, SecuState, MutuelleState, ImpayesState } from './useUpload';

export function useAnalysis() {
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<ResultItem | null>(null);
  const [alert, setAlert] = useState<{ type: 'error' | 'success' | 'info'; msg: string } | null>(null);

  const runAnalysis = useCallback(async (
    recettes: RecetteState,
    secu: SecuState,
    mutuelles: MutuelleState[],
    impayesM1: ImpayesState,
  ) => {
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
      const res = rapprochement(recettesRows, secuRows, mutRows, impayesM1.rows);
      setResults(res);
      setAlert(null);
    } catch (err) {
      setAlert({ type: 'error', msg: (err as Error).message });
    } finally {
      setLoading(null);
    }
  }, []);

  const reset = useCallback(() => {
    setResults(null);
    setFilter('ALL');
    setSearch('');
    setAlert(null);
  }, []);

  const applyUserVerdict = useCallback((fse: string, newStatut: Statut | 'KEEP') => {
    if (newStatut === 'KEEP') return;
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
  }, []);

  return {
    loading, results, filter, search, selectedItem, alert,
    setFilter, setSearch, setSelectedItem, setAlert,
    runAnalysis, reset, applyUserVerdict,
  };
}
