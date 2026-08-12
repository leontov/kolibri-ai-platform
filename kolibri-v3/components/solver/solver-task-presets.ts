export type SolverPreset = {
  id: string;
  label: string;
  prompt: string;
  icon: "math" | "photo" | "check" | "explain";
};

export const SOLVER_PRESETS: readonly SolverPreset[] = [
  { id: "solve", label: "Решить задачу", prompt: "Реши задачу пошагово и объясни каждый переход.", icon: "math" },
  { id: "photo", label: "Решить по фото", prompt: "Разбери задание на фото, распознай условие и реши его пошагово.", icon: "photo" },
  { id: "check", label: "Проверить решение", prompt: "Проверь моё решение, найди ошибки и покажи исправленный ход решения.", icon: "check" },
  { id: "explain", label: "Объяснить тему", prompt: "Объясни тему простым языком, затем приведи пример и короткую проверку понимания.", icon: "explain" },
];
