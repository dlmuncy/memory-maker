import type { Memory, Subject } from '../types';
import { FAMILY_LAKE_IMAGE, FRIENDS_GARDEN_IMAGE } from './images';

function portrait(name: string, background: string, foreground = '#ffffff') {
  const initials = name
    .replace(/\([^)]*\)/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320"><rect width="320" height="320" rx="72" fill="${background}"/><circle cx="160" cy="124" r="66" fill="${foreground}" opacity=".24"/><path d="M54 296c12-77 53-112 106-112s94 35 106 112" fill="${foreground}" opacity=".24"/><text x="160" y="180" text-anchor="middle" font-family="ui-sans-serif,system-ui" font-size="74" font-weight="700" fill="${foreground}">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export const SEED_SUBJECTS: Subject[] = [
  {
    id: 'eleanor',
    name: 'Eleanor Vance',
    relationship: 'Family',
    avatarUrl: portrait('Eleanor Vance', '#315f5f'),
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
    avatarUrl: portrait('Arthur Pendelton', '#9b6547'),
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
    avatarUrl: portrait('Barnaby', '#6e7650'),
    imageCount: 4,
    recalls: 8,
    addedDate: '2026-06-15',
    isEncrypted: true,
    encryptionAlgorithm: 'AES-256-GCM',
  },
];

export const SEED_MEMORIES: Memory[] = [
  {
    id: 'lake-weekend',
    title: 'The Lake House Weekend',
    setting: 'A quiet family lake house at golden hour',
    medium: 'Warm editorial family photography',
    description: 'Three generations settle into the porch as the last sunlight moves across the lake. The easy laughter, bare feet, and familiar closeness make the afternoon feel suspended in time.',
    imageUrl: FAMILY_LAKE_IMAGE,
    subjectsIncluded: ['eleanor', 'arthur'],
    date: 'Summer 2023',
    createdDate: '2026-07-01',
    editLogs: [],
    isE2EE: true,
    generationEngine: 'Local curated composition engine',
    generationMode: 'local-curated',
  },
  {
    id: 'garden-dinner',
    title: 'Garden Dinner Reunion',
    setting: 'A candlelit garden dinner during a glowing summer sunset',
    medium: 'Vibrant lifestyle photography',
    description: 'Old friends lean into the same shared joke as the garden lights begin to glow. Dinner can wait; the laughter is the part everyone will remember.',
    imageUrl: FRIENDS_GARDEN_IMAGE,
    subjectsIncluded: ['eleanor', 'arthur'],
    date: 'Summer 2023',
    createdDate: '2026-07-02',
    editLogs: [],
    isE2EE: true,
    generationEngine: 'Local curated composition engine',
    generationMode: 'local-curated',
  },
  {
    id: 'grand-canyon',
    title: 'Grand Canyon Family Vacation',
    setting: 'Grand Canyon at sunset with warm orange and red hues',
    medium: 'Cinematic landscape silhouette',
    description: 'A breathtaking sunset stretches across the canyon while the family pauses at the overlook, preserving the scale, warmth, and shared wonder of the trip.',
    imageUrl: FAMILY_LAKE_IMAGE,
    subjectsIncluded: ['eleanor', 'arthur'],
    date: 'Autumn 2022',
    createdDate: '2026-07-04',
    editLogs: [],
    isE2EE: true,
    generationEngine: 'Local curated composition engine',
    generationMode: 'local-curated',
  },
  {
    id: 'winter-cabin',
    title: 'Romantic Cabin Retreat',
    setting: 'A snowy pine forest cabin glowing at dusk',
    medium: 'Warm high-key holiday photography',
    description: 'Amber window light spills into the snow as the cabin settles into a quiet mountain evening—an intimate winter memory built around stillness and warmth.',
    imageUrl: FAMILY_LAKE_IMAGE,
    subjectsIncluded: ['arthur'],
    date: 'Winter 2021',
    createdDate: '2026-07-10',
    editLogs: [],
    isE2EE: true,
    generationEngine: 'Local curated composition engine',
    generationMode: 'local-curated',
  },
];

export function cloneSeed<T>(value: T): T {
  return structuredClone(value);
}
