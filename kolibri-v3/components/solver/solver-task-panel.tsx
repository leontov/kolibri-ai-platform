import { SOLVER_PRESETS } from "./solver-task-presets";

type SolverTaskPanelProps = {
  onPrompt?: (prompt: string) => void;
};

export function SolverTaskPanel({ onPrompt }: SolverTaskPanelProps) {
  return (
    <section aria-labelledby="solver-task-title" className="solver-task-panel">
      <div className="solver-task-heading">
        <p className="solver-eyebrow">Колибри · Решатель</p>
        <h1 id="solver-task-title">Решай задачи с объяснением</h1>
        <p>Напиши условие обычным языком или добавь фото. Колибри распознает задачу, построит решение и покажет шаги.</p>
      </div>
      <div className="solver-task-grid" aria-label="Быстрые задачи">
        {SOLVER_PRESETS.map((preset) => (
          <button key={preset.id} type="button" className="solver-task-card" onClick={() => onPrompt?.(preset.prompt)}>
            <span className="solver-task-card-icon" aria-hidden="true">{preset.icon === "photo" ? "⌁" : preset.icon === "check" ? "✓" : preset.icon === "explain" ? "i" : "∑"}</span>
            <span>
              <strong>{preset.label}</strong>
              <small>{preset.prompt}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
