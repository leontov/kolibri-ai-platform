export const DEFAULT_ESTIMATE_ROWS = [
  { id: "prep-1", section: "Подготовка", name: "Организация площадки и временные сети", unit: "компл.", qty: 1, price: 185000, type: "Работа", source: "Предварительно" },
  { id: "foundation-1", section: "Фундамент", name: "Монолитная железобетонная плита", unit: "м³", qty: 47, price: 16800, type: "Работа", source: "Предварительно" },
  { id: "foundation-2", section: "Фундамент", name: "Бетон B25 с доставкой", unit: "м³", qty: 50, price: 8650, type: "Материал", source: "Нужен регион" },
  { id: "walls-1", section: "Стены", name: "Кладка несущих стен из рядового кирпича", unit: "м³", qty: 78, price: 5200, type: "Работа", source: "Предварительно" },
  { id: "walls-2", section: "Стены", name: "Кирпич рядовой полнотелый", unit: "тыс. шт.", qty: 31.2, price: 22600, type: "Материал", source: "Нужен регион" },
  { id: "facade-1", section: "Фасад", name: "Облицовочная кладка жёлтым кирпичом", unit: "м²", qty: 168, price: 2450, type: "Работа", source: "Предварительно" },
  { id: "facade-2", section: "Фасад", name: "Кирпич облицовочный жёлтый", unit: "тыс. шт.", qty: 9.4, price: 48500, type: "Материал", source: "Нужен производитель" },
  { id: "roof-1", section: "Кровля", name: "Устройство мягкой кровли с утеплением", unit: "м²", qty: 176, price: 2950, type: "Работа", source: "Предварительно" },
  { id: "roof-2", section: "Кровля", name: "Кровельный комплект и пиломатериал", unit: "компл.", qty: 1, price: 924000, type: "Материал", source: "Предварительно" },
  { id: "engineering-1", section: "Инженерные сети", name: "Электрика, отопление, вода и канализация", unit: "м²", qty: 134, price: 13800, type: "Работа", source: "Уточнить ТУ" },
  { id: "finish-1", section: "Отделка", name: "Внутренняя отделка под ключ, эконом-класс", unit: "м²", qty: 134, price: 21700, type: "Работа", source: "Уточнить состав" },
  { id: "service-1", section: "Общие расходы", name: "Доставка, разгрузка и вывоз отходов", unit: "компл.", qty: 1, price: 285000, type: "Услуга", source: "Нужен регион" },
];

export function calculateEstimate(rows) {
  const totals = { work: 0, materials: 0, services: 0 };

  for (const row of rows) {
    const amount = safeNumber(row.qty) * safeNumber(row.price);
    if (row.type === "Работа") totals.work += amount;
    if (row.type === "Материал") totals.materials += amount;
    if (row.type === "Услуга") totals.services += amount;
  }

  return { ...totals, total: totals.work + totals.materials + totals.services };
}

export function safeNumber(value) {
  const parsed = typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function groupRowsBySection(rows) {
  const sections = new Map();
  for (const row of rows) {
    const section = row.section || "Без раздела";
    if (!sections.has(section)) sections.set(section, []);
    sections.get(section).push(row);
  }
  return [...sections.entries()];
}
