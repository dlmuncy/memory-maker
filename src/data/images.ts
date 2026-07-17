import familyLakeImage from '../assets/family-lake.webp';
import friendsGardenImage from '../assets/friends-garden.webp';

export const FAMILY_LAKE_IMAGE = familyLakeImage;
export const FRIENDS_GARDEN_IMAGE = friendsGardenImage;

export function curatedImageFor(setting: string) {
  return /garden|dinner|party|barbecue|bbq|friend|cruise|caribbean/i.test(setting)
    ? FRIENDS_GARDEN_IMAGE
    : FAMILY_LAKE_IMAGE;
}

export function shareImageReference(imageUrl: string) {
  if (imageUrl === FAMILY_LAKE_IMAGE) return 'asset:family-lake';
  if (imageUrl === FRIENDS_GARDEN_IMAGE) return 'asset:friends-garden';
  return imageUrl;
}

export function resolveShareImage(imageUrl: string) {
  if (imageUrl === 'asset:family-lake') return FAMILY_LAKE_IMAGE;
  if (imageUrl === 'asset:friends-garden') return FRIENDS_GARDEN_IMAGE;
  return imageUrl;
}
