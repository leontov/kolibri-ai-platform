"use client";

import { useAuiState } from "@assistant-ui/react";
import {
  BotIcon,
  CheckIcon,
  ChevronDownIcon,
  LoaderCircleIcon,
} from "lucide-react";
import { useState, type FC } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAssistantSelection } from "@/lib/assistants/selection-context";

export const AssistantSelector: FC<{ compact?: boolean }> = ({
  compact = false,
}) => {
  const selection = useAssistantSelection();
  const running = useAuiState((state) => state.thread.isRunning);
  const [open, setOpen] = useState(false);
  if (selection.status === "inactive" || selection.assistants.length === 0) {
    return null;
  }

  const selected = selection.assistants.find(
    (assistant) => assistant.assistantId === selection.selectedAssistantId,
  );
  const label = selected?.displayName ?? "Авто";
  const choose = (assistantId: string | null) => {
    selection.setSelectedAssistantId(assistantId);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          disabled={running || selection.status === "loading"}
          aria-label={`${label}. Выбрать помощника`}
          className={
            compact
              ? "text-muted-foreground h-9 max-w-40 min-w-0 gap-1 rounded-full px-2"
              : "text-muted-foreground h-8 max-w-48 min-w-0 gap-1.5 rounded-full px-2.5"
          }
        >
          {selection.status === "loading" ? (
            <LoaderCircleIcon className="size-3.5 shrink-0 animate-spin" />
          ) : (
            <BotIcon className="size-3.5 shrink-0" aria-hidden="true" />
          )}
          <span className="min-w-0 truncate text-xs">{label}</span>
          <ChevronDownIcon
            className="size-3.5 shrink-0 opacity-60"
            aria-hidden="true"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="z-[90] w-[min(26rem,calc(100vw-1rem))] rounded-2xl p-2 shadow-xl"
      >
        <DropdownMenuLabel className="text-muted-foreground px-3 py-1 text-sm font-normal">
          Помощник Kolibri
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={selection.selectedAssistantId ?? "auto"}>
          <DropdownMenuRadioItem
            value="auto"
            onSelect={() => choose(null)}
            className="min-h-14 items-start px-3 py-2"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Авто</span>
              <span className="text-muted-foreground mt-0.5 block text-xs leading-4">
                Kolibri выбирает доступный runtime по задаче
              </span>
            </span>
            {selection.selectedAssistantId === null ? (
              <CheckIcon className="mt-0.5 size-4 shrink-0" />
            ) : null}
          </DropdownMenuRadioItem>
          {selection.assistants.map((assistant) => {
            const available = assistant.availability === "available";
            return (
              <DropdownMenuRadioItem
                key={assistant.assistantId}
                value={assistant.assistantId}
                disabled={!available}
                onSelect={() => {
                  if (available) choose(assistant.assistantId);
                }}
                className="min-h-14 items-start px-3 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {assistant.displayName}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-xs leading-4">
                    {available
                      ? assistant.description
                      : `Недоступен: ${assistant.unavailableReason ?? "runtime offline"}`}
                  </span>
                </span>
                {selection.selectedAssistantId === assistant.assistantId ? (
                  <CheckIcon className="mt-0.5 size-4 shrink-0" />
                ) : null}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
