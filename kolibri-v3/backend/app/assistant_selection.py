"""Server-owned assistant resolution and immutable run binding."""

from __future__ import annotations

from dataclasses import dataclass
import json
import sqlite3
from typing import Any

from .agent_runtime import AgentRuntimeRegistry
from .assistant_catalog import AssistantManifest, TerminalAgentCatalog
from .terminal_agent_constants import TERMINAL_AGENT_CATALOG_CAPABILITY_ID
from .terminal_agent_security import HASH_PATTERN, IDENTIFIER_PATTERN


class AssistantSelectionError(ValueError):
    """A typed public-safe assistant selection failure."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True, slots=True)
class ResolvedAssistantBinding:
    assistant_id: str
    assistant_version: int
    manifest_hash: str
    runtime_profile: str
    node_id: str
    node_pool: str
    required_skill_ids: tuple[str, ...]
    optional_skill_ids: tuple[str, ...]
    skill_manifest_hash: str

    def __post_init__(self) -> None:
        if IDENTIFIER_PATTERN.fullmatch(self.assistant_id) is None:
            raise ValueError("assistant binding id is invalid")
        if self.assistant_version < 1:
            raise ValueError("assistant binding version is invalid")
        if (
            HASH_PATTERN.fullmatch(self.manifest_hash) is None
            or HASH_PATTERN.fullmatch(self.skill_manifest_hash) is None
        ):
            raise ValueError("assistant binding hash is invalid")


def _catalog(registry: AgentRuntimeRegistry) -> TerminalAgentCatalog:
    value = registry.capability(TERMINAL_AGENT_CATALOG_CAPABILITY_ID)
    if not isinstance(value, TerminalAgentCatalog):
        raise AssistantSelectionError(
            "assistant_catalog_unavailable",
            "Каталог помощников временно недоступен.",
        )
    return value


def _manifest(catalog: TerminalAgentCatalog, assistant_id: str) -> AssistantManifest:
    match = next(
        (
            assistant
            for assistant in catalog.assistants
            if assistant.assistant_id == assistant_id
        ),
        None,
    )
    if match is None:
        raise AssistantSelectionError(
            "assistant_not_found",
            "Выбранный помощник не найден.",
        )
    return match


def resolve_assistant_binding(
    registry: AgentRuntimeRegistry,
    *,
    assistant_id: str | None,
    execution_mode: str,
    access_mode: str,
) -> ResolvedAssistantBinding | None:
    """Resolve a browser preference into one frozen server-owned binding."""

    if assistant_id is None:
        return None
    catalog = _catalog(registry)
    assistant = _manifest(catalog, assistant_id)
    if assistant.runtime_profile not in {
        descriptor.profile_id for descriptor in registry.descriptors()
    }:
        raise AssistantSelectionError(
            "assistant_runtime_unavailable",
            "Runtime выбранного помощника не зарегистрирован.",
        )
    if assistant.runtime_profile in registry.start_errors():
        raise AssistantSelectionError(
            "assistant_runtime_unavailable",
            "Runtime выбранного помощника не запущен.",
        )
    available_skills = set(
        catalog.skill_ids_for_runtime(assistant.runtime_profile)
    )
    if set(assistant.required_skill_ids) - available_skills:
        raise AssistantSelectionError(
            "assistant_required_skill_missing",
            "На execution-node отсутствует обязательный skill помощника.",
        )
    if assistant.access_policy == "standard":
        if execution_mode != "standard" or access_mode != "standard":
            raise AssistantSelectionError(
                "assistant_access_policy_conflict",
                "Этот помощник доступен только в стандартном режиме.",
            )
    elif assistant.access_policy in {"auto", "full"}:
        if execution_mode != "developer" or access_mode != assistant.access_policy:
            raise AssistantSelectionError(
                "assistant_access_policy_conflict",
                "Режим доступа не соответствует политике помощника.",
            )
    else:
        raise AssistantSelectionError(
            "assistant_access_policy_invalid",
            "Политика доступа помощника недействительна.",
        )
    return ResolvedAssistantBinding(
        assistant_id=assistant.assistant_id,
        assistant_version=assistant.version,
        manifest_hash=assistant.manifest_hash,
        runtime_profile=assistant.runtime_profile,
        node_id=catalog.node_id,
        node_pool=assistant.node_pool,
        required_skill_ids=assistant.required_skill_ids,
        optional_skill_ids=tuple(
            skill_id
            for skill_id in assistant.optional_skill_ids
            if skill_id in available_skills
        ),
        skill_manifest_hash=catalog.skill_manifest_hash_for_runtime(
            assistant.runtime_profile
        ),
    )


def persist_assistant_binding(
    database: sqlite3.Connection,
    *,
    tenant_id: str,
    run_id: str,
    binding: ResolvedAssistantBinding,
    created_at: str,
) -> None:
    database.execute(
        """
        INSERT INTO chat_run_assistant_bindings (
            tenant_id, run_id, assistant_id, assistant_version,
            manifest_hash, runtime_profile, node_id, node_pool,
            required_skill_ids_json, optional_skill_ids_json,
            skill_manifest_hash, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            tenant_id,
            run_id,
            binding.assistant_id,
            binding.assistant_version,
            binding.manifest_hash,
            binding.runtime_profile,
            binding.node_id,
            binding.node_pool,
            json.dumps(
                list(binding.required_skill_ids),
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            ),
            json.dumps(
                list(binding.optional_skill_ids),
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            ),
            binding.skill_manifest_hash,
            created_at,
        ),
    )


def load_assistant_binding(
    database: sqlite3.Connection,
    *,
    tenant_id: str,
    run_id: str,
) -> dict[str, Any] | None:
    row = database.execute(
        """
        SELECT assistant_id, assistant_version, manifest_hash,
               runtime_profile, node_id, node_pool,
               required_skill_ids_json, optional_skill_ids_json,
               skill_manifest_hash, created_at
        FROM chat_run_assistant_bindings
        WHERE tenant_id = ? AND run_id = ?
        LIMIT 1
        """,
        (tenant_id, run_id),
    ).fetchone()
    if row is None:
        return None
    return {
        "assistantId": str(row["assistant_id"]),
        "assistantVersion": int(row["assistant_version"]),
        "manifestHash": str(row["manifest_hash"]),
        "runtimeProfile": str(row["runtime_profile"]),
        "nodeId": str(row["node_id"]),
        "nodePool": str(row["node_pool"]),
        "requiredSkillIds": json.loads(str(row["required_skill_ids_json"])),
        "optionalSkillIds": json.loads(str(row["optional_skill_ids_json"])),
        "skillManifestHash": str(row["skill_manifest_hash"]),
        "createdAt": str(row["created_at"]),
    }
