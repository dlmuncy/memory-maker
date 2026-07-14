import React, { createContext, useContext, useState } from "react";

type ProfileContextState = {
  selectedProfileIds: string[];
  setSelectedProfileIds: (ids: string[]) => void;
  toggleProfile: (id: string) => void;
  clearProfiles: () => void;
};

const ProfileContext = createContext<ProfileContextState>({} as ProfileContextState);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);

  const toggleProfile = (id: string) => {
    setSelectedProfileIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const clearProfiles = () => setSelectedProfileIds([]);

  return (
    <ProfileContext.Provider value={{ selectedProfileIds, setSelectedProfileIds, toggleProfile, clearProfiles }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfiles() {
  return useContext(ProfileContext);
}
