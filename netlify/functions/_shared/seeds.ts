export type Relationship = 'Family' | 'Friend' | 'Pet' | 'Other';

export interface SubjectRecord {
  id: string;
  name: string;
  relationship: Relationship;
  avatarUrl: string;
  imageCount: number;
  recalls: number;
  addedDate: string;
  isEncrypted: boolean;
  encryptionAlgorithm?: string;
}

export interface EditLogRecord {
  id: string;
  prompt: string;
  date: string;
  outcomeDescription: string;
  imageUrl: string;
}

export interface MemoryRecord {
  id: string;
  title: string;
  setting: string;
  medium: string;
  description: string;
  imageUrl: string;
  subjectsIncluded: string[];
  date: string;
  createdDate: string;
  editLogs: EditLogRecord[];
  isE2EE: boolean;
  sourcePrompt?: string;
  generationEngine?: string;
  generationMode?: 'hugging-face' | 'curated-fallback';
}

export const SEED_SUBJECTS: SubjectRecord[] = [
  {
    id: 'eleanor',
    name: 'Eleanor Vance',
    relationship: 'Family',
    avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAo9dntySZJmZGdIfdUUAnb7X_nPgjMyGwKnBhHhffeIkGGA4y8FAzPeU4cj_HnueyiJzy3Opx0EQPuMU7r2ECl-yIab_OhM52DAH5T-ZoXhq3_utJdQ_aybWOTdGScf4DXqdfq2FZ8N25eq0lGaXYD-zEkSMq5uQ-xYbszh56YTk-bL4JHEPIWvSJHoYcmU3n2DDPrYR1-9-3itOr_dyeuEzNhZQaTLJu26ZkzagFY2tlC60EQaPT--PMkhtGuldbZ8HQn73Br2GI',
    imageCount: 5,
    recalls: 24,
    addedDate: '2026-05-12',
    isEncrypted: true,
    encryptionAlgorithm: 'AES-256-GCM',
  },
  {
    id: 'arthur',
    name: 'Arthur Pendelton',
    relationship: 'Friend',
    avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAXBnudZQbZF1GDzi6EVmy1Ehyfoh_UxOc4N06dpo_ShtlaQc9fDZOiDugrifJr7btCICpwpfV6zOdLEV5B4qG8to51u8kEIsrIO2K2FH5En5geRwBk-edBapCEf2E_TDjZGG7XtgZYhdNmomYQdMEpLWFctJVcfniQD1OTBEkEUJKHf_FznH59I5pN9tvQ57FMc_5C8_xye0N_RZ-XDdj09MUb2hBS_SAXuPVrRMcJZlAfpDtxNTtjYuw9-OzYB_9JnpEy_abTHpU',
    imageCount: 3,
    recalls: 12,
    addedDate: '2026-06-01',
    isEncrypted: true,
    encryptionAlgorithm: 'AES-256-GCM',
  },
  {
    id: 'barnaby',
    name: 'Barnaby (Dog)',
    relationship: 'Pet',
    avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAZXC7GYEDjMoNa05gXpmrb8JS4Wgs5YutgX-nj4rwMlHb4eGJMeNtz2Y-T1b8eGzuibovMUdIKRpniazr7VD47EAEQDgTZcOrQQFGBmb5W1AetMxbCCvFd2xHLC5t4SnLTh4kkiS9ayjRFMeP1EwoxPwqNTBgqdXLw4TKjE9zM51CJEWOscLdOO6Nh7ZYmffkDlqTdJyOE4pZyQHA3j-96iTb8krcsJT_oFG1mIu8-xJ5HOgGyWv6Y8poJqjifgGpv7g-FHD3r6aE',
    imageCount: 4,
    recalls: 8,
    addedDate: '2026-06-15',
    isEncrypted: true,
    encryptionAlgorithm: 'AES-256-GCM',
  },
];

export const SEED_MEMORIES: MemoryRecord[] = [
  {
    id: 'lake-weekend',
    title: 'The Lake House Weekend',
    setting: 'A quiet family lake house at golden hour',
    medium: 'Warm editorial family photography',
    description: 'Three generations settle into the porch as the last sunlight moves across the lake. The easy laughter, bare feet, and familiar closeness make the afternoon feel suspended in time.',
    imageUrl: '/images/family-lake.webp',
    subjectsIncluded: ['eleanor', 'arthur'],
    date: 'Summer 2023',
    createdDate: '2026-07-01',
    editLogs: [],
    isE2EE: true,
    generationEngine: 'Curated launch collection',
    generationMode: 'curated-fallback',
  },
  {
    id: 'garden-dinner',
    title: 'Garden Dinner Reunion',
    setting: 'A candlelit garden dinner during a glowing summer sunset',
    medium: 'Vibrant lifestyle photography',
    description: 'Old friends lean into the same shared joke as the garden lights begin to glow. Dinner can wait; the laughter is the part everyone will remember.',
    imageUrl: '/images/friends-garden.webp',
    subjectsIncluded: ['eleanor', 'arthur'],
    date: 'Summer 2023',
    createdDate: '2026-07-02',
    editLogs: [],
    isE2EE: true,
    generationEngine: 'Curated launch collection',
    generationMode: 'curated-fallback',
  },
  {
    id: 'grand-canyon',
    title: 'Grand Canyon Family Vacation',
    setting: 'Grand Canyon at sunset with warm orange and red hues',
    medium: 'Cinematic landscape silhouette',
    description: 'A breathtaking sunset stretches across the canyon while the family pauses at the overlook, preserving the scale, warmth, and shared wonder of the trip.',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCC9Nd5YD65UrWXQe-G3XnOEsn65j_pgajstbcsP5Xjy-_zLKyzuftT2vmJXmFo_olM_Qq9vhptrnC_3nm_xN6BwPR_HJyLIUWDOASmyht96qi7iTBs7t1wZiC598L9WeWSHztHkUT163CDvVusTL0Ao6y9A_3m4yfDJW8kn-EUjr32X4f944PyFCXxs6khXfBA-Xxwqlc0wdyV-jwtu1wSZT9H-Txm64EdCONVVtZa44RuF3hTVmmp2top5evujZDsccmWR2A1xWc',
    subjectsIncluded: ['eleanor', 'arthur'],
    date: 'Autumn 2022',
    createdDate: '2026-07-04',
    editLogs: [],
    isE2EE: true,
    generationEngine: 'Curated launch collection',
    generationMode: 'curated-fallback',
  },
  {
    id: 'winter-cabin',
    title: 'Romantic Cabin Retreat',
    setting: 'A snowy pine forest cabin glowing at dusk',
    medium: 'Warm high-key holiday photography',
    description: 'Amber window light spills into the snow as the cabin settles into a quiet mountain evening—an intimate winter memory built around stillness and warmth.',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB-hel8Siqeufr-0MI-VMh6SB137HpouMM2g5qWYXhJiQep0dihNbZvfFtUr8LOMT_knv3z1J4xSwkdwRo1NDVlNAx-SG9pVPZJkU83QZLZ-zQ65vWyRdFBsTbb5h5IXgUVb3YmlRkeJ4gRySpbyx8wrjQ9DYLFTXngM4B9IYMah349hmVdktS5vzrG4GZ8KSV4ajUXnPqjFFukLM0HG9X1jDtrg4l6BPxtt13cTmqhbddLJqABQ_9eRE1ac2JykZDc0PTobUcQRxk',
    subjectsIncluded: ['arthur'],
    date: 'Winter 2021',
    createdDate: '2026-07-10',
    editLogs: [],
    isE2EE: true,
    generationEngine: 'Curated launch collection',
    generationMode: 'curated-fallback',
  },
];

export function cloneSeed<T>(value: T): T {
  return structuredClone(value);
}
