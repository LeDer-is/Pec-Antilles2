import { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { getApiKey, setApiKey, testApiKey } from '@/lib/ai';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ApiKeyModal({ open, onClose }: Props) {
  const [key, setKey] = useState('');
  const [status, setStatus] = useState<{ type: 'idle' | 'testing' | 'ok' | 'error'; msg: string }>({ type: 'idle', msg: '' });

  useEffect(() => {
    if (open) {
      const current = getApiKey();
      setKey(current);
      if (current) setStatus({ type: 'idle', msg: `Clé enregistrée (${current.slice(0, 15)}…${current.slice(-4)})` });
      else setStatus({ type: 'idle', msg: 'Aucune clé enregistrée' });
    }
  }, [open]);

  if (!open) return null;

  const save = async () => {
    const k = key.trim();
    if (!k) {
      setApiKey('');
      setStatus({ type: 'idle', msg: 'Clé supprimée' });
      return;
    }
    if (!k.startsWith('sk-ant-')) {
      setStatus({ type: 'error', msg: 'La clé doit commencer par sk-ant-' });
      return;
    }
    setStatus({ type: 'testing', msg: 'Test de la clé en cours…' });
    const result = await testApiKey(k);
    if (result.ok) {
      setApiKey(k);
      setStatus({ type: 'ok', msg: 'Clé validée et enregistrée !' });
      setTimeout(onClose, 1200);
    } else {
      setStatus({ type: 'error', msg: `Erreur : ${result.error}` });
    }
  };

  const clear = () => {
    if (!confirm('Supprimer la clé API ?')) return;
    setApiKey('');
    setKey('');
    setStatus({ type: 'idle', msg: 'Clé supprimée' });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-raised border border-white/10 rounded-xl p-6 w-full max-w-lg relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded hover:bg-white/5 flex items-center justify-center">
          <X className="w-4 h-4" />
        </button>
        <h2 className="text-lg font-semibold mb-2">🔑 Clé API Anthropic</h2>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Stockée <strong>uniquement dans ton navigateur</strong>. Envoyée seulement à l'API Anthropic. Créer une clé :{' '}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" className="text-sky hover:underline">console.anthropic.com</a>
        </p>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="sk-ant-api03-…"
          className="w-full px-3 py-2 bg-surface border border-white/10 rounded font-mono text-xs"
        />
        <div className={`text-xs mt-3 min-h-[20px] flex items-center gap-2 ${
          status.type === 'ok' ? 'text-emerald' :
          status.type === 'error' ? 'text-rose' :
          status.type === 'testing' ? 'text-amber' : 'text-slate-400'
        }`}>
          {status.type === 'testing' && <Loader2 className="w-3 h-3 animate-spin" />}
          {status.type === 'ok' && <CheckCircle2 className="w-3 h-3" />}
          {status.type === 'error' && <XCircle className="w-3 h-3" />}
          {status.msg}
        </div>
        <div className="flex items-center justify-between mt-5">
          <button onClick={clear} className="btn-ghost text-rose text-xs">🗑 Supprimer</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost">Annuler</button>
            <button onClick={save} disabled={status.type === 'testing'} className="btn-primary">Enregistrer & Tester</button>
          </div>
        </div>
      </div>
    </div>
  );
}
