import React, { createContext, useContext, useState } from "react";

export type Photo = {
  id: string;
  user_id: string;
  image_base64: string;
  created_at: string;
};

export type Memory = {
  id: string;
  title: string;
  prompt: string;
  image_base64: string;
  engine: string;
  created_at: string;
};

export type CompareResult = {
  gemini: { ok: boolean; memory?: Memory; error?: string };
  fal: { ok: boolean; memory?: Memory; error?: string };
  prompt: string;
};

type CreateState = {
  selected: Photo[];
  prompt: string;
  compare: CompareResult | null;
  setSelected: (p: Photo[]) => void;
  setPrompt: (p: string) => void;
  setCompare: (c: CompareResult | null) => void;
  reset: () => void;
};

const CreateContext = createContext<CreateState>({} as CreateState);

export function CreateProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<Photo[]>([]);
  const [prompt, setPrompt] = useState("");
  const [compare, setCompare] = useState<CompareResult | null>(null);

  const reset = () => {
    setSelected([]);
    setPrompt("");
  };

  return (
    <CreateContext.Provider value={{ selected, prompt, compare, setSelected, setPrompt, setCompare, reset }}>
      {children}
    </CreateContext.Provider>
  );
}

export function useCreate() {
  return useContext(CreateContext);
}
