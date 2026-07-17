import { useRef, useState, type ChangeEvent } from 'react';
import { Camera, Images, Loader2, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { prepareReferenceFile } from '../lib/imageProcessing';
import type { ReferenceEra, Subject, SubjectReference } from '../types';

interface UploadViewProps {
  existingSubject?: Subject | null;
  onUploadSuccess: (subject: Subject) => void;
}

const publicDemoReferences = [
  'https://huggingface.co/spaces/black-forest-labs/FLUX.2-dev/resolve/main/woman1.webp',
  'https://huggingface.co/spaces/black-forest-labs/FLUX.2-dev/resolve/main/person1.webp',
  'https://huggingface.co/spaces/black-forest-labs/FLUX.2-dev/resolve/main/cat_window.webp',
];

const eraLabels: Record<ReferenceEra, string> = {
  current: 'Current · latest iPhone',
  older: 'Older photo',
  recent: 'Recent photo',
  unspecified: 'Date unknown',
};

export default function UploadView({ existingSubject, onUploadSuccess }: UploadViewProps) {
  const [name, setName] = useState(existingSubject?.name || '');
  const [relationship, setRelationship] = useState<Subject['relationship']>(existingSubject?.relationship || 'Family');
  const [references, setReferences] = useState<SubjectReference[]>([]);
  const [batchEra, setBatchEra] = useState<ReferenceEra>('current');
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [sampleIndex, setSampleIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const existingCount = existingSubject?.referenceImages.length || 0;

  const prepareFiles = async (files: File[], era: ReferenceEra) => {
    if (!files.length) return;
    if (existingCount + references.length + files.length > 12) {
      setErrorMsg('Each subject can hold up to 12 reference photos.');
      return;
    }

    setIsPreparing(true);
    setErrorMsg('');
    setStatus(`Optimizing ${files.length} ${files.length === 1 ? 'photo' : 'photos'} for identity reference…`);
    try {
      const prepared: SubjectReference[] = [];
      for (const file of files) prepared.push(await prepareReferenceFile(file, era));
      setReferences((current) => [...current, ...prepared]);
      setStatus(`${prepared.length} ${prepared.length === 1 ? 'photo' : 'photos'} ready.`);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'One or more photos could not be prepared.');
    } finally {
      setIsPreparing(false);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    await prepareFiles(files, batchEra);
  };

  const handleCameraChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    await prepareFiles(files, 'current');
  };

  const usePublicDemoReference = () => {
    if (existingCount + references.length >= 12) {
      setErrorMsg('Each subject can hold up to 12 reference photos.');
      return;
    }
    const imageUrl = publicDemoReferences[sampleIndex];
    setReferences((current) => [...current, {
      id: `reference-${crypto.randomUUID()}`,
      imageUrl,
      era: batchEra,
      addedDate: new Date().toISOString(),
      fileName: 'Hugging Face public demo reference',
    }]);
    setSampleIndex((current) => (current + 1) % publicDemoReferences.length);
    setErrorMsg('');
  };

  const updateEra = (id: string, era: ReferenceEra) => {
    setReferences((current) => current.map((reference) => reference.id === id ? { ...reference, era } : reference));
  };

  const removeReference = (id: string) => {
    setReferences((current) => current.filter((reference) => reference.id !== id));
  };

  const handleSave = async () => {
    if (!existingSubject && !name.trim()) {
      setErrorMsg("Enter the subject's name.");
      return;
    }
    if (!references.length) {
      setErrorMsg('Add at least one reference photo.');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');
    setStatus('Encrypting reference set for this browser vault…');
    try {
      const path = existingSubject ? `/api/subjects/${encodeURIComponent(existingSubject.id)}/references` : '/api/subjects';
      const body = existingSubject
        ? { references }
        : { name, relationship, references };
      const result = await apiFetch<{ success: true; subject: Subject }>(path, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setStatus('Reference set secured.');
      onUploadSuccess(result.subject);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'The reference set could not be saved.');
    } finally {
      setIsSaving(false);
    }
  };

  const busy = isPreparing || isSaving;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-16">
      <div className="text-center md:text-left max-w-2xl space-y-4">
        <p className="text-label-sm tracking-widest text-secondary uppercase font-semibold">Identity References</p>
        <h1 className="text-headline-lg-mobile md:text-headline-lg text-primary font-bold">
          {existingSubject ? `Add Photos of ${existingSubject.name}` : 'Add a Subject'}
        </h1>
        <p className="text-body-md text-on-surface-variant leading-relaxed">
          Upload several clear views from older archives, recent photos, or a picture taken now with the latest iPhone. Multiple angles and expressions give the image model better identity evidence when it creates a completely new scene.
        </p>
      </div>

      {errorMsg && <div role="alert" className="bg-error-container text-on-error-container p-4 rounded-xl text-sm font-semibold border border-error/10">{errorMsg}</div>}

      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm space-y-6">
        {existingSubject ? (
          <div className="flex items-center gap-4">
            <img src={existingSubject.avatarUrl} alt="" className="w-16 h-16 rounded-xl object-cover border border-outline-variant" />
            <div><strong className="text-primary text-lg block">{existingSubject.name}</strong><span className="text-on-surface-variant text-sm">{existingCount} saved {existingCount === 1 ? 'reference' : 'references'} · {existingSubject.relationship}</span></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-label-md text-primary font-semibold" htmlFor="subjectName">Subject Name</label>
              <input id="subjectName" type="text" placeholder="e.g., Grandma Rose" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} disabled={busy} className="bg-surface-bright border border-outline-variant rounded-lg px-4 py-3 text-body-md focus:border-secondary focus:ring-1 focus:ring-secondary text-on-surface" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-label-md text-primary font-semibold" htmlFor="relationship">Relationship</label>
              <select id="relationship" value={relationship} onChange={(event) => setRelationship(event.target.value as Subject['relationship'])} disabled={busy} className="bg-surface-bright border border-outline-variant rounded-lg px-4 py-3 text-body-md focus:border-secondary focus:ring-1 focus:ring-secondary text-on-surface">
                <option value="Family">Family</option><option value="Friend">Friend</option><option value="Pet">Pet</option><option value="Other">Other</option>
              </select>
            </div>
          </div>
        )}

        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant flex items-start gap-3">
          <ShieldCheck size={20} className="text-secondary mt-0.5 shrink-0" />
          <div><p className="font-semibold text-primary text-sm">Encrypted local storage</p><p className="text-xs text-on-surface-variant mt-1">Saved photos are encrypted with AES-256-GCM in this browser. They are only transmitted to Hugging Face after you select a subject, request generation, and confirm processing.</p></div>
        </div>
      </section>

      {existingSubject && existingSubject.referenceImages.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-label-md text-on-surface-variant uppercase tracking-wider font-semibold">Already Saved</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {existingSubject.referenceImages.map((reference) => <div key={reference.id} className="shrink-0 w-24"><img src={reference.imageUrl} alt="" className="w-24 h-24 object-cover rounded-xl border border-outline-variant" /><span className="text-[10px] text-outline uppercase mt-1 block">{eraLabels[reference.era]}</span></div>)}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex flex-col gap-2 max-w-xs">
            <label htmlFor="batch-era" className="text-label-md text-primary font-semibold">Photo source or age</label>
            <select id="batch-era" value={batchEra} onChange={(event) => setBatchEra(event.target.value as ReferenceEra)} disabled={busy} className="bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2.5 text-sm text-on-surface">
              <option value="current">Current · latest iPhone / taken now</option><option value="recent">Recent digital photos</option><option value="older">Older or scanned photos</option><option value="unspecified">Date or source unknown</option>
            </select>
          </div>
          <span className="text-xs font-mono text-outline">{existingCount + references.length}/12 references</span>
        </div>
        <input ref={fileInputRef} type="file" multiple onChange={handleFileChange} accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="hidden" />
        <input ref={cameraInputRef} type="file" onChange={handleCameraChange} accept="image/*" capture="environment" className="hidden" />
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy} className="w-full border-2 border-dashed border-primary-fixed-dim bg-surface-container-low hover:bg-surface-container-high rounded-xl p-10 flex flex-col items-center justify-center group disabled:opacity-50">
          <span className="w-16 h-16 rounded-full bg-primary-container text-on-primary flex items-center justify-center mb-4 group-hover:scale-105 transition-transform"><Images size={28} /></span>
          <span className="text-headline-md text-primary mb-2 text-center font-bold">Choose Multiple Photos</span>
          <span className="text-body-md text-on-surface-variant text-center">iPhone Photo Library, Files, JPG, PNG, WebP, or HEIC · up to 12 MB each</span>
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={busy} className="bg-tertiary-fixed-dim text-primary border border-tertiary/20 px-5 py-3 rounded-full text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 hover:brightness-95"><Camera size={16} /> Take Current Photo · iPhone Camera</button>
          <button type="button" onClick={usePublicDemoReference} disabled={busy} className="text-xs font-semibold text-secondary hover:text-primary flex items-center justify-center gap-1 uppercase tracking-wider disabled:opacity-50"><Plus size={14} /> Add a public demo reference</button>
        </div>
      </section>

      {references.length > 0 && (
        <section className="space-y-4 animate-fade-in">
          <h2 className="text-label-md text-on-surface-variant uppercase tracking-wider font-semibold">New References</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {references.map((reference) => (
              <div key={reference.id} className="bg-surface-container-lowest rounded-xl border border-outline-variant p-2 space-y-2">
                <div className="relative aspect-square rounded-lg overflow-hidden bg-surface-container"><img src={reference.imageUrl} alt="Reference preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" /><button type="button" aria-label="Remove reference" onClick={() => removeReference(reference.id)} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-surface-container-lowest/90 flex items-center justify-center text-error hover:bg-error hover:text-on-error"><Trash2 size={14} /></button></div>
                <select aria-label="Photo source or age" value={reference.era} onChange={(event) => updateEra(reference.id, event.target.value as ReferenceEra)} className="w-full bg-surface-bright border border-outline-variant rounded-lg px-2 py-2 text-xs text-on-surface">
                  <option value="current">Current · latest iPhone</option><option value="recent">Recent digital photo</option><option value="older">Older or scanned photo</option><option value="unspecified">Date/source unknown</option>
                </select>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4">
        <span className="text-xs text-on-surface-variant" aria-live="polite">{status}</span>
        <button onClick={handleSave} disabled={busy || !references.length} className="w-full sm:w-auto bg-primary text-on-primary px-8 py-4 rounded-full hover:opacity-90 disabled:opacity-50 shadow-md flex items-center justify-center gap-2 font-bold">
          {busy ? <><Loader2 size={18} className="animate-spin" /><span>{isPreparing ? 'Preparing Photos…' : 'Saving…'}</span></> : <><Camera size={18} /><span>{existingSubject ? 'Add to Subject' : 'Save Subject'}</span></>}
        </button>
      </div>
    </div>
  );
}
