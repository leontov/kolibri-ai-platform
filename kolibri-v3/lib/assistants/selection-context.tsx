"use client";

import {
  createContext,
  useContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import type { TerminalAssistant } from "./catalog";

export type AssistantSelectionState = {
  readonly status: "inactive" | "loading" | "ready" | "error";
  readonly assistants: readonly TerminalAssistant[];
  readonly selectedAssistantId: string | null;
  readonly setSelectedAssistantId: Dispatch<SetStateAction<string | null>>;
};

const AssistantSelectionContext = createContext<AssistantSelectionState>({
  status: "inactive",
  assistants: [],
  selectedAssistantId: null,
  setSelectedAssistantId: () => undefined,
});

export const AssistantSelectionProvider = ({
  value,
  children,
}: Readonly<{
  value: AssistantSelectionState;
  children: ReactNode;
}>) => (
  <AssistantSelectionContext.Provider value={value}>
    {children}
  </AssistantSelectionContext.Provider>
);

export const useAssistantSelection = () =>
  useContext(AssistantSelectionContext);
