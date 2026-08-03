from __future__ import annotations

from pathlib import Path

import pytest

from app.agent_runtime import (
    AgentRuntimeCapabilities,
    AgentRuntimeDescriptor,
    AgentRuntimeRegistry,
    AgentRuntimeResult,
    DelegatingAgentRuntime,
)
from app.assistant_catalog import AssistantManifest, TerminalAgentCatalog
from app.assistant_selection import (
    AssistantSelectionError,
    load_assistant_binding,
    persist_assistant_binding,
    resolve_assistant_binding,
)
from app.database import connect_database, initialize_database, transaction
from app.terminal_agent_registry import TERMINAL_AGENT_CATALOG_CAPABILITY_ID
from app.terminal_agent_security import sha256_bytes
from app.machine_skills import MachineSkillManifest


def _runtime(profile: str = "codex-cli") -> DelegatingAgentRuntime:
    return DelegatingAgentRuntime(
        descriptor=AgentRuntimeDescriptor(
            profile_id=profile,
            runtime_id=f"{profile}-runtime",
            display_name=profile,
            capabilities=AgentRuntimeCapabilities(
                modes=frozenset({"chat", "structured", "developer"}),
                streaming=True,
                structured_output=True,
                activity_events=True,
                persistent_sessions=True,
            ),
        ),
        execute=lambda _request: AgentRuntimeResult(text="ok"),
    )


def _registry(*, skill_id: str = "construction-estimates-ru") -> AgentRuntimeRegistry:
    skill = MachineSkillManifest(
        skill_id=skill_id,
        display_name="Construction estimates RU",
        description="Verified estimate workflow.",
        version="2026.08.1",
        content_hash=sha256_bytes(b"skill package"),
        runtime_profiles=("codex-cli",),
        root_id="machine-skills",
    )
    assistant = AssistantManifest(
        assistant_id="estimator",
        display_name="Сметчик",
        description="Создаёт проверяемые сметы.",
        icon="calculator",
        runtime_profile="codex-cli",
        required_skill_ids=("construction-estimates-ru",),
        optional_skill_ids=("market-research",),
        capabilities=("construction.estimate.create",),
        supported_input_types=("text/plain",),
        supported_artifact_schemas=("kolibri.estimate_draft",),
        access_policy="standard",
        concurrency_class="interactive",
        version=3,
        node_pool="primary-pool",
        manifest_hash=sha256_bytes(b"assistant manifest"),
    )
    catalog = TerminalAgentCatalog(
        node_id="primary-agent-node",
        configuration_hash=sha256_bytes(b"node config"),
        skills=(skill,),
        assistants=(assistant,),
    )
    registry = AgentRuntimeRegistry()
    registry.register(_runtime())
    registry.register_capability(TERMINAL_AGENT_CATALOG_CAPABILITY_ID, catalog)
    return registry


def test_resolve_assistant_freezes_runtime_and_skill_hash() -> None:
    binding = resolve_assistant_binding(
        _registry(),
        assistant_id="estimator",
        execution_mode="standard",
        access_mode="standard",
    )

    assert binding is not None
    assert binding.runtime_profile == "codex-cli"
    assert binding.required_skill_ids == ("construction-estimates-ru",)
    assert binding.optional_skill_ids == ()
    assert binding.node_id == "primary-agent-node"
    assert binding.skill_manifest_hash.startswith("sha256:")


def test_unknown_assistant_fails_without_provider_fallback() -> None:
    with pytest.raises(AssistantSelectionError) as captured:
        resolve_assistant_binding(
            _registry(),
            assistant_id="unknown-assistant",
            execution_mode="standard",
            access_mode="standard",
        )

    assert captured.value.code == "assistant_not_found"


def test_assistant_access_policy_is_server_owned() -> None:
    with pytest.raises(AssistantSelectionError) as captured:
        resolve_assistant_binding(
            _registry(),
            assistant_id="estimator",
            execution_mode="developer",
            access_mode="full",
        )

    assert captured.value.code == "assistant_access_policy_conflict"


def test_assistant_binding_is_durable_and_tenant_scoped(tmp_path: Path) -> None:
    database_url = tmp_path / "assistant.db"
    initialize_database(database_url)
    database = connect_database(database_url)
    try:
        binding = resolve_assistant_binding(
            _registry(),
            assistant_id="estimator",
            execution_mode="standard",
            access_mode="standard",
        )
        assert binding is not None
        with transaction(database, immediate=True):
            database.execute(
                """
                INSERT INTO users (
                    id, email, name, password_hash, role,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, 'user', ?, ?)
                """,
                (
                    "user_binding_test",
                    "binding@example.test",
                    "Binding Test",
                    "scrypt$placeholder",
                    "2026-08-03T00:00:00+00:00",
                    "2026-08-03T00:00:00+00:00",
                ),
            )
            database.execute(
                """
                INSERT INTO organizations (
                    id, name, created_at, updated_at
                ) VALUES (?, ?, ?, ?)
                """,
                (
                    "tenant_binding_test",
                    "Binding Tenant",
                    "2026-08-03T00:00:00+00:00",
                    "2026-08-03T00:00:00+00:00",
                ),
            )
            database.execute(
                """
                INSERT INTO organization_memberships (
                    organization_id, user_id, role, created_at, updated_at
                ) VALUES (?, ?, 'member', ?, ?)
                """,
                (
                    "tenant_binding_test",
                    "user_binding_test",
                    "2026-08-03T00:00:00+00:00",
                    "2026-08-03T00:00:00+00:00",
                ),
            )
            database.execute(
                """
                INSERT INTO projects (
                    tenant_id, id, name, status, created_by_user_id,
                    created_at, updated_at
                ) VALUES (?, ?, ?, 'active', ?, ?, ?)
                """,
                (
                    "tenant_binding_test",
                    "project_binding_test",
                    "Binding Project",
                    "user_binding_test",
                    "2026-08-03T00:00:00+00:00",
                    "2026-08-03T00:00:00+00:00",
                ),
            )
            database.execute(
                """
                INSERT INTO chat_threads (
                    tenant_id, id, project_id, title, status,
                    message_count, run_count, created_at, updated_at
                ) VALUES (?, ?, ?, ?, 'regular', 0, 0, ?, ?)
                """,
                (
                    "tenant_binding_test",
                    "thread_binding_test",
                    "project_binding_test",
                    "Binding Thread",
                    "2026-08-03T00:00:00+00:00",
                    "2026-08-03T00:00:00+00:00",
                ),
            )
            database.execute(
                """
                INSERT INTO chat_messages (
                    tenant_id, id, project_id, thread_id, sequence,
                    client_message_id, role, content_text,
                    created_by_user_id, created_at
                ) VALUES (?, ?, ?, ?, 1, ?, 'user', ?, ?, ?)
                """,
                (
                    "tenant_binding_test",
                    "message_binding_test",
                    "project_binding_test",
                    "thread_binding_test",
                    "client_message_binding_test",
                    "Create an estimate",
                    "user_binding_test",
                    "2026-08-03T00:00:00+00:00",
                ),
            )
            database.execute(
                """
                INSERT INTO chat_runs (
                    tenant_id, id, project_id, thread_id, client_run_id,
                    request_hash, input_message_id, requested_by_user_id,
                    selected_profile, status, last_event_sequence,
                    heartbeat_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'running', 1, ?, ?, ?)
                """,
                (
                    "tenant_binding_test",
                    "run_binding_test",
                    "project_binding_test",
                    "thread_binding_test",
                    "client_run_binding_test",
                    sha256_bytes(b"request"),
                    "message_binding_test",
                    "user_binding_test",
                    "codex-cli",
                    "2026-08-03T00:00:00+00:00",
                    "2026-08-03T00:00:00+00:00",
                    "2026-08-03T00:00:00+00:00",
                ),
            )
            persist_assistant_binding(
                database,
                tenant_id="tenant_binding_test",
                run_id="run_binding_test",
                binding=binding,
                created_at="2026-08-03T00:00:00+00:00",
            )

        loaded = load_assistant_binding(
            database,
            tenant_id="tenant_binding_test",
            run_id="run_binding_test",
        )
        assert loaded is not None
        assert loaded["assistantId"] == "estimator"
        assert loaded["assistantVersion"] == 3
        assert loaded["requiredSkillIds"] == ["construction-estimates-ru"]
        assert (
            load_assistant_binding(
                database,
                tenant_id="tenant_other",
                run_id="run_binding_test",
            )
            is None
        )
    finally:
        database.close()
