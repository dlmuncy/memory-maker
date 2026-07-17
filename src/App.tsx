import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  History,
  Key,
  Lock,
  Menu,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import CreateView from './components/CreateView';
import CryptoKeysView from './components/CryptoKeysView';
import LibraryView from './components/LibraryView';
import MemoriesView from './components/MemoriesView';
import MemoryDetailView from './components/MemoryDetailView';
import UploadView from './components/UploadView';
import { resolveShareImage } from './data/images';
import { apiFetch } from './lib/api';
import { decryptSharedPayload } from './lib/crypto';
import type { EngineStatus, Memory, Subject } from './types';

type Tab = 'library' | 'memories' | 'create' | 'upload' | 'vault';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('library');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [initialSubjectId, setInitialSubjectId] = useState<string | null>(null);
  const [uploadSubjectId, setUploadSubjectId] = useState<string | null>(null);
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [sharedMemory, setSharedMemory] = useState<Memory | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState('');

  const fetchSubjects = useCallback(async () => {
    const data = await apiFetch<Subject[]>('/api/subjects');
    setSubjects(data);
  }, []);

  const fetchMemories = useCallback(async () => {
    const data = await apiFetch<Memory[]>('/api/memories');
    setMemories(data);
  }, []);

  const loadWorkspace = useCallback(async () => {
    setLoadError('');
    try {
      const [, , status] = await Promise.all([
        fetchSubjects(),
        fetchMemories(),
        apiFetch<EngineStatus>('/api/health'),
      ]);
      setEngineStatus(status);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'The memory workspace could not be loaded.');
    }
  }, [fetchMemories, fetchSubjects]);

  const checkSharedLink = useCallback(async () => {
    const hash = window.location.hash;
    if (!hash.startsWith('#share?')) {
      setSharedMemory(null);
      setShareError('');
      return;
    }

    setShareLoading(true);
    setShareError('');
    try {
      const parameters = new URLSearchParams(hash.slice('#share?'.length));
      const encryptedPayload = parameters.get('payload') || '';
      const decryptionKey = parameters.get('key') || '';
      if (!encryptedPayload || !decryptionKey) {
        throw new Error('The encrypted package or its client-side key is missing from this secure link.');
      }
      const memory = await decryptSharedPayload<Memory>(encryptedPayload, decryptionKey);
      setSharedMemory({ ...memory, imageUrl: resolveShareImage(memory.imageUrl) });
    } catch (error) {
      setShareError(error instanceof Error ? error.message : 'This memory could not be decrypted.');
    } finally {
      setShareLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
    void checkSharedLink();
    window.addEventListener('hashchange', checkSharedLink);
    return () => window.removeEventListener('hashchange', checkSharedLink);
  }, [checkSharedLink, loadWorkspace]);

  const goTo = (tab: Tab, subjectId: string | null = null) => {
    setSelectedMemory(null);
    setInitialSubjectId(subjectId);
    setActiveTab(tab);
    if (tab !== 'upload') setUploadSubjectId(null);
    setMobileMenuOpen(false);
  };

  const handleToggleVault = async (passphrase: string) => {
    if (vaultUnlocked) {
      setVaultUnlocked(false);
      return true;
    }
    if (passphrase.trim().length < 6) return false;
    setVaultUnlocked(true);
    return true;
  };

  const handleUploadSuccess = (subject: Subject) => {
    setSubjects((current) => current.some((item) => item.id === subject.id)
      ? current.map((item) => item.id === subject.id ? subject : item)
      : [subject, ...current]);
    goTo('library');
  };

  const openUpload = (subjectId: string | null = null) => {
    setUploadSubjectId(subjectId);
    setSelectedMemory(null);
    setActiveTab('upload');
    setMobileMenuOpen(false);
  };

  const handleSynthesisSuccess = (memory: Memory) => {
    setMemories((current) => [memory, ...current]);
    setSelectedMemory(memory);
    setActiveTab('memories');
    void fetchSubjects();
  };

  const handleUpdateMemory = (memory: Memory) => {
    setMemories((current) => current.map((item) => item.id === memory.id ? memory : item));
    setSelectedMemory(memory);
  };

  const exitSharedMemory = () => {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    setSharedMemory(null);
    setShareError('');
  };

  if (sharedMemory || shareLoading || shareError) {
    return (
      <div className="min-h-screen bg-background text-on-background flex flex-col font-sans">
        <header className="h-16 border-b border-outline-variant bg-surface-container-lowest flex justify-between items-center px-4 md:px-12">
          <h1 className="font-headline-md text-primary font-bold">MyMemoryMakerAI</h1>
          <div className="bg-secondary-container border border-secondary/30 text-on-secondary-container px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
            <ShieldCheck size={14} /> AES-GCM VERIFIED
          </div>
        </header>

        <main className="flex-grow max-w-4xl mx-auto px-4 py-12 w-full space-y-8">
          {shareLoading && (
            <div className="flex flex-col items-center justify-center space-y-4 py-24">
              <RefreshCw className="animate-spin text-secondary" size={42} />
              <p className="font-mono text-sm text-outline">Decrypting locally in this browser…</p>
            </div>
          )}

          {shareError && (
            <div className="bg-error-container text-on-error-container p-6 rounded-2xl border border-error/20 max-w-lg mx-auto text-center space-y-4">
              <AlertTriangle className="text-error mx-auto" size={48} />
              <h2 className="font-bold text-2xl text-primary">Secure memory unavailable</h2>
              <p className="text-sm">{shareError}</p>
              <button onClick={exitSharedMemory} className="bg-primary text-on-primary px-6 py-2.5 rounded-full uppercase text-sm font-semibold">
                Return home
              </button>
            </div>
          )}

          {sharedMemory && (
            <article className="space-y-8 animate-fade-in">
              <div className="flex justify-between items-center gap-4">
                <button onClick={exitSharedMemory} className="text-primary hover:bg-surface-container-low px-4 py-2 rounded-full font-bold uppercase text-xs border border-outline-variant">
                  Exit shared memory
                </button>
                <span className="text-xs font-mono text-outline">Encrypted package and key remained in the URL fragment</span>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant p-4 md:p-8 rounded-2xl shadow-md space-y-6">
                <div className="aspect-[16/9] w-full relative bg-surface-dim rounded-xl overflow-hidden border border-outline-variant">
                  <img src={sharedMemory.imageUrl} alt={sharedMemory.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <div className="absolute top-4 left-4 bg-surface-container-lowest/90 px-3 py-1 rounded-full text-[10px] font-semibold border border-outline-variant tracking-widest text-primary uppercase">
                    End-to-end encrypted share
                  </div>
                </div>
                <div className="space-y-4">
                  <span className="text-xs text-secondary font-bold uppercase tracking-widest block font-mono">{sharedMemory.medium}</span>
                  <h2 className="text-3xl font-bold text-primary">{sharedMemory.title}</h2>
                  <p className="text-on-surface-variant leading-relaxed">{sharedMemory.description}</p>
                </div>
              </div>
            </article>
          )}
        </main>
      </div>
    );
  }

  const navItems: Array<{ tab: Tab; label: string; icon: typeof Users }> = [
    { tab: 'library', label: 'Subject Library', icon: Users },
    { tab: 'create', label: 'Create Memory', icon: Sparkles },
    { tab: 'memories', label: 'Family Adventures', icon: History },
    { tab: 'vault', label: 'Privacy & Vault', icon: Lock },
  ];

  const navigation = (
    <>
      <div className="flex items-center gap-4 border-b border-outline-variant pb-4">
        <div className="w-10 h-10 bg-secondary-container rounded-xl flex items-center justify-center border border-secondary/20 text-secondary">
          <Users size={20} />
        </div>
        <div>
          <h2 className="text-sm text-primary font-bold">Memory Vault</h2>
          <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-wider mt-0.5">Private workspace active</p>
        </div>
      </div>
      <div className="px-4 py-3.5 bg-secondary-container/30 border border-secondary/10 rounded-xl">
        <p className="text-[10px] uppercase tracking-widest text-secondary font-bold mb-1.5">Private storage</p>
        <div className="w-full h-1.5 bg-secondary-container rounded-full overflow-hidden">
          <div className="w-2/3 h-full bg-secondary rounded-full" />
        </div>
        <p className="text-[11px] text-on-surface-variant mt-1.5 font-semibold">Encrypted IndexedDB · stays in this browser</p>
      </div>
      <button onClick={() => goTo('create')} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-on-primary rounded-xl text-xs font-bold uppercase tracking-wider shadow-md hover:opacity-90 transition-all">
        <Sparkles size={15} /> New synthesis
      </button>
      <ul className="flex-1 flex flex-col gap-1 pt-2">
        {navItems.map(({ tab, label, icon: Icon }) => (
          <li key={tab}>
            <button
              onClick={() => goTo(tab)}
              className={`w-full flex items-center gap-4 px-4 py-3 font-semibold uppercase text-xs tracking-wider transition-all rounded-xl ${
                activeTab === tab && !selectedMemory
                  ? 'bg-secondary-container/50 text-secondary border-l-4 border-secondary'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-primary'
              }`}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );

  return (
    <div className="bg-background text-on-background min-h-screen pb-24 md:pb-10 pt-16 font-sans">
      <header className="fixed top-0 w-full z-50 bg-surface-container-lowest/95 backdrop-blur-md border-b border-outline-variant h-16 flex justify-between items-center px-4 md:px-12 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation" className="text-primary hover:bg-surface-container-low p-2 rounded-full md:hidden">
            <Menu size={24} />
          </button>
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-sm">
            <div className="w-3.5 h-3.5 border-2 border-white rounded-full" />
          </div>
          <h1 className="tracking-tight text-primary font-bold text-lg md:text-xl flex items-center gap-1.5">
            MyMemoryMakerAI
            <span className="hidden sm:inline font-mono text-[9px] font-normal text-outline uppercase tracking-widest bg-surface-container px-1.5 py-0.5 rounded border border-outline-variant">Vault</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-xs font-medium">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> AES-GCM sharing active
          </div>
          <UserCircle size={34} className="text-primary" aria-label="Private user workspace" />
        </div>
      </header>

      <nav className="hidden md:flex flex-col h-[calc(100vh-4rem)] w-80 bg-surface-container-lowest fixed left-0 top-16 border-r border-outline-variant p-6 space-y-6 z-40">
        {navigation}
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[70]">
          <button aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)} className="absolute inset-0 bg-primary/40 backdrop-blur-sm" />
          <nav className="relative w-[88%] max-w-sm h-full bg-surface-container-lowest p-6 space-y-6 flex flex-col shadow-2xl">
            <button aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)} className="absolute top-4 right-4 p-2 text-primary rounded-full hover:bg-surface-container">
              <X size={22} />
            </button>
            {navigation}
          </nav>
        </div>
      )}

      <main className="md:ml-80 min-h-[calc(100vh-6.5rem)] p-4 md:p-12 pb-20">
        {loadError && (
          <div className="mb-6 bg-error-container text-on-error-container border border-error/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="flex items-center gap-2"><AlertTriangle size={18} /> {loadError}</span>
            <button onClick={() => void loadWorkspace()} className="font-semibold text-sm underline underline-offset-4">Retry</button>
          </div>
        )}

        {selectedMemory ? (
          <MemoryDetailView
            memory={selectedMemory}
            subjects={subjects}
            onBack={() => goTo('memories')}
            onUpdateMemory={handleUpdateMemory}
          />
        ) : (
          <>
            {activeTab === 'library' && (
              <LibraryView
                subjects={subjects}
                onAddSubjectClick={() => openUpload()}
                onManageSubject={(subject) => openUpload(subject.id)}
                onSubjectClick={(subject) => goTo('create', subject.id)}
                vaultUnlocked={vaultUnlocked}
              />
            )}
            {activeTab === 'memories' && (
              <MemoriesView memories={memories} onMemoryClick={setSelectedMemory} subjects={subjects} />
            )}
            {activeTab === 'create' && (
              <CreateView
                subjects={subjects}
                initialSubjectId={initialSubjectId}
                onAddSubjectClick={() => openUpload()}
                onSynthesisSuccess={handleSynthesisSuccess}
              />
            )}
            {activeTab === 'upload' && (
              <UploadView
                existingSubject={subjects.find((subject) => subject.id === uploadSubjectId) || null}
                onUploadSuccess={handleUploadSuccess}
              />
            )}
            {activeTab === 'vault' && (
              <CryptoKeysView vaultUnlocked={vaultUnlocked} onToggleVault={handleToggleVault} />
            )}
          </>
        )}
      </main>

      <nav className="md:hidden fixed bottom-0 w-full z-50 h-20 bg-surface/95 backdrop-blur-md border-t border-outline-variant flex justify-around items-center px-2">
        {navItems.map(({ tab, label, icon: Icon }) => (
          <button key={tab} onClick={() => goTo(tab)} className={`flex flex-col items-center justify-center font-bold text-[10px] uppercase min-w-16 ${activeTab === tab ? 'text-secondary' : 'text-outline hover:text-primary'}`}>
            <Icon size={20} className="mb-1" />
            <span>{label.split(' ')[0]}</span>
          </button>
        ))}
      </nav>

      <footer className="hidden md:flex h-10 bg-surface-container-lowest border-t border-outline-variant px-8 items-center justify-between fixed bottom-0 right-0 left-80 z-30">
        <div className="flex gap-6 text-[10px] text-on-surface-variant">
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Storage: Encrypted IndexedDB</span>
          <span><strong>Creative engine:</strong> {engineStatus?.generationEngine === 'hugging-face-flux2-klein' ? 'FLUX.2 Klein 4B · free HF compute' : 'Loading…'}</span>
        </div>
        <div className="text-[10px] text-outline">© 2026 MyMemoryMakerAI</div>
      </footer>
    </div>
  );
}
