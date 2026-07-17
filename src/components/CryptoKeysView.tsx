import { useState, type FormEvent } from 'react';
import { KeyRound, Layers, Lock, RefreshCw, Unlock } from 'lucide-react';

interface CryptoKeysViewProps {
  vaultUnlocked: boolean;
  onToggleVault: (passphrase: string) => Promise<boolean>;
}

export default function CryptoKeysView({ vaultUnlocked, onToggleVault }: CryptoKeysViewProps) {
  const [passphrase, setPassphrase] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState([
    'Private browser vault initialized.',
    'Persistent records use AES-256-GCM envelope encryption.',
    'Share packages are encrypted locally with Web Crypto.',
    'Generation sends only confirmed reference sets to Hugging Face over HTTPS.',
  ]);

  const handleToggle = async (event: FormEvent) => {
    event.preventDefault();
    if (!vaultUnlocked && !passphrase.trim()) return;
    setIsProcessing(true);
    setLogs((current) => [...current, 'Applying local privacy-screen state…']);
    const success = await onToggleVault(passphrase);
    setIsProcessing(false);
    if (success) {
      setLogs((current) => [...current, vaultUnlocked
        ? 'Portrait previews locked in this browser session.'
        : 'Portrait previews unlocked for this browser session.']);
      setPassphrase('');
    } else {
      setLogs((current) => [...current, 'Passphrase must contain at least six characters.']);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-16">
      <div className="text-center md:text-left max-w-xl space-y-4">
        <h1 className="text-headline-lg-mobile md:text-headline-lg text-primary font-bold flex items-center justify-center md:justify-start gap-2">
          <KeyRound size={28} className="text-secondary" /> Privacy & Vault
        </h1>
        <p className="text-body-md text-on-surface-variant leading-relaxed">
          Each browser receives an isolated workspace. Photos and memories are encrypted locally before IndexedDB storage. When you explicitly generate or refine an image, the selected references are decrypted in memory and sent over HTTPS to the Hugging Face model Space disclosed in the creation screen.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        <div className="md:col-span-7 bg-surface-container-lowest border border-outline-variant p-6 rounded-2xl shadow-sm space-y-6">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-xl ${vaultUnlocked ? 'bg-emerald-100 text-emerald-700' : 'bg-secondary-container text-secondary'}`}>
              {vaultUnlocked ? <Unlock size={32} /> : <Lock size={32} />}
            </div>
            <div>
              <h2 className="text-lg text-primary font-bold">Preview Status: {vaultUnlocked ? 'UNLOCKED' : 'LOCKED'}</h2>
              <p className="text-xs text-on-surface-variant">
                {vaultUnlocked
                  ? 'Portrait previews are visible in this browser session.'
                  : 'Portrait previews are covered in the subject library. Stored records remain encrypted in either state.'}
              </p>
            </div>
          </div>

          <form onSubmit={handleToggle} className="space-y-4">
            {!vaultUnlocked && (
              <div className="flex flex-col gap-2">
                <label className="text-label-md text-primary font-semibold" htmlFor="vault-passphrase">Session Passphrase</label>
                <input
                  id="vault-passphrase"
                  type="password"
                  placeholder="Enter at least 6 characters"
                  value={passphrase}
                  minLength={6}
                  onChange={(event) => setPassphrase(event.target.value)}
                  disabled={isProcessing}
                  className="bg-surface-bright border border-outline-variant rounded-lg px-4 py-3 text-sm font-mono text-on-surface focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
                />
              </div>
            )}
            <button type="submit" disabled={isProcessing || (!vaultUnlocked && !passphrase)} className="w-full bg-primary text-on-primary text-label-md uppercase py-3.5 rounded-full hover:opacity-90 disabled:opacity-50 font-bold shadow-md flex items-center justify-center gap-2">
              {isProcessing ? <><RefreshCw size={16} className="animate-spin" /><span>Updating…</span></> : vaultUnlocked ? <><Lock size={16} /><span>Lock Previews</span></> : <><Unlock size={16} /><span>Unlock Previews</span></>}
            </button>
          </form>

          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 space-y-2 text-xs">
            <strong className="text-primary flex items-center gap-1.5"><Layers size={14} className="text-secondary" /> End-to-End Encrypted Sharing</strong>
            <p className="text-on-surface-variant leading-relaxed text-[11px]">
              Share payloads are encrypted in your browser with a random 256-bit AES-GCM key. Both ciphertext and key stay after the URL hash, which browsers do not send to the static host. Anyone holding the complete link can decrypt the shared memory.
            </p>
          </div>
        </div>

        <div className="md:col-span-5 bg-primary text-on-primary border-t-4 border-secondary-fixed text-left rounded-b-xl p-6 font-mono text-[10px] space-y-2 shadow-md h-[320px] overflow-y-auto" aria-live="polite">
          <div className="flex items-center justify-between text-secondary-fixed-dim border-b border-white/10 pb-2 mb-2 font-semibold">
            <span>Privacy Log</span><span>AES_256_GCM</span>
          </div>
          {logs.map((log, index) => <div key={`${index}-${log}`} className="flex gap-2"><span className="text-secondary-fixed-dim">&gt;</span><span className="text-white/80">{log}</span></div>)}
          <div className="animate-pulse h-3 w-1.5 bg-secondary-fixed mt-1" />
        </div>
      </div>
    </div>
  );
}
