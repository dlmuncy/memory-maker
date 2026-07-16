import { useState } from 'react';
import { AlertCircle, Camera, Compass, KeyRound, Loader2, Plus, Sparkles, Users } from 'lucide-react';
import { apiFetch } from '../lib/api';
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

export default function CreateView({ subjects, initialSubjectId, onAddSubjectClick, onSynthesisSuccess }: CreateViewProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(initialSubjectId ? [initialSubjectId] : []);
  const [setting, setSetting] = useState('');
  const [medium, setMedium] = useState(mediumStyles[0]);
  const [notes, setNotes] = useState('');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const toggleSubject = (id: string) => {
    setSelectedSubjects((current) => current.includes(id)
      ? current.filter((subjectId) => subjectId !== id)
      : [...current, id]);
  };

  const handleSynthesize = async () => {
    if (!selectedSubjects.length) {
      setErrorMsg('Select at least one subject anchor.');
      setStep(1);
      return;
    }
    if (setting.trim().length < 3) {
      setErrorMsg('Describe the setting for this memory.');
      setStep(2);
      return;
    }

    setIsSynthesizing(true);
    setErrorMsg('');
    try {
      const memory = await apiFetch<Memory>('/api/memories', {
        method: 'POST',
        body: JSON.stringify({ subjects: selectedSubjects, setting, medium, notes }),
      });
      setIsSynthesizing(false);
      onSynthesisSuccess(memory);
    } catch (error) {
      setIsSynthesizing(false);
      setErrorMsg(error instanceof Error ? error.message : 'The memory could not be generated.');
    }
  };

  if (isSynthesizing) {
    const logs = [
      'Loading the selected portrait anchors…',
      'Composing the narrative and visual direction…',
      'Requesting Hugging Face generation when connected…',
      'Encrypting the finished record for private Blob storage…',
    ];
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] text-center space-y-8 animate-fade-in">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-secondary/15 animate-ping w-24 h-24" />
          <div className="relative bg-surface-container-lowest border border-outline-variant p-6 rounded-full w-24 h-24 flex items-center justify-center shadow-lg">
            <Loader2 className="text-secondary animate-spin" size={42} />
          </div>
        </div>
        <div className="space-y-3 max-w-md">
          <h2 className="text-headline-md text-primary font-bold">Generating Memory…</h2>
          <p className="text-body-md text-on-surface-variant">The engine is composing your narrative and visual treatment from the selected anchors.</p>
        </div>
        <div className="w-full max-w-lg bg-primary text-on-primary border-t-4 border-secondary text-left rounded-b-xl p-6 font-mono text-xs space-y-2 shadow-md" aria-live="polite">
          <div className="flex justify-between text-secondary-fixed border-b border-white/10 pb-2 mb-2 font-semibold"><span>Generation Log</span><span>PRIVATE_MODE</span></div>
          {logs.map((log) => <div key={log} className="flex gap-2"><span className="text-secondary-fixed">&gt;</span><span>{log}</span></div>)}
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
        <p className="text-label-sm text-tertiary-fixed-dim uppercase font-semibold">New Synthesis</p>
        <h1 className="text-headline-xl text-primary font-bold">Make it Memorable.</h1>
        <p className="text-body-lg text-on-surface-variant leading-relaxed">Define the subjects, setting, and photographic medium. The engine will construct a new memory concept.</p>
      </header>

      <div className="flex items-center gap-4 border-b border-outline-variant pb-4 overflow-x-auto hide-scrollbar" aria-label="Creation steps">
        {[
          { value: 1 as const, label: 'The Subjects', enabled: true },
          { value: 2 as const, label: 'The Setting', enabled: canOpenSetting },
          { value: 3 as const, label: 'The Medium', enabled: canOpenMedium },
        ].map((item) => (
          <button key={item.value} onClick={() => item.enabled && setStep(item.value)} disabled={!item.enabled} className={`flex items-center gap-3 px-5 py-2 shrink-0 transition-all ${step === item.value ? 'opacity-100' : 'opacity-50'} disabled:cursor-not-allowed`}>
            <span className="text-4xl text-secondary font-bold">0{item.value}</span>
            <span className="text-label-sm text-primary uppercase tracking-widest text-left font-semibold">{item.label}</span>
          </button>
        ))}
      </div>

      {errorMsg && <div role="alert" className="bg-error-container text-on-error-container p-4 rounded-xl flex items-center gap-3"><AlertCircle size={20} /><span className="text-sm font-semibold">{errorMsg}</span></div>}

      {step === 1 && (
        <section className="space-y-6">
          <div className="flex justify-between items-end gap-3">
            <h2 className="text-headline-md text-primary font-bold flex items-center gap-2"><Users size={24} className="text-secondary" /> Select Subjects</h2>
            <button onClick={onAddSubjectClick} className="text-label-md text-primary border border-outline-variant px-4 py-2 hover:bg-surface-container-low uppercase flex items-center gap-2 rounded-full font-semibold"><Plus size={16} /> New Subject</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 bg-surface-container-low p-4 rounded-2xl">
            {subjects.map((subject) => {
              const selected = selectedSubjects.includes(subject.id);
              return (
                <button type="button" key={subject.id} onClick={() => toggleSubject(subject.id)} aria-pressed={selected} className={`relative bg-surface-container-lowest p-5 flex flex-col items-center gap-4 rounded-xl shadow-sm hover:shadow-md border ${selected ? 'border-secondary ring-4 ring-secondary/10' : 'border-outline-variant'}`}>
                  <span className={`absolute top-3 right-3 rounded-full w-5 h-5 border ${selected ? 'bg-secondary border-secondary' : 'border-outline-variant'}`} />
                  <img src={subject.avatarUrl} alt={subject.name} className={`w-24 h-24 rounded-full object-cover border ${selected ? 'border-2 border-secondary' : 'border-outline-variant grayscale hover:grayscale-0'}`} referrerPolicy="no-referrer" />
                  <span className="text-label-md text-primary font-bold text-center">{subject.name}</span>
                </button>
              );
            })}
          </div>
          <div className="flex justify-end"><button onClick={() => setStep(2)} disabled={!canOpenSetting} className="bg-primary text-on-primary text-label-md uppercase px-8 py-4 rounded-full font-bold disabled:opacity-50">Next: Setting</button></div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-6">
          <h2 className="text-headline-md text-primary font-bold flex items-center gap-2"><Compass size={24} className="text-secondary" /> Define the Setting</h2>
          <div className="flex flex-col gap-2">
            <label className="text-label-md text-primary font-semibold" htmlFor="memory-setting">Custom Setting Description</label>
            <textarea id="memory-setting" value={setting} maxLength={600} onChange={(event) => setSetting(event.target.value)} rows={4} placeholder="Describe the place, lighting, action, season, and emotional tone…" className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 text-body-md focus:border-secondary focus:ring-1 focus:ring-secondary text-on-surface" />
          </div>
          <div className="space-y-3">
            <span className="text-label-sm text-outline uppercase tracking-wider font-semibold">Or choose a starting point</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {settingTemplates.map((template) => (
                <button type="button" key={template.title} onClick={() => setSetting(`${template.title}: ${template.description}`)} className="bg-surface-container-lowest border border-outline-variant hover:border-secondary hover:bg-surface-container-low p-4 rounded-xl text-left">
                  <strong className="text-primary block">{template.title}</strong><span className="text-on-surface-variant text-sm">{template.description}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-between"><button onClick={() => setStep(1)} className="border border-outline-variant text-primary uppercase px-8 py-4 rounded-full font-bold">Back</button><button onClick={() => setStep(3)} disabled={!canOpenMedium} className="bg-primary text-on-primary uppercase px-8 py-4 rounded-full font-bold disabled:opacity-50">Next: Medium</button></div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-8">
          <h2 className="text-headline-md text-primary font-bold flex items-center gap-2"><Camera size={24} className="text-secondary" /> Photographic Medium</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mediumStyles.map((style) => <button type="button" key={style} onClick={() => setMedium(style)} aria-pressed={medium === style} className={`p-4 rounded-xl border text-sm font-semibold text-left ${medium === style ? 'border-secondary bg-secondary-container/30 text-secondary' : 'border-outline-variant bg-surface-container-lowest'}`}>{style}</button>)}
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-label-md text-primary font-semibold" htmlFor="memory-notes">Additional Scraps of Memory (Optional)</label>
            <textarea id="memory-notes" value={notes} maxLength={1500} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Include sensory details, clothing, phrases, or other personal cues…" className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 text-body-md focus:border-secondary focus:ring-1 focus:ring-secondary text-on-surface" />
          </div>
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 flex items-center gap-3"><KeyRound size={20} className="text-secondary" /><div className="text-xs"><strong className="text-primary block">Private Synthesis Enabled</strong><span className="text-on-surface-variant">The finished record is isolated to this browser vault and encrypted before persistent storage.</span></div></div>
          <div className="flex justify-between"><button onClick={() => setStep(2)} className="border border-outline-variant text-primary uppercase px-8 py-4 rounded-full font-bold">Back</button><button onClick={handleSynthesize} className="bg-primary text-on-primary uppercase px-8 py-4 rounded-full font-bold flex items-center gap-2"><Sparkles size={16} /> Generate Memory</button></div>
        </section>
      )}
    </div>
  );
}
