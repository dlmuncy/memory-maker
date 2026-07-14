import React, { createContext, useContext, useState } from "react";
import type { LocalPhoto } from "@/src/utils/localPhotos";

type CreateState = {
  selected: LocalPhoto[];
  prompt: string;
  setSelected: (p: LocalPhoto[]) => void;
  setPrompt: (p: string) => void;
  reset: () => void;
};

const CreateContext = createContext<CreateState>({} as CreateState);

export function CreateProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<LocalPhoto[]>([]);
  const [prompt, setPrompt] = useState("");

  const reset = () => {
    setSelected([]);
    setPrompt("");
  };

  return (
    <CreateContext.Provider value={{ selected, prompt, setSelected, setPrompt, reset }}>
      {children}
    </CreateContext.Provider>
  );
}

export function useCreate() {
  return useContext(CreateContext);
}
