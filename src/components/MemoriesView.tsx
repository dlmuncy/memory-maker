import { useState } from 'react';
import { MapPin, Sparkles } from 'lucide-react';
import type { Memory, Subject } from '../types';

interface MemoriesViewProps {
  memories: Memory[];
  onMemoryClick: (memory: Memory) => void;
  subjects: Subject[];
}

export default function MemoriesView({ memories, onMemoryClick, subjects }: MemoriesViewProps) {
  const [visibleCount, setVisibleCount] = useState(4);
  const grouped = memories.slice(0, visibleCount).reduce<Record<string, Memory[]>>((result, memory) => {
    const timeline = memory.date || 'Undated';
    (result[timeline] ||= []).push(memory);
    return result;
  }, {});

  return (
    <div className="space-y-12 animate-fade-in pb-12">
      <section className="max-w-3xl mx-auto text-center flex flex-col items-center space-y-4">
        <span className="text-label-md text-secondary uppercase tracking-widest font-bold">Our Collections</span>
        <h1 className="text-headline-lg-mobile md:text-headline-xl text-primary font-bold">Family Adventures</h1>
        <p className="text-body-lg text-on-surface-variant max-w-2xl leading-relaxed">
          A curated sequence of reconstructed moments. Open any card to inspect, privately share, or refine it.
        </p>
      </section>

      <div className="space-y-16">
        {Object.entries(grouped).map(([timeline, groupMemories]) => (
          <section key={timeline} className="space-y-6">
            <div className="flex items-center gap-4 w-full">
              <h2 className="text-headline-md text-primary font-bold">{timeline}</h2>
              <div className="flex-1 h-px bg-outline-variant mt-2" />
              <span className="text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                {groupMemories.length} {groupMemories.length === 1 ? 'Memory' : 'Memories'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {groupMemories.map((memory) => {
                const includedSubjects = subjects.filter((subject) => memory.subjectsIncluded.includes(subject.id));
                return (
                  <button
                    type="button"
                    key={memory.id}
                    onClick={() => onMemoryClick(memory)}
                    className="bg-surface-container relative group overflow-hidden border border-outline-variant cursor-pointer h-[400px] rounded-xl hover:shadow-lg hover:border-primary/20 transition-all duration-300 text-left"
                  >
                    <img src={memory.imageUrl} alt={memory.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" referrerPolicy="no-referrer" />
                    <span className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/45 to-transparent opacity-85 group-hover:opacity-95 transition-opacity" />
                    <span className="absolute inset-0 p-6 z-10 flex flex-col justify-between">
                      <span className="flex justify-between items-center">
                        <span className="bg-surface-container-lowest/20 backdrop-blur-md px-3 py-1 rounded-full text-white/90 text-xs flex items-center gap-1.5 border border-white/10 font-mono">
                          <Sparkles size={12} className="text-secondary-fixed" /> {memory.generationMode === 'hugging-face' ? 'HF GENERATED' : 'PRIVATE MEMORY'}
                        </span>
                        <span className="flex -space-x-2">
                          {includedSubjects.map((subject) => (
                            <img key={subject.id} src={subject.avatarUrl} alt={subject.name} className="w-8 h-8 rounded-full object-cover border border-white/30" title={subject.name} referrerPolicy="no-referrer" />
                          ))}
                        </span>
                      </span>
                      <span className="space-y-3">
                        <span className="text-xs text-secondary-fixed uppercase tracking-widest font-semibold block">{memory.medium}</span>
                        <span className="text-2xl font-bold text-on-primary leading-tight group-hover:text-secondary-fixed transition-colors block">{memory.title}</span>
                        <span className="flex items-center gap-1.5 text-on-primary/80 text-label-md"><MapPin size={14} className="text-secondary-fixed" /><span className="line-clamp-1">{memory.setting}</span></span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {memories.length > visibleCount && (
        <div className="w-full flex justify-center mt-8">
          <button onClick={() => setVisibleCount((current) => current + 4)} className="border border-secondary text-secondary text-label-md uppercase tracking-wider px-8 py-3.5 hover:bg-secondary hover:text-on-secondary rounded-full">
            Load More Memories
          </button>
        </div>
      )}
    </div>
  );
}
