"use client";

import { AuiProvider, Suggestions, useAui } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalculatorIcon, CameraIcon, CheckCircle2Icon, Clock3Icon, FileTextIcon, HistoryIcon, MenuIcon, SparklesIcon, XIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

const solverActions = [
  { id: "solve", title: "Решить задачу", label: "пошагово", icon: CalculatorIcon, prompt: "Реши задачу пошагово. Объясни ход решения, покажи промежуточные вычисления и проверь ответ." },
  { id: "photo", title: "Решить по фото", label: "распознать условие", icon: CameraIcon, prompt: "Распознай условие с прикреплённого изображения. Перепиши его без потери данных и реши задачу пошагово." },
  { id: "formula", title: "Разобрать формулу", label: "с объяснением", icon: SparklesIcon, prompt: "Разбери указанную формулу: объясни обозначения, преобразования, выведи решение и приведи короткий пример." },
  { id: "check", title: "Проверить решение", label: "найти ошибку", icon: CheckCircle2Icon, prompt: "Проверь моё решение. Найди первую ошибку, объясни почему она возникла и покажи исправленный ход решения." },
] as const;

const suggestions = Suggestions(solverActions.map(({ title, label, prompt }) => ({ title, label, prompt })));

function SolverActions({ onAction }: { onAction: (id: (typeof solverActions)[number]["id"]) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Быстрые действия">
      {solverActions.map(({ id, title, label, icon: Icon }) => (
        <button key={id} type="button" onClick={() => onAction(id)} className="group min-h-20 rounded-xl border bg-muted/20 px-3 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-muted">
          <Icon className="mb-2 size-4 text-muted-foreground group-hover:text-foreground" aria-hidden="true" />
          <span className="block text-sm font-medium">{title}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{label}</span>
        </button>
      ))}
    </div>
  );
}

function SolverHomeContent() {
  const [mobileNav, setMobileNav] = useState(false);
  const aui = useAui({ suggestions });

  const runAction = (id: (typeof solverActions)[number]["id"]) => {
    const action = solverActions.find((item) => item.id === id);
    if (!action) return;
    aui.composer.setText(action.prompt);
    if (id === "photo") {
      document.querySelector<HTMLButtonElement>("[data-testid='composer-add-attachment']")?.click();
      return;
    }
    document.querySelector<HTMLElement>("[data-testid='composer-input']")?.focus();
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4 sm:px-6">
          <Button type="button" variant="ghost" size="icon" className="md:hidden" aria-label={mobileNav ? "Закрыть навигацию" : "Открыть навигацию"} onClick={() => setMobileNav((value) => !value)}>
            {mobileNav ? <XIcon /> : <MenuIcon />}
          </Button>
          <a href="/home" className="flex items-center gap-2 font-semibold tracking-tight"><span className="flex size-7 items-center justify-center rounded-lg bg-foreground text-background"><SparklesIcon className="size-3.5" aria-hidden="true" /></span>Колибри</a>
          <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Основная навигация"><a className="rounded-lg bg-muted px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="/home">Решить</a><a className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="/app">Рабочая область</a></nav>
          <div className="ml-auto flex items-center gap-2"><a href="/app" className="hidden rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex">Открыть приложение</a><Button asChild size="sm"><a href="/app">Войти</a></Button></div>
        </div>
      </header>

      {mobileNav ? <div className="fixed inset-x-0 top-14 z-30 border-b bg-background p-3 shadow-lg md:hidden"><nav className="grid gap-1" aria-label="Мобильная навигация"><a href="/home" className="rounded-lg px-3 py-3 text-sm font-medium hover:bg-muted">Решить</a><a href="/app" className="rounded-lg px-3 py-3 text-sm hover:bg-muted">Рабочая область</a><a href="/app" className="rounded-lg px-3 py-3 text-sm hover:bg-muted">История решений</a></nav></div> : null}

      <main className="mx-auto grid min-h-[calc(100dvh-3.5rem)] max-w-[1440px] md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden border-r px-3 py-5 md:block"><div className="space-y-1"><SideLink active icon={<CalculatorIcon />} label="Решить задачу" href="/home" /><SideLink icon={<HistoryIcon />} label="История" href="/app" /><SideLink icon={<FileTextIcon />} label="Файлы" href="/app" /></div><div className="mt-8 border-t pt-4"><p className="px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Последнее</p><a href="/app" className="mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"><Clock3Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span className="line-clamp-2">Открыть историю в рабочей области</span></a></div></aside>
        <section className="min-w-0"><div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-[920px] flex-col px-4 py-8 sm:px-6 sm:py-12"><div className="mb-7 text-center sm:mb-9"><div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-xl border bg-muted/40"><SparklesIcon className="size-5" aria-hidden="true" /></div><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Что нужно решить?</h1><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">Напишите задачу обычным языком или прикрепите фото. Колибри разберёт условие, покажет ход решения и проверит результат.</p></div><div className="min-h-0 flex-1 rounded-2xl border bg-background shadow-sm"><AuiProvider value={aui}><Thread compact /></AuiProvider></div><div className="mt-4"><SolverActions onAction={runAction} /></div><p className="mt-5 text-center text-[11px] leading-5 text-muted-foreground">Проверяйте важные ответы. Для формул используйте $...$ или $$...$$ — они отображаются в результате как математическая разметка.</p></div></section>
      </main>
    </div>
  );
}

function SideLink({ active, icon, label, href }: { active?: boolean; icon: ReactNode; label: string; href: string }) {
  return <a href={href} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><span className="[&>svg]:size-4">{icon}</span>{label}</a>;
}

export function SolverHome() { return <SolverHomeContent />; }
