// Types centraux PEC Antilles

export type Statut = 'OK' | 'ÉCART' | 'IMPAYÉ' | 'À VÉRIFIER' | 'ORPHELIN' | 'ANTÉRIEUR' | 'RÉGLÉ M-1' | 'IMPAYÉ PERSISTANT' | 'ANTÉRIEUR INCONNU';

export interface RecetteRow {
  fse: string;
  patient: string;
  patientNorm: string;
  date: string;
  montant: number;
  attenduAMO: number;
  attenduAMC: number;
  resteCharge: number;
  paye: number;
  restePayer: number;
  orgAMO: string;
  orgAMC: string;
  typeLot: string;
  mode: string;
  isCMU: boolean;
}

export interface SecuRow {
  fse: string;
  patient: string;
  patientNorm: string;
  montantAMO: number;
  date: string;
}

export interface MutuelleRow {
  fse: string;
  type: string;
  patient: string;
  patientNorm: string;
  montantAMC: number;
  date: string;
}

export interface ImpayeRow {
  fse: string;
  patient: string;
  patientNorm: string;
  date: string;
  montant: number;
  resteCharge: number;
  attenduAMO: number;
  attenduAMC: number;
  moisOrigine: string;
  ageMois: number;
}

export interface ResultItem {
  fse: string;
  patient: string;
  patientNorm: string;
  date: string;
  montant: number;
  attenduAMO: number;
  attenduAMC: number;
  resteCharge: number;
  recuAMO: number;
  recuAMC: number;
  totalRecu: number;
  ecart: number;
  statut: Statut;
  matchType: string;
  mutSources: string;
  isCMU: boolean;
  confidence: number;
  warnings: string[];
  userValidated?: boolean;
  validatedAt?: string;
  previousStatut?: Statut;
  secuDetail?: { patient: string; montantAMO: number };
  mutDetail?: { lines: { patient: string; montantAMC: number; type: string }[] };
  moisOrigine?: string;
  ageMois?: number;
  resolvedBy?: { type: 'secu' | 'mutuelle'; montant: number; patient: string; date: string };
}

export interface Recap {
  totalFact: number;
  totalAMO: number;
  totalAMC: number;
  totalRecu: number;
  reste: number;
  taux: number;
  nOK: number;
  nEcart: number;
  nImpaye: number;
  nVerif: number;
  nOrphelin: number;
  nAnterieur: number;
  totalAnterieurAMO: number;
  totalAnterieurAMC: number;
  nRegleM1: number;
  nImpayePersistant: number;
  nAnterieurInconnu: number;
  totalRegleM1: number;
  totalImpayePersistant: number;
  total: number;
}

export interface AnalysisResults {
  items: ResultItem[];
  recap: Recap;
}

export interface ColumnMapping {
  [field: string]: string | undefined;
}

export interface MappingResult {
  data: Record<string, unknown>[];
  headers: string[];
  mapping: ColumnMapping;
  syntheticKey: { fields: string[]; separator: string } | null;
  confidence: number;
  warnings: string[];
  notes: string;
  aiUsed: boolean;
}

export interface FileState {
  file: File | null;
  mapping: MappingResult | null;
  loading: boolean;
}

export type FilterKey = 'ALL' | Statut;
