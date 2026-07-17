import { useState } from 'react';
import { AlertCircle, Camera, Compass, ExternalLink, Images, KeyRound, Loader2, Plus, Sparkles, Users } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { GenerationProgress } from '../lib/generation';
import type { Memory, Subject } from '../types';

interface CreateViewProps {
  subjects: Subject[];
  initialSubjectId?: string | null;
  onAddSubjectClick: () => void;
  onSynthesisSuccess: (newMemory: Memory) => void;
}

const settingTemplates = [
  { title: 'Backyard Barbecue', description: 'Late afternoon golden sun, woodsmoke, and a relaxed family table' },
  { title: 'Grand Canyon Expedition', description: 'Standing by the canyon edge at sunset in warm red silhouettes' },
  { title: 'Snowy Lodge Retreat', description: 'A rustic log cabin at twilight with soft amber window glow' },
  { title: 'Caribbean Cruise Voyage', description: 'On the sun deck overlooking bright turquoise water' },
];

const mediumStyles = [
  'Vintage medium format film',
  'Kodak 35mm analog film',
  'High-contrast monochrome portraiture',
  'Distinguished fine-art studio portrait',
  'Cinematic warm editorial lighting',
];

const aspectRatios = [
  { value: 'landscape' as const, label: 'Landscape', detail: '4:3' },
  { value: 'square' as const, label: 'Square', detail: '1:1' },
  { value: 'portrait' as const, label: 'Portrait', detail: '3:4' },
];

export default function CreateView({ subjects, initialSubjectId, onAddSubjectClick, onSynthesisSuccess }: CreateViewProps) {
  const initialIsUsable = initialSubjectId && subjects.some((subject) => subject.id === initialSubjectId && subject.referenceImages.length > 0);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(initialIsUsable ? [initialSubjectId] : []);
  const [setting, setSetting] = useState('');
  const [medium, setMedium] = useState(mediumStyles[0]);
  const [notes, setNotes] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'landscape' | 'square' | 'portrait'>('landscape');
  const [consent, setConsent] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [generationLogs, setGenerationLogs] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  const toggleSubject = (subject: Subject) => {
    if (!subject.referenceImages.length) {
      setErrorMsg(`${subject.name} needs at least one real reference photo.`);
      return;
    }
    setSelectedSubjects((current) => {
      if (current.includes(subject.id)) return current.filter((subjectId) => subjectId !== subject.id);
      if (current.length >= 4) {
        setErrorMsg('The free multi-reference engine supports up to four subjects per generation.');
        return current;
      }
      setErrorMsg('');
      return [...current, subject.id];
    });
  };

  const recordProgress = (progress: GenerationProgress) => {
    const detail = progress.eta && progress.stage === 'queued'
      ? `${progress.message} About ${Math.max(1, Math.round(progress.eta))}s estimated.`
      : progress.message;
    setGenerationLogs((current) => current.at(-1) === detail ? current : [...current.slice(-7), detail]);
  };

  const handleSynthesize = async () => {
    if (!selectedSubjects.length) {
      setErrorMsg('Select at least one subject with reference photos.');
      setStep(1);
      return;
    }
    if (setting.trim().length < 3) {
      setErrorMsg('Describe the new environment and activity.');
      setStep(2);
      return;
    }
    if (!consent) {
      setErrorMsg('Confirm photo permission and Hugging Face processing before generation.');
      return;
    }

    setIsSynthesizing(true);
    setErrorMsg('');
    setGenerationLogs(['Loading selected identity references from the encrypted browser vault…']);
    try {
      const memory = await apiFetch<Memory>('/api/memories', {
        method: 'POST',
        body: JSON.stringify({
          subjects: selectedSubjects,
          setting,
          medium,
          notes,
          aspectRatio,
          externalProcessingConsent: true,
        }),
      }, { onProgress: recordProgress });
      onSynthesisSuccess(memory);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'The memory could not be generated.');
      setIsSynthesizing(false);
    }
  };

  if (isSynthesizing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] text-center space-y-8 animate-fade-in">
        <div className="relative"><div className="absolute inset-0 rounded-full bg-secondary/15 animate-ping w-24 h-24" /><div className="relative bg-surface-container-lowest border border-outline-variant p-6 rounded-full w-24 h-24 flex items-center justify-center shadow-lg"><Loader2 className="text-secondary animate-spin" size={42} /></div></div>
        <div className="space-y-3 max-w-xl"><h2 className="text-headline-md text-primary font-bold">Generating a Real Image…</h2><p className="text-body-md text-on-surface-variant">FLUX.2 Klein is composing a new scene from the selected photos. Free GPU queues can take a minute or two; keep this tab open.</p></div>
        <div className="w-full max-w-2xl bg-primary text-on-primary border-t-4 border-secondary text-left rounded-b-xl p-6 font-mono text-xs space-y-2 shadow-md" aria-live="polite">
          <div className="flex justify-between text-secondary-fixed border-b border-white/10 pb-2 mb-2 font-semibold"><span>Generation Log</span><span>HF_FLUX2_KLEIN</span></div>
          {generationLogs.map((log, index) => <div key={`${index}-${log}`} className="flex gap-2"><span className="text-secondary-fixed">&gt;</span><span>{log}</span></div>)}
          <div className="animate-pulse h-3 w-1.5 bg-secondary-fixed mt-1" />
        </div>
      </div>
    );
  }

  const canOpenSetting = selectedSubjects.length > 0;
  const canOpenMedium = canOpenSetting && setting.trim().length >= 3;

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-fade-in pb-16">
      <header className="text-center md:text-left max-w-3xl space-y-4">
        <p className="text-label-sm text-tertiary-fixed-dim uppercase font-semibold">New AI Image</p>
        <h1 className="text-headline-xl text-primary font-bold">Make it Memorable.</h1>
        <p className="text-body-lg text-on-surface-variant leading-relaxed">Choose people or pets, then describe the new environment and what they are doing. The model uses their saved photos as identity references to generate a new image.</p>
      </header>

      <div className="flex items-center gap-4 border-b border-outline-variant pb-4 overflow-x-auto hide-scrollbar" aria-label="Creation steps">
        {[{ value: 1 as const, label: 'The Subjects', enabled: true }, { value: 2 as const, label: 'The Scene', enabled: canOpenSetting }, { value: 3 as const, label: 'The Look', enabled: canOpenMedium }].map((item) => (
          <button key={item.value} onClick={() => item.enabled && setStep(item.value)} disabled={!item.enabled} className={`flex items-center gap-3 px-5 py-2 shrink-0 transition-all ${step === item.value ? 'opacity-100' : 'opacity-50'} disabled:cursor-not-allowed`}><span className="text-4xl text-secondary font-bold">0{item.value}</span><span className="text-label-sm text-primary uppercase tracking-widest text-left font-semibold">{item.label}</span></button>
        ))}
      </div>

      {errorMsg && <div role="alert" className="bg-error-container text-on-error-container p-4 rounded-xl flex items-center gap-3"><AlertCircle size={20} className="shrink-0" /><span className="text-sm font-semibold">{errorMsg}</span></div>}

      {step === 1 && (
        <section className="space-y-6">
          <div className="flex justify-between items-end gap-3"><div><h2 className="text-headline-md text-primary font-bold flex items-center gap-2"><Users size={24} className="text-secondary" /> Select Subjects</h2><p className="text-sm text-on-surface-variant mt-1">Up to four subjects; the engine uses up to six photos across them.</p></div><button onClick={onAddSubjectClick} className="text-label-md text-primary border border-outline-variant px-4 py-2 hover:bg-surface-container-low uppercase flex items-center gap-2 rounded-full font-semibold"><Plus size={16} /> New Subject</button></div>
          {subjects.length ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 bg-surface-container-low p-4 rounded-2xl">
              {subjects.map((subject) => {
                const selected = selectedSubjects.includes(subject.id);
                const usable = subject.referenceImages.length > 0;
                return (
                  <button type="button" key={subject.id} onClick={() => toggleSubject(subject)} aria-pressed={selected} className={`relative bg-surface-container-lowest p-4 flex flex-col items-center gap-3 rounded-xl shadow-sm border ${selected ? 'border-secondary ring-4 ring-secondary/10' : 'border-outline-variant'} ${usable ? 'hover:shadow-md' : 'opacity-60'}`}>
                    <span className={`absolute top-3 right-3 rounded-full w-5 h-5 border ${selected ? 'bg-secondary border-secondary' : 'border-outline-variant'}`} />
                    <img src={subject.avatarUrl} alt={subject.name} className={`w-24 h-24 rounded-full object-cover border ${selected ? 'border-2 border-secondary' : 'border-outline-variant'}`} referrerPolicy="no-referrer" />
                    <span className="text-label-md text-primary font-bold text-center">{subject.name}</span>
                    <span className="text-[10px] text-outline uppercase flex items-center gap-1"><Images size={12} /> {subject.imageCount} {subject.imageCount === 1 ? 'photo' : 'photos'}</span>
                    {!usable && <span className="text-[10px] text-error font-semibold">ADD PHOTOS FIRST</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="bg-surface-container-low border border-dashed border-outline-variant rounded-2xl p-10 text-center"><Images className="mx-auto text-secondary mb-3" size={36} /><h3 className="text-primary font-bold">No subjects yet</h3><p className="text-on-surface-variant text-sm mt-1 mb-5">Add a person or pet with one or more reference photos.</p><button onClick={onAddSubjectClick} className="bg-primary text-on-primary px-6 py-3 rounded-full font-bold uppercase text-xs">Add your first subject</button></div>
          )}
          <div className="flex justify-end"><button onClick={() => setStep(2)} disabled={!canOpenSetting} className="bg-primary text-on-primary text-label-md uppercase px-8 py-4 rounded-full font-bold disabled:opacity-50">Next: Scene</button></div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-6">
          <h2 className="text-headline-md text-primary font-bold flex items-center gap-2"><Compass size={24} className="text-secondary" /> Describe the New Environment & Activity</h2>
          <div className="flex flex-col gap-2"><label className="text-label-md text-primary font-semibold" htmlFor="memory-setting">What should happen in the new image?</label><textarea id="memory-setting" value={setting} maxLength={600} onChange={(event) => setSetting(event.target.value)} rows={5} placeholder="e.g., Grandma Rose and Ben are laughing together while decorating a Christmas tree in a warm cabin, snow visible through the window…" className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 text-body-md focus:border-secondary focus:ring-1 focus:ring-secondary text-on-surface" /><span className="text-xs text-outline text-right">{setting.length}/600</span></div>
          <div className="space-y-3"><span className="text-label-sm text-outline uppercase tracking-wider font-semibold">Or choose a starting point</span><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{settingTemplates.map((template) => <button type="button" key={template.title} onClick={() => setSetting(`${template.title}: ${template.description}`)} className="bg-surface-container-lowest border border-outline-variant hover:border-secondary hover:bg-surface-container-low p-4 rounded-xl text-left"><strong className="text-primary block">{template.title}</strong><span className="text-on-surface-variant text-sm">{template.description}</span></button>)}</div></div>
          <div className="flex justify-between"><button onClick={() => setStep(1)} className="border border-outline-variant text-primary uppercase px-8 py-4 rounded-full font-bold">Back</button><button onClick={() => setStep(3)} disabled={!canOpenMedium} className="bg-primary text-on-primary uppercase px-8 py-4 rounded-full font-bold disabled:opacity-50">Next: Look</button></div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-8">
          <h2 className="text-headline-md text-primary font-bold flex items-center gap-2"><Camera size={24} className="text-secondary" /> Choose the Look</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{mediumStyles.map((style) => <button type="button" key={style} onClick={() => setMedium(style)} aria-pressed={medium === style} className={`p-4 rounded-xl border text-sm font-semibold text-left ${medium === style ? 'border-secondary bg-secondary-container/30 text-secondary' : 'border-outline-variant bg-surface-container-lowest'}`}>{style}</button>)}</div>
          <div className="space-y-3"><span className="text-label-md text-primary font-semibold">Image Shape</span><div className="grid grid-cols-3 gap-3">{aspectRatios.map((ratio) => <button type="button" key={ratio.value} onClick={() => setAspectRatio(ratio.value)} aria-pressed={aspectRatio === ratio.value} className={`p-3 rounded-xl border text-center ${aspectRatio === ratio.value ? 'border-secondary bg-secondary-container/30 text-secondary' : 'border-outline-variant bg-surface-container-lowest'}`}><strong className="block text-sm">{ratio.label}</strong><span className="text-[10px] text-outline">{ratio.detail}</span></button>)}</div></div>
          <div className="flex flex-col gap-2"><label className="text-label-md text-primary font-semibold" htmlFor="memory-notes">Extra Details (Optional)</label><textarea id="memory-notes" value={notes} maxLength={1500} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Clothing, specific objects, mood, weather, or other personal cues…" className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 text-body-md focus:border-secondary focus:ring-1 focus:ring-secondary text-on-surface" /></div>

          <label className="bg-surface-container-low border border-outline-variant rounded-xl p-4 flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 w-4 h-4 accent-secondary" />
            <span className="text-xs"><strong className="text-primary block">Photo permission and external AI processing</strong><span className="text-on-surface-variant leading-relaxed block mt-1">I have permission to use these photos and understand that the selected references will be sent over HTTPS to the official Hugging Face FLUX.2 Klein Space for generation. Finished images return to encrypted browser storage.</span><a href="https://huggingface.co/spaces/black-forest-labs/FLUX.2-klein-4B" target="_blank" rel="noreferrer" className="text-secondary font-semibold inline-flex items-center gap-1 mt-2">View the model Space <ExternalLink size={11} /></a></span>
          </label>

          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 flex items-center gap-3"><KeyRound size={20} className="text-secondary shrink-0" /><div className="text-xs"><strong className="text-primary block">Real generation · free community compute</strong><span className="text-on-surface-variant">Apache-2.0 model. Free GPU capacity can queue or temporarily hit its daily allowance; generation only saves after a real image is returned.</span></div></div>
          <div className="flex justify-between"><button onClick={() => setStep(2)} className="border border-outline-variant text-primary uppercase px-8 py-4 rounded-full font-bold">Back</button><button onClick={handleSynthesize} disabled={!consent} className="bg-primary text-on-primary uppercase px-8 py-4 rounded-full font-bold flex items-center gap-2 disabled:opacity-50"><Sparkles size={16} /> Generate Image</button></div>
        </section>
      )}
    </div>
  );
}
