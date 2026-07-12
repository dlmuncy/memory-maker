// Design tokens from /app/design_guidelines.json — "iOS-Native Clean" warm palette.
export const colors = {
  surface: "#FBFBF9",
  onSurface: "#191818",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#191818",
  surfaceTertiary: "#F0EFEA",
  onSurfaceTertiary: "#4A4846",
  surfaceInverse: "#191818",
  onSurfaceInverse: "#FBFBF9",
  brand: "#D46F54",
  brandPrimary: "#D46F54",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#E8A395",
  onBrandSecondary: "#3B1B15",
  brandTertiary: "#FCEAE5",
  onBrandTertiary: "#8E3D2A",
  success: "#597E52",
  warning: "#D9A05B",
  error: "#BA4A4A",
  onError: "#FFFFFF",
  info: "#6B6A68",
  border: "#E6E4DF",
  borderStrong: "#CFCBC2",
  divider: "#E6E4DF",
  overlayDark: "rgba(25,24,24,0.55)",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};

export const font = {
  regular: "PlusJakarta_400",
  medium: "PlusJakarta_500",
};

export const type = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  "2xl": 24,
  display: 30,
};

export const shadow = {
  card: {
    shadowColor: "#191818",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  floating: {
    shadowColor: "#191818",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const images = {
  heroOnboarding:
    "https://images.unsplash.com/photo-1528569937393-ee892b976859?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTJ8MHwxfHNlYXJjaHwxfHxmYW1pbHklMjBsb29raW5nJTIwYXQlMjBwaG90byUyMGFsYnVtfGVufDB8fHx8MTc4MzgyMDI2Mnww&ixlib=rb-4.1.0&q=85",
  emptyGallery:
    "https://images.unsplash.com/photo-1622006816279-9281a5308e5d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2OTV8MHwxfHNlYXJjaHwxfHxlbXB0eSUyMHBob3RvJTIwYWxidW18ZW58MHx8fHwxNzgzODIwMjUyfDA&ixlib=rb-4.1.0&q=85",
  uploadPlaceholder:
    "https://images.unsplash.com/photo-1609374322793-4582059b0024?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTV8MHwxfHNlYXJjaHwxfHxwb3J0cmFpdCUyMHBob3RvZ3JhcGh5JTIwY29sbGFnZXxlbnwwfHx8fDE3ODM4MjAyNjJ8MA&ixlib=rb-4.1.0&q=85",
};

export const suggestions = [
  {
    label: "Ski Lodge Getaway",
    prompt: "on a cozy family vacation at a snowy ski lodge in the Alps, warm winter clothing, fireplace glow",
    image:
      "https://images.unsplash.com/photo-1548873903-a7e6aaea6495?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODh8MHwxfHNlYXJjaHwxfHxza2klMjBsb2RnZSUyMHNub3clMjBtb3VudGFpbnxlbnwwfHx8fDE3ODM4MjAyNTJ8MA&ixlib=rb-4.1.0&q=85",
  },
  {
    label: "Cancún Beach",
    prompt: "on a sunny beach vacation in Cancún, Mexico, turquoise water, palm trees, golden hour",
    image:
      "https://images.unsplash.com/photo-1602088113235-229c19758e9f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MTJ8MHwxfHNlYXJjaHwxfHxjYW5jdW4lMjBiZWFjaCUyMHZhY2F0aW9ufGVufDB8fHx8MTc4MzgyMDI1Mnww&ixlib=rb-4.1.0&q=85",
  },
  {
    label: "Antarctica Cruise",
    prompt: "on a cruise expedition in Antarctica, standing on the deck with icebergs and penguins in the background",
    image:
      "https://images.unsplash.com/photo-1642928614293-ba6ff94b4a75?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NDh8MHwxfHNlYXJjaHwxfHxhbnRhcmN0aWNhJTIwY3J1aXNlfGVufDB8fHx8MTc4MzgyMDI1Mnww&ixlib=rb-4.1.0&q=85",
  },
];
