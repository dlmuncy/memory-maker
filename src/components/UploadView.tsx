import { useRef, useState, type ChangeEvent } from 'react';
import { Camera, Loader2, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { Subject } from '../types';

interface UploadViewProps {
  onUploadSuccess: (newSubject: Subject) => void;
}

const samplePortraits = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAo9dntySZJmZGdIfdUUAnb7X_nPgjMyGwKnBhHhffeIkGGA4y8FAzPeU4cj_HnueyiJzy3Opx0EQPuMU7r2ECl-yIab_OhM52DAH5T-ZoXhq3_utJdQ_aybWOTdGScf4DXqdfq2FZ8N25eq0lGaXYD-zEkSMq5uQ-xYbszh56YTk-bL4JHEPIWvSJHoYcmU3n2DDPrYR1-9-3itOr_dyeuEzNhZQaTLJu26ZkzagFY2tlC60EQaPT--PMkhtGuldbZ8HQn73Br2GI',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAXBnudZQbZF1GDzi6EVmy1Ehyfoh_UxOc4N06dpo_ShtlaQc9fDZOiDugrifJr7btCICpwpfV6zOdLEV5B4qG8to51u8kEIsrIO2K2FH5En5geRwBk-edBapCEf2E_TDjZGG7XtgZYhdNmomYQdMEpLWFctJVcfniQD1OTBEkEUJKHf_FznH59I5pN9tvQ57FMc_5C8_xye0N_RZ-XDdj09MUb2hBS_SAXuPVrRMcJZlAfpDtxNTtjYuw9-OzYB_9JnpEy_abTHpU',
];

export default function UploadView({ onUploadSuccess }: UploadViewProps) {
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState<Subject['relationship']>('Family');
  const [selectedPhoto, setSelectedPhoto] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [sampleIndex, setSampleIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Choose a JPG, PNG, or WebP portrait image.');
      return;
    }
    if (file.size > 3_000_000) {
      setErrorMsg('Choose an image smaller than 3 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedPhoto(String(reader.result || ''));
      setErrorMsg('');
    };
    reader.readAsDataURL(file);
  };

  const useSamplePhoto = () => {
    setSelectedPhoto(samplePortraits[sampleIndex]);
    setSampleIndex((current) => (current + 1) % samplePortraits.length);
    setErrorMsg('');
  };

  const handleStartUpload = async () => {
    if (!name.trim()) {
      setErrorMsg("Enter the subject's name.");
      return;
    }
    if (!selectedPhoto) {
      setErrorMsg('Add one reference portrait.');
      return;
    }

    setIsUploading(true);
    setErrorMsg('');
    setUploadStatus('Encrypting portrait for private storage…');
    try {
      const result = await apiFetch<{ success: true; subject: Subject }>('/api/subjects', {
        method: 'POST',
        body: JSON.stringify({ name, relationship, avatarUrl: selectedPhoto }),
      });
      setUploadStatus('Portrait secured.');
      setIsUploading(false);
      onUploadSuccess(result.subject);
    } catch (error) {
      setIsUploading(false);
      setErrorMsg(error instanceof Error ? error.message : 'The portrait could not be saved.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-16">
      <div className="text-center md:text-left max-w-xl space-y-4">
        <h1 className="text-headline-lg-mobile md:text-headline-lg text-primary font-bold">Upload Subject</h1>
        <p className="text-body-md text-on-surface-variant leading-relaxed">
          Add a portrait anchor for a person, pet, or other subject you want available while composing memories.
        </p>
      </div>

      {errorMsg && <div className="bg-error-container text-on-error-container p-4 rounded-xl text-sm font-semibold border border-error/10">{errorMsg}</div>}

      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-label-md text-primary font-semibold" htmlFor="subjectName">Subject Name</label>
            <input
              type="text"
              id="subjectName"
              placeholder="e.g., Grandma Rose"
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              disabled={isUploading}
              className="bg-surface-bright border border-outline-variant rounded-lg px-4 py-3 text-body-md focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary text-on-surface"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-label-md text-primary font-semibold" htmlFor="relationship">Relationship</label>
            <select
              id="relationship"
              value={relationship}
              onChange={(event) => setRelationship(event.target.value as Subject['relationship'])}
              disabled={isUploading}
              className="bg-surface-bright border border-outline-variant rounded-lg px-4 py-3 text-body-md focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary text-on-surface"
            >
              <option value="Family">Family</option>
              <option value="Friend">Friend</option>
              <option value="Pet">Pet</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <div className="border-t border-outline-variant pt-6">
          <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant flex items-start gap-3">
            <ShieldCheck size={20} className="text-secondary mt-0.5" />
            <div>
              <p className="font-semibold text-primary text-sm">Encrypted storage is automatic</p>
              <p className="text-xs text-on-surface-variant mt-1">Portrait records are encrypted with AES-256-GCM before being written to your isolated Blob vault.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <input ref={fileInputRef} type="file" onChange={handleFileChange} accept="image/jpeg,image/png,image/webp" className="hidden" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-primary-fixed-dim bg-surface-container-low hover:bg-surface-container-high rounded-xl p-12 flex flex-col items-center justify-center group"
        >
          <span className="w-16 h-16 rounded-full bg-primary-container text-on-primary flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
            <Camera size={28} />
          </span>
          <span className="text-headline-md text-primary mb-2 text-center font-bold">Select a Portrait</span>
          <span className="text-body-md text-on-surface-variant text-center">JPG, PNG, or WebP up to 3 MB</span>
        </button>
        <div className="flex justify-end">
          <button type="button" onClick={useSamplePhoto} className="text-xs font-semibold text-secondary hover:text-primary flex items-center gap-1 uppercase tracking-wider">
            <Plus size={14} /> Use a demo portrait
          </button>
        </div>
      </section>

      {selectedPhoto && (
        <section className="space-y-4 animate-fade-in">
          <h2 className="text-label-md text-on-surface-variant uppercase tracking-wider font-semibold">Selected Reference Portrait</h2>
          <div className="relative group aspect-square max-w-48 rounded-lg overflow-hidden border border-outline-variant bg-surface-container shadow-sm">
            <img src={selectedPhoto} alt="Selected portrait preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            <button type="button" aria-label="Remove portrait" onClick={() => setSelectedPhoto('')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-surface-container-lowest/90 flex items-center justify-center text-error hover:bg-error hover:text-on-error">
              <Trash2 size={14} />
            </button>
          </div>
        </section>
      )}

      <div className="flex justify-center md:justify-end pt-4">
        <button onClick={handleStartUpload} disabled={isUploading} className="w-full md:w-auto bg-primary text-on-primary px-8 py-4 rounded-full hover:opacity-90 disabled:opacity-50 shadow-md flex items-center justify-center gap-2 font-bold">
          {isUploading ? <><Loader2 size={18} className="animate-spin" /><span>{uploadStatus}</span></> : <><ShieldCheck size={18} /><span>Save Subject Securely</span></>}
        </button>
      </div>
    </div>
  );
}
