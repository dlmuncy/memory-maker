import { useState } from 'react';
import { Filter, Images, Plus, Shield, Sparkles } from 'lucide-react';
import type { Subject } from '../types';

interface LibraryViewProps {
  subjects: Subject[];
  onAddSubjectClick: () => void;
  onManageSubject: (subject: Subject) => void;
  onSubjectClick: (subject: Subject) => void;
  vaultUnlocked: boolean;
}

export default function LibraryView({ subjects, onAddSubjectClick, onManageSubject, onSubjectClick, vaultUnlocked }: LibraryViewProps) {
  const [filter, setFilter] = useState<'all' | 'recent' | 'frequent'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const sortedSubjects = subjects
    .filter((subject) => `${subject.name} ${subject.relationship}`.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => filter === 'frequent'
      ? b.recalls - a.recalls
      : filter === 'recent'
        ? b.addedDate.localeCompare(a.addedDate)
        : a.name.localeCompare(b.name));

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <header className="text-center md:text-left max-w-2xl space-y-4">
        <p className="text-label-sm tracking-widest text-outline uppercase font-semibold">The Archives</p>
        <h1 className="text-headline-xl font-bold tracking-tight text-primary">Your Living Library</h1>
        <p className="text-body-lg text-on-surface-variant leading-relaxed">A private collection of people and pets with reusable current iPhone, recent, and older identity-reference photos.</p>
      </header>

      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center border-b border-outline-variant pb-4 gap-4">
        <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar" role="group" aria-label="Library sort">
          {(['all', 'recent', 'frequent'] as const).map((value) => (
            <button key={value} onClick={() => setFilter(value)} aria-pressed={filter === value} className={`px-4 py-2 text-label-md tracking-wider border-b-2 whitespace-nowrap uppercase ${filter === value ? 'border-primary text-primary font-bold bg-surface-container-low' : 'border-transparent text-outline hover:text-primary'}`}>
              {value === 'all' ? 'All Subjects' : value}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <input type="search" aria-label="Search subject library" placeholder="Search library…" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="bg-surface-container-lowest border border-outline-variant rounded-full px-4 py-2 text-body-md text-on-surface focus:ring-1 focus:ring-primary w-full sm:w-64" />
          <Filter size={18} className="text-outline flex-shrink-0" />
        </div>
      </div>

      {!vaultUnlocked && (
        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant flex items-center justify-between gap-4">
          <div className="flex items-center gap-3"><Shield className="text-secondary flex-shrink-0" size={20} /><div className="text-sm"><strong className="text-primary">Portrait previews locked</strong><p className="text-on-surface-variant mt-0.5">Unlock them in Privacy & Vault. Persistent records remain encrypted with AES-256-GCM.</p></div></div>
          <span className="hidden sm:inline text-xs font-mono text-outline bg-surface-container-lowest px-2 py-1 rounded">AES_GCM_ACTIVE</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedSubjects.map((subject) => (
          <article key={subject.id} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 flex flex-col justify-between group hover:bg-surface-container-low hover:shadow-md transition-all min-h-[440px] text-left">
            <span className="space-y-4 block">
              <span className="aspect-square relative overflow-hidden bg-surface-dim rounded-xl border border-outline-variant block">
                <img src={subject.avatarUrl} alt={subject.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" referrerPolicy="no-referrer" />
                <span className="absolute top-4 left-4 bg-surface-container-lowest/90 backdrop-blur-sm border border-outline-variant shadow-sm px-3 py-1 rounded-full flex items-center gap-1.5 z-10"><Shield size={12} className="text-secondary" /><span className="text-[10px] text-primary tracking-widest uppercase">AES-GCM Vault</span></span>
                {!vaultUnlocked && <span className="absolute inset-0 bg-primary/45 backdrop-blur-md flex flex-col items-center justify-center text-center p-4"><Shield size={32} className="text-secondary-fixed" /><span className="text-white text-xs font-semibold mt-2">PREVIEW LOCKED</span></span>}
              </span>
              <span className="block"><strong className="text-headline-md text-primary group-hover:text-secondary transition-colors block">{subject.name}</strong><span className="text-body-md text-on-surface-variant mt-1 block">Relationship: {subject.relationship}</span><span className="text-xs text-outline mt-2 flex items-center gap-1"><Images size={13} /> {subject.imageCount} saved {subject.imageCount === 1 ? 'reference' : 'references'}</span></span>
            </span>
            <span className="mt-6 border-t border-outline-variant pt-4 space-y-3 block">
              <span className="flex justify-between items-center"><span className="text-label-sm text-outline uppercase tracking-widest">Memory Recalls</span><strong className="text-label-md text-secondary text-lg bg-secondary-container/30 px-3 py-0.5 rounded-full">{subject.recalls}</strong></span>
              <span className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => onManageSubject(subject)} className="border border-outline-variant text-primary rounded-full px-3 py-2 text-xs font-bold uppercase hover:bg-surface-container"><Plus size={13} className="inline mr-1" /> Photos</button>
                <button type="button" onClick={() => onSubjectClick(subject)} disabled={!subject.referenceImages.length} className="bg-primary text-on-primary rounded-full px-3 py-2 text-xs font-bold uppercase disabled:opacity-40"><Sparkles size={13} className="inline mr-1" /> Create</button>
              </span>
            </span>
          </article>
        ))}

        <button type="button" onClick={onAddSubjectClick} className="border-2 border-dashed border-outline-variant bg-surface-container-low rounded-2xl p-6 flex flex-col items-center justify-center group hover:border-primary hover:bg-surface-container-high h-[420px]">
          <span className="w-16 h-16 rounded-full border border-outline flex items-center justify-center mb-4 group-hover:border-primary group-hover:scale-105 transition-all"><Plus className="text-outline group-hover:text-primary" size={32} /></span>
          <strong className="text-headline-md text-primary">Add Subject</strong>
          <span className="text-label-sm text-on-surface-variant mt-4 text-center max-w-[200px] leading-relaxed uppercase tracking-widest">Upload one or more identity references</span>
        </button>
      </div>
    </div>
  );
}
