export type ReferenceEra = 'current' | 'recent' | 'older' | 'unspecified';

export interface SubjectReference {
  id: string;
  imageUrl: string;
  era: ReferenceEra;
  addedDate: string;
  fileName?: string;
  isPrimary?: boolean;
}

export interface Subject {
  id: string;
  name: string;
  relationship: 'Family' | 'Friend' | 'Pet' | 'Other';
  avatarUrl: string;
  referenceImages: SubjectReference[];
  imageCount: number;
  recalls: number;
  addedDate: string;
  isEncrypted: boolean;
  encryptionAlgorithm?: string;
}

export interface EditLog {
  id: string;
  prompt: string;
  date: string;
  outcomeDescription: string;
  imageUrl: string;
}

export interface Memory {
  id: string;
  title: string;
  setting: string;
  medium: string;
  description: string;
  imageUrl: string;
  subjectsIncluded: string[];
  date: string;
  createdDate: string;
  editLogs: EditLog[];
  isE2EE: boolean;
  sourcePrompt?: string;
  generationEngine?: string;
  generationMode?: 'local-curated' | 'legacy-concept' | 'hugging-face-flux2-klein';
  generationProvider?: string;
  generationSeed?: number;
  referenceCount?: number;
  externalProcessingConsentAt?: string;
  aspectRatio?: 'landscape' | 'square' | 'portrait';
}

export interface EngineStatus {
  ok: boolean;
  storage: 'encrypted-indexeddb';
  generationEngine: 'hugging-face-flux2-klein';
  provider: string;
  modelLicense: 'Apache-2.0';
  tier: 'free-community-compute';
}
