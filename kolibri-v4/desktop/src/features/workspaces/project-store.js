const STORAGE_KEY = "kolibri:v4:projects";
export const INITIAL_PROJECT = {
  id: "project_house_134",
  title: "Одноэтажный дом 134 м²",
  region: "Регион не указан",
  estimateStatus: "Нужны исходные данные",
  brief:
    "Одноэтажный дом 134 м². Мягкая кровля, монолитная плита, кирпичные стены с жёлтым облицовочным кирпичом, отделка под ключ эконом-класса, отопление, электрика и инженерные сети. Регион и часть исходных данных требуется уточнить.",
};

function slugId(title) {
  const normalized = title.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 48);
  return `project_${normalized || Date.now().toString(36)}_${Date.now().toString(36)}`;
}

export function normalizeProject(value) {
  if (!value || typeof value !== "object") return null;
  const title = typeof value.title === "string" ? value.title.trim().slice(0, 180) : "";
  if (!title) return null;
  return {
    id: typeof value.id === "string" && value.id ? value.id.slice(0, 120) : slugId(title),
    title,
    region: typeof value.region === "string" && value.region.trim() ? value.region.trim().slice(0, 120) : "Регион не указан",
    estimateStatus: typeof value.estimateStatus === "string" && value.estimateStatus.trim()
      ? value.estimateStatus.trim().slice(0, 80)
      : "Нужны исходные данные",
    brief: typeof value.brief === "string" ? value.brief.trim().slice(0, 4_000) : "",
  };
}

export function readProjects(storage) {
  if (!storage) return [INITIAL_PROJECT];
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? "null");
    const projects = Array.isArray(parsed) ? parsed.map(normalizeProject).filter(Boolean) : [];
    return projects.length ? projects : [INITIAL_PROJECT];
  } catch {
    return [INITIAL_PROJECT];
  }
}

export function writeProjects(storage, projects) {
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(projects.map(normalizeProject).filter(Boolean)));
}

export function createProject(title, region = "Регион не указан", brief = "") {
  const project = normalizeProject({
    id: slugId(title),
    title,
    region,
    brief,
    estimateStatus: "Нужны исходные данные",
  });
  if (!project) throw new Error("Укажите название проекта.");
  return project;
}
