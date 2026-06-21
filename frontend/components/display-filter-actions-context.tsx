"use client";

import { createContext, useContext } from "react";

export type DisplayFilterActions = {
  addNgKeyword: (keyword: string) => void;
  ngKeywords: readonly string[];
  updating: boolean;
};

const DisplayFilterActionsContext = createContext<DisplayFilterActions | null>(
  null,
);

export function DisplayFilterActionsProvider({
  value,
  children,
}: {
  value: DisplayFilterActions | null;
  children: React.ReactNode;
}) {
  return (
    <DisplayFilterActionsContext.Provider value={value}>
      {children}
    </DisplayFilterActionsContext.Provider>
  );
}

export function useDisplayFilterActions(): DisplayFilterActions | null {
  return useContext(DisplayFilterActionsContext);
}
