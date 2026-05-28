import type { Recap } from '@/types';
import { fmt, pct } from '@/lib/utils';

interface Props {
  recap: Recap;
}

export default function KpiCards({ recap }: Props) {
  const totalAnterieur = recap.totalAnterieurAMO + recap.totalAnterieurAMC;
  return (
    <div className="space-y-2 sm:space-y-3 w-full">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-3">
        <Kpi label="Total facturé" value={fmt(recap.totalFact)} color="text-white" delay={0} />
        <Kpi label="Reçu AMO" value={fmt(recap.totalAMO)} color="text-sky" delay={1} />
        <Kpi label="Reçu AMC" value={fmt(recap.totalAMC)} color="text-indigo" delay={2} />
        <Kpi label="Total encaissé" value={fmt(recap.totalRecu)} color="text-emerald" delay={3} />
        <Kpi label="Reste à percevoir" value={fmt(recap.reste)} color="text-rose" delay={4} />
        <Kpi label="Taux recouvrement" value={pct(recap.taux)} color="text-amber" delay={5} />
      </div>
      {(recap.nRegleM1 > 0 || recap.nImpayePersistant > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          {recap.nRegleM1 > 0 && <Kpi label="✅ Réglés M-1" value={`${recap.nRegleM1} (${fmt(recap.totalRegleM1)})`} color="text-emerald" delay={10} />}
          {recap.nImpayePersistant > 0 && <Kpi label="⏳ Imp. persistants" value={`${recap.nImpayePersistant} (${fmt(recap.totalImpayePersistant)})`} color="text-rose" delay={11} />}
          {recap.nAnterieurInconnu > 0 && <Kpi label="⚠️ Ant. inconnu" value={`${recap.nAnterieurInconnu}`} color="text-amber" delay={12} />}
          {recap.nRegleM1 > 0 && recap.totalFact > 0 && <Kpi label="Encaissé réel" value={fmt(recap.totalRecu + recap.totalRegleM1)} color="text-cyan-400" delay={13} />}
        </div>
      )}
      {recap.nAnterieur > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          <Kpi label="Paiements antérieurs" value={`${recap.nAnterieur}`} color="text-violet-400" delay={6} />
          <Kpi label="Ant. AMO" value={fmt(recap.totalAnterieurAMO)} color="text-violet-400" delay={7} />
          <Kpi label="Ant. AMC" value={fmt(recap.totalAnterieurAMC)} color="text-violet-400" delay={8} />
          <Kpi label="Total antérieur" value={fmt(totalAnterieur)} color="text-violet-400" delay={9} />
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, color, delay }: { label: string; value: string; color: string; delay: number }) {
  return (
    <div className="bg-raised border border-white/5 rounded-lg p-2 sm:p-3 md:p-4 animate-fade-in-up overflow-hidden min-w-0" style={{ animationDelay: `${delay * 60}ms` }}>
      <div className="text-[8px] sm:text-[9px] md:text-[10px] text-slate-400 uppercase tracking-wider mb-0.5 sm:mb-1 truncate">{label}</div>
      <div className={`text-[11px] sm:text-sm md:text-lg font-bold ${color} truncate`}>{value}</div>
    </div>
  );
}
