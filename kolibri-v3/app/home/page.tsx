import type { Metadata } from "next";
import { SolverHome } from "@/components/kolibri-home/solver-home";

export const metadata: Metadata = {
  title: "Колибри — AI-решатель задач",
  description:
    "Решайте задачи текстом или по фото: пошаговое объяснение, формулы, таблицы и проверка результата.",
  alternates: { canonical: "/home" },
  openGraph: {
    title: "Колибри — AI-решатель задач",
    description: "Задача → анализ → пошаговое решение → проверка результата.",
    type: "website",
  },
};

export default function HomeSolverPage() {
  return <SolverHome />;
}
