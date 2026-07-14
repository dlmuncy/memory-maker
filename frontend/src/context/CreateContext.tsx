import React, { createContext, useContext, useState } from "react";

export type Photo = {
  id: string;
  user_id: string;
  image_base64: string;
  created_at: string;
};

type CreateState = {
  selected: Photo[];
  prompt: string;
  setSelected: (p: Photo[]) => void;
  setPrompt: (p: string) => void;
  reset: () => void;
};

const CreateContext = createContext<CreateState>({} as CreateState);

export function CreateProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<Photo[]>([]);
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
