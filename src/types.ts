export interface Subject {
  id: string;
  name: string;
  relationship: 'Family' | 'Friend' | 'Pet' | 'Other';
  avatarUrl: string;
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
  generationMode?: 'hugging-face' | 'curated-fallback';
}

export interface EngineStatus {
  ok: boolean;
  storage: 'netlify-blobs';
  aiConfigured: boolean;
  textModel: string;
  imageModel: string;
}
