import { announceAuthenticationRequired } from "@/lib/identity/events";

export const ASSISTANT_CATALOG_BFF_URL = "/api/v3/assistants";

const MAX_RESPONSE_BYTES = 512 * 1_024;
const IDENTIFIER = /^[a-z][a-z0-9_.:-]{2,127}$/;
const PROFILE = /^[a-z0-9][a-z0-9._-]{1,95}$/;
const HASH = /^sha256:[0-9a-f]{64}$/;
const NODE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const uniqueStrings = (
  value: unknown,
  pattern: RegExp,
  maximum: number,
): readonly string[] | null => {
  if (!Array.isArray(value) || value.length > maximum) return null;
  const items = value.filter((item): item is string => typeof item === "string");
  if (
    items.length !== value.length ||
    new Set(items).size !== items.length ||
    items.some((item) => !pattern.test(item))
  ) {
    return null;
  }
  return items;
};

export type TerminalAssistant = {
  readonly assistantId: string;
  readonly displayName: string;
  readonly description: string;
  readonly icon: string;
  readonly runtimeProfile: string;
  readonly requiredSkillIds: readonly string[];
  readonly optionalSkillIds: readonly string[];
  readonly capabilities: readonly string[];
  readonly supportedInputTypes: readonly string[];
  readonly supportedArtifactSchemas: readonly string[];
  readonly accessPolicy: "standard" | "auto" | "full";
  readonly concurrencyClass: "interactive" | "background" | "exclusive";
  readonly version: number;
  readonly manifestHash: string;
  readonly availability: "available" | "offline";
  readonly unavailableReason: string | null;
  readonly nodePool: string;
  readonly nodeId: string;
};

export type TerminalAssistantCatalog = {
  readonly nodeId: string;
  readonly configurationHash: string;
  readonly assistants: readonly TerminalAssistant[];
};

const parseAssistant = (value: unknown): TerminalAssistant | null => {
  if (!isRecord(value)) return null;
  const requiredSkillIds = uniqueStrings(value.requiredSkillIds, IDENTIFIER, 64);
  const optionalSkillIds = uniqueStrings(value.optionalSkillIds, IDENTIFIER, 64);
  const capabilities = uniqueStrings(value.capabilities, IDENTIFIER, 64);
  const supportedInputTypes = uniqueStrings(
    value.supportedInputTypes,
    /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/,
    32,
  );
  const supportedArtifactSchemas = uniqueStrings(
    value.supportedArtifactSchemas,
    /^kolibri\.[a-z][a-z0-9_.]{1,126}$/,
    64,
  );
  if (
    value.schemaId !== "kolibri.assistant_manifest" ||
    value.schemaVersion !== "1.0" ||
    typeof value.assistantId !== "string" ||
    !IDENTIFIER.test(value.assistantId) ||
    typeof value.displayName !== "string" ||
    value.displayName.length < 1 ||
    value.displayName.length > 160 ||
    typeof value.description !== "string" ||
    value.description.length < 1 ||
    value.description.length > 500 ||
    typeof value.icon !== "string" ||
    !/^[a-z][a-z0-9_-]{1,63}$/.test(value.icon) ||
    typeof value.runtimeProfile !== "string" ||
    !PROFILE.test(value.runtimeProfile) ||
    requiredSkillIds === null ||
    optionalSkillIds === null ||
    capabilities === null ||
    supportedInputTypes === null ||
    supportedArtifactSchemas === null ||
    !["standard", "auto", "full"].includes(String(value.accessPolicy)) ||
    !["interactive", "background", "exclusive"].includes(
      String(value.concurrencyClass),
    ) ||
    typeof value.version !== "number" ||
    !Number.isSafeInteger(value.version) ||
    value.version < 1 ||
    typeof value.manifestHash !== "string" ||
    !HASH.test(value.manifestHash) ||
    !["available", "offline"].includes(String(value.availability)) ||
    (value.unavailableReason !== null &&
      (typeof value.unavailableReason !== "string" ||
        !IDENTIFIER.test(value.unavailableReason))) ||
    typeof value.nodePool !== "string" ||
    !IDENTIFIER.test(value.nodePool) ||
    typeof value.nodeId !== "string" ||
    !NODE.test(value.nodeId)
  ) {
    return null;
  }
  return {
    assistantId: value.assistantId,
    displayName: value.displayName,
    description: value.description,
    icon: value.icon,
    runtimeProfile: value.runtimeProfile,
    requiredSkillIds,
    optionalSkillIds,
    capabilities,
    supportedInputTypes,
    supportedArtifactSchemas,
    accessPolicy: value.accessPolicy as TerminalAssistant["accessPolicy"],
    concurrencyClass:
      value.concurrencyClass as TerminalAssistant["concurrencyClass"],
    version: value.version,
    manifestHash: value.manifestHash,
    availability: value.availability as TerminalAssistant["availability"],
    unavailableReason: value.unavailableReason as string | null,
    nodePool: value.nodePool,
    nodeId: value.nodeId,
  };
};

export const parseTerminalAssistantCatalog = (
  value: unknown,
): TerminalAssistantCatalog => {
  if (
    !isRecord(value) ||
    value.schemaId !== "kolibri.terminal_agent_catalog" ||
    value.schemaVersion !== "1.0" ||
    typeof value.nodeId !== "string" ||
    !NODE.test(value.nodeId) ||
    typeof value.configurationHash !== "string" ||
    !HASH.test(value.configurationHash) ||
    !Array.isArray(value.assistants) ||
    value.assistants.length > 64
  ) {
    throw new Error("Assistant catalog contract is invalid.");
  }
  const assistants = value.assistants.map(parseAssistant);
  if (
    assistants.some((assistant) => assistant === null) ||
    new Set(assistants.map((assistant) => assistant?.assistantId)).size !==
      assistants.length
  ) {
    throw new Error("Assistant catalog contract is invalid.");
  }
  return {
    nodeId: value.nodeId,
    configurationHash: value.configurationHash,
    assistants: assistants as TerminalAssistant[],
  };
};

export const loadTerminalAssistantCatalog = async (): Promise<TerminalAssistantCatalog> => {
  const response = await fetch(ASSISTANT_CATALOG_BFF_URL, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    cache: "no-store",
  });
  if (response.status === 401) announceAuthenticationRequired();
  if (!response.ok) throw new Error("Assistant catalog is unavailable.");
  const type = response.headers.get("content-type")?.toLowerCase() ?? "";
  const length = Number(response.headers.get("content-length"));
  if (
    !type.includes("application/json") ||
    (Number.isFinite(length) && length > MAX_RESPONSE_BYTES)
  ) {
    throw new Error("Assistant catalog contract is invalid.");
  }
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
    throw new Error("Assistant catalog contract is invalid.");
  }
  return parseTerminalAssistantCatalog(JSON.parse(text) as unknown);
};
