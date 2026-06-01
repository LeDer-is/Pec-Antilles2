import { useState, useCallback } from 'react';
import type { MappingResult, ImpayeRow } from '@/types';
import { smartLoadFile } from '@/lib/ai';
import { parseImpayesCSV } from '@/lib/engine';

export interface RecetteState { file: File | null; mapping: MappingResult | null; loading: boolean }
export interface SecuState { file: File | null; mapping: MappingResult | null; loading: boolean }
export interface MutuelleState { file: File; mapping: MappingResult | null }
export interface ImpayesState { file: File | null; rows: ImpayeRow[] }

// Lazy-load readXlsx — only pulled in when user uploads a file
const lazyReadXlsx = async (file: File) => {
  const { readXlsx } = await import('@/lib/xlsx-reader');
  return readXlsx(file);
};

export function useUpload() {
  const [recettes, setRecettes] = useState<RecetteState>({ file: null, mapping: null, loading: false });
  const [secu, setSecu] = useState<SecuState>({ file: null, mapping: null, loading: false });
  const [mutuelles, setMutuelles] = useState<MutuelleState[]>([]);
  const [impayesM1, setImpayesM1] = useState<ImpayesState>({ file: null, rows: [] });
  const [alert, setAlert] = useState<{ type: 'error' | 'success' | 'info'; msg: string } | null>(null);

  const handleUpload = useCallback(async (file: File, type: 'recettes' | 'secu' | 'mutuelle', idx?: number) => {
    if (!file.name.match(/\.(xlsx?|csv)$/i)) {
      setAlert({ type: 'error', msg: 'Fichier Excel (.xlsx) ou CSV (.csv) requis' });
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

  const removeMutuelle = useCallback((idx: number) => {
    setMutuelles(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleImpayesUpload = useCallback(async (file: File) => {
    if (!file.name.match(/\.csv$/i)) {
      setAlert({ type: 'error', msg: 'Fichier CSV requis pour les impayés reportés' });
      return;
    }
    try {
      const text = await file.text();
      const rows = parseImpayesCSV(text);
      if (!rows.length) throw new Error('Aucune ligne valide dans le CSV');
      setImpayesM1({ file, rows });
      setAlert({ type: 'success', msg: `${rows.length} impayé(s) du mois précédent chargé(s)` });
    } catch (err) {
      setAlert({ type: 'error', msg: (err as Error).message });
    }
  }, []);

  const resetUpload = useCallback(() => {
    setRecettes({ file: null, mapping: null, loading: false });
    setSecu({ file: null, mapping: null, loading: false });
    setMutuelles([]);
    setImpayesM1({ file: null, rows: [] });
    setAlert(null);
  }, []);

  return {
    recettes, secu, mutuelles, impayesM1, alert, setAlert,
    handleUpload, removeMutuelle, handleImpayesUpload, resetUpload,
    setImpayesM1,
  };
}
