import { useState, type FormEvent } from 'react';
import { ArrowLeft, Check, Copy, Download, Key, RefreshCw, Share2, Sparkles } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { encryptSharedPayload } from '../lib/crypto';
import { shareImageReference } from '../data/images';
import type { GenerationProgress } from '../lib/generation';
import type { Memory, Subject } from '../types';

interface MemoryDetailViewProps {
  memory: Memory;
  subjects: Subject[];
  onBack: () => void;
  onUpdateMemory: (updated: Memory) => void;
}

export default function MemoryDetailView({ memory, subjects, onBack, onUpdateMemory }: MemoryDetailViewProps) {
  const [feedback, setFeedback] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [actionError, setActionError] = useState('');
  const [refinementStatus, setRefinementStatus] = useState('');
  const includedSubjects = subjects.filter((subject) => memory.subjectsIncluded.includes(subject.id));

  const handleRefine = async (event: FormEvent) => {
    event.preventDefault();
    if (!feedback.trim()) return;
    setIsRefining(true);
    setActionError('');
    setRefinementStatus('Preparing the current image and identity references…');
    try {
      const updated = await apiFetch<Memory>(`/api/memories/${memory.id}/edit`, {
        method: 'POST',
        body: JSON.stringify({ feedbackPrompt: feedback, externalProcessingConsent: true }),
      }, { onProgress: (progress: GenerationProgress) => setRefinementStatus(progress.message) });
      setFeedback('');
      onUpdateMemory(updated);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The memory could not be refined.');
    } finally {
      setIsRefining(false);
      setRefinementStatus('');
    }
  };

  const handleGenerateShare = async () => {
    setIsSharing(true);
    setActionError('');
    try {
      const shareableMemory = { ...memory, imageUrl: shareImageReference(memory.imageUrl) };
      const { encryptedPayload, decryptionKey } = await encryptSharedPayload(shareableMemory);
      const origin = window.location.origin + window.location.pathname;
      const parameters = new URLSearchParams({ payload: encryptedPayload, key: decryptionKey });
      const link = `${origin}#share?${parameters.toString()}`;
      if (link.length > 60_000) {
        throw new Error('This memory is too large for a self-contained share link. Download it instead.');
      }
      setShareLink(link);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The secure share could not be generated.');
    } finally {
      setIsSharing(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setActionError('Clipboard access was blocked. Select and copy the link manually.');
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-2 sm:px-4 md:px-12 h-16 bg-surface-container-lowest border-b border-outline-variant">
        <button onClick={onBack} className="text-primary hover:bg-surface-container-low px-3 sm:px-4 py-2 flex items-center gap-2 text-xs sm:text-sm uppercase rounded-full font-bold">
          <ArrowLeft size={16} /> <span className="hidden xs:inline">Back to Memories</span><span className="xs:hidden">Back</span>
        </button>
        <div className="tracking-widest text-primary uppercase text-center flex-grow hidden md:block text-sm font-bold">TOTAL RECALL</div>
        <div className="bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant flex items-center gap-1.5 text-xs font-semibold text-secondary">
          <Key size={12} /> PRIVATE VAULT
        </div>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start pt-12">
        <div className="md:col-span-8 space-y-6">
          <div className="w-full bg-surface-container-lowest border border-outline-variant p-4 md:p-8 rounded-2xl shadow-sm">
            <div className="w-full aspect-[4/3] md:aspect-[16/9] relative bg-surface-dim overflow-hidden rounded-xl border border-outline-variant">
              <img src={memory.imageUrl} alt={memory.title} className="absolute inset-0 w-full h-full object-cover transition-all duration-500" referrerPolicy="no-referrer" />
              {memory.editLogs?.length > 0 && (
                <div className="absolute top-4 right-4 bg-secondary-container/90 text-on-secondary-container font-mono text-[9px] px-2 py-1 rounded border border-secondary shadow-md uppercase tracking-wider">
                  Refined ×{memory.editLogs.length}
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-between items-center mt-6 gap-4 border-t border-outline-variant pt-6">
              <div className="flex flex-wrap gap-4">
                <a href={memory.imageUrl} target="_blank" rel="noreferrer" download={`memory-${memory.id}.jpg`} className="flex items-center gap-2 text-on-surface-variant hover:text-primary text-sm font-semibold uppercase tracking-wider">
                  <Download size={16} /> Download
                </a>
                <button onClick={handleGenerateShare} disabled={isSharing} className="flex items-center gap-2 text-on-surface-variant hover:text-primary text-sm font-semibold uppercase tracking-wider disabled:opacity-50">
                  <Share2 size={16} /> {isSharing ? 'Encrypting…' : 'Secure Share'}
                </button>
              </div>
              <span className="text-xs font-mono text-outline flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> AES-256-GCM record</span>
            </div>

            {shareLink && (
              <div className="mt-6 bg-surface-container-low p-4 rounded-xl border border-secondary/30 space-y-2 animate-fade-in">
                <div className="flex justify-between gap-3 text-xs text-secondary font-bold font-mono"><span>Client-side encrypted share created</span><span>AES-GCM</span></div>
                <p className="text-[11px] text-on-surface-variant">No server copy was created. The encrypted package and key stay in the URL fragment; the link does not expire automatically, and anyone holding it can decrypt this memory.</p>
                <div className="flex gap-2">
                  <input type="text" readOnly value={shareLink} aria-label="Encrypted share link" className="bg-surface-bright border border-outline-variant rounded-lg px-3 py-2 text-xs font-mono text-primary flex-1 min-w-0 select-all" />
                  <button onClick={copyToClipboard} className="bg-primary text-on-primary text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5">
                    {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
            {actionError && <p role="alert" className="mt-4 bg-error-container text-on-error-container border border-error/20 rounded-lg p-3 text-sm">{actionError}</p>}
          </div>

          {memory.sourcePrompt && (
            <details className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
              <summary className="cursor-pointer text-sm font-bold text-primary uppercase tracking-wider">Generation Direction</summary>
              <p className="mt-3 text-sm text-on-surface-variant leading-relaxed">{memory.sourcePrompt}</p>
            </details>
          )}
        </div>

        <aside className="md:col-span-4 space-y-8">
          <div className="space-y-4">
            <p className="text-xs text-secondary uppercase tracking-widest font-semibold">{memory.date}</p>
            <h1 className="text-3xl font-bold text-primary leading-tight">{memory.title}</h1>
            <p className="text-body-md text-on-surface-variant leading-relaxed">{memory.description}</p>
            <p className="text-[10px] font-mono text-outline uppercase">{memory.generationEngine || 'Generation engine unavailable'}</p>
            {memory.referenceCount !== undefined && <p className="text-[10px] font-mono text-outline uppercase">{memory.referenceCount} identity {memory.referenceCount === 1 ? 'reference' : 'references'} · seed {memory.generationSeed ?? 'random'}</p>}
          </div>

          <section className="space-y-4">
            <h2 className="text-primary border-b border-outline-variant pb-2 uppercase tracking-widest font-semibold text-xs">Subjects Included</h2>
            <div className="flex flex-col gap-2">
              {includedSubjects.map((subject, index) => (
                <div key={subject.id} className="bg-surface-container-low p-4 flex items-center gap-4 border border-outline-variant/40 rounded-xl">
                  <img src={subject.avatarUrl} alt={subject.name} className="w-12 h-12 object-cover border border-outline-variant rounded-full" referrerPolicy="no-referrer" />
                  <div><div className="font-bold text-primary">{subject.name}</div><div className="text-xs text-on-surface-variant">{index === 0 ? 'Primary Subject Anchor' : 'Secondary Subject Anchor'}</div></div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4 border-t border-outline-variant pt-6">
            <h2 className="text-primary uppercase tracking-widest font-semibold text-xs">Refine Memory</h2>
            <form onSubmit={handleRefine} className="space-y-3">
              <input type="text" placeholder="e.g. make the evening lighting warmer…" value={feedback} maxLength={800} onChange={(event) => setFeedback(event.target.value)} disabled={isRefining} className="bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary w-full" />
              <button type="submit" disabled={isRefining || !feedback.trim()} className="w-full bg-primary text-on-primary text-label-md uppercase py-3 rounded-full disabled:opacity-50 font-bold shadow-md flex items-center justify-center gap-1.5">
                {isRefining ? <><RefreshCw size={16} className="animate-spin" /> Regenerating…</> : <><Sparkles size={16} /> Regenerate Refinement</>}
              </button>
              <p className="text-[10px] text-on-surface-variant leading-relaxed">Refining performs another real generation and sends the current image plus identity references to the same Hugging Face Space.</p>
              {refinementStatus && <p className="text-[10px] font-mono text-secondary" aria-live="polite">{refinementStatus}</p>}
            </form>
          </section>

          {memory.editLogs?.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-primary uppercase tracking-widest font-semibold text-xs">Revision History</h2>
              {memory.editLogs.slice().reverse().map((log) => (
                <div key={log.id} className="bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs">
                  <img src={log.imageUrl} alt="Previous generated version" className="w-full aspect-video object-cover rounded-md border border-outline-variant mb-2" />
                  <p className="font-semibold text-primary">{log.prompt}</p>
                  <p className="text-on-surface-variant mt-1">{log.outcomeDescription}</p>
                  <time className="font-mono text-[9px] text-outline mt-2 block">{log.date}</time>
                </div>
              ))}
            </section>
          )}
        </aside>
      </main>
    </div>
  );
}
