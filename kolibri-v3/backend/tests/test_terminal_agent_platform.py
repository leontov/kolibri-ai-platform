from __future__ import annotations

from dataclasses import replace
import json
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import Response

from app.agent_runtime import (
    AgentRuntimeCapabilities,
    AgentRuntimeDescriptor,
    AgentRuntimeRegistry,
    AgentRuntimeResult,
    DelegatingAgentRuntime,
)
from app.assistants import list_assistants
from app.config import Settings
from app.terminal_agent_config import load_terminal_agent_node_configuration
from app.terminal_agent_registry import (
    TERMINAL_AGENT_CATALOG_CAPABILITY_ID,
    build_agent_runtime_registry,
)
from app.terminal_agent_security import TerminalAgentConfigurationError
from app.terminal_provider_execution import TerminalProviderExecutionService


def _write(path: Path, value: str, mode: int = 0o600) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    path.write_text(value, encoding="utf-8")
    path.chmod(mode)


def _skill(root: Path, name: str = "construction-estimates-ru") -> Path:
    skill_root = root / name
    skill_root.mkdir(mode=0o700, parents=True)
    _write(
        skill_root / "SKILL.md",
        "\n".join(
            (
                "---",
                f"name: {name}",
                "description: Проверяемая строительная смета.",
                "version: 2026.08.1",
                "---",
                "Private workflow instructions stay on the node.",
            )
        ),
    )
    _write(skill_root / "validator.py", "VALUE = 1\n")
    return skill_root


def _configuration(
    tmp_path: Path,
    *,
    include_codex_command: bool = True,
    skill_runtime: str = "codex-cli",
) -> Path:
    skill_root = tmp_path / "skills"
    skill_root.mkdir(mode=0o700)
    _skill(skill_root)
    value: dict[str, Any] = {
        "schemaVersion": "1.0",
        "nodeId": "primary-agent-node",
        "skillRoots": [
            {
                "id": "machine-skills",
                "path": str(skill_root.resolve()),
                "runtimeProfiles": [skill_runtime],
            }
        ],
        "assistants": [
            {
                "assistantId": "estimator",
                "displayName": "Сметчик",
                "description": "Создаёт проверяемые сметы.",
                "icon": "calculator",
                "runtimeProfile": skill_runtime,
                "requiredSkillIds": ["construction-estimates-ru"],
                "optionalSkillIds": ["future-market-research"],
                "capabilities": ["construction.estimate.create"],
                "supportedInputTypes": ["text/plain"],
                "supportedArtifactSchemas": ["kolibri.estimate_draft"],
                "accessPolicy": "standard",
                "concurrencyClass": "interactive",
                "version": 1,
                "nodePool": "primary-pool",
            }
        ],
    }
    if include_codex_command:
        value["codex"] = {
            "command": [
                "/opt/codex/bin/codex",
                "app-server",
                "--stdio",
            ]
        }
    if skill_runtime == "mimo-code":
        password_file = tmp_path / "mimo.password"
        _write(password_file, "mimo-node-password-0123456789\n")
        value["mimo"] = {
            "attachedUrl": "http://127.0.0.1:4123",
            "passwordFile": str(password_file.resolve()),
        }
    path = tmp_path / "terminal-agent.json"
    _write(path, json.dumps(value, ensure_ascii=False))
    return path


def test_node_configuration_discovers_only_safe_skill_metadata(
    tmp_path: Path,
) -> None:
    configuration = load_terminal_agent_node_configuration(
        _configuration(tmp_path)
    )

    assert configuration.codex_command == (
        "/opt/codex/bin/codex",
        "app-server",
        "--stdio",
    )
    assert len(configuration.catalog.skills) == 1
    skill = configuration.catalog.skills[0]
    assert skill.skill_id == "construction-estimates-ru"
    assert skill.version == "2026.08.1"
    assert skill.content_hash.startswith("sha256:")
    public = configuration.catalog.public_view(AgentRuntimeRegistry())
    encoded = json.dumps(public, ensure_ascii=False)
    assert "Private workflow instructions" not in encoded
    assert str(tmp_path) not in encoded
    assert "future-market-research" in encoded


def test_skill_hash_covers_package_resources(tmp_path: Path) -> None:
    path = _configuration(tmp_path)
    first = load_terminal_agent_node_configuration(path)
    validator = tmp_path / "skills/construction-estimates-ru/validator.py"
    _write(validator, "VALUE = 2\n")
    second = load_terminal_agent_node_configuration(path)

    assert (
        first.catalog.skills[0].content_hash
        != second.catalog.skills[0].content_hash
    )


def test_configuration_rejects_writable_file(tmp_path: Path) -> None:
    path = _configuration(tmp_path)
    path.chmod(0o666)

    with pytest.raises(TerminalAgentConfigurationError, match="unsafe"):
        load_terminal_agent_node_configuration(path)


def test_configuration_rejects_skill_symlink(tmp_path: Path) -> None:
    path = _configuration(tmp_path)
    outside = tmp_path / "outside.txt"
    _write(outside, "outside")
    link = tmp_path / "skills/construction-estimates-ru/outside-link"
    try:
        link.symlink_to(outside)
    except OSError:
        pytest.skip("symlinks are unavailable")

    with pytest.raises(TerminalAgentConfigurationError, match="symlink"):
        load_terminal_agent_node_configuration(path)


def test_machine_skills_require_real_node_owned_runtime(tmp_path: Path) -> None:
    path = _configuration(tmp_path, include_codex_command=False)

    with pytest.raises(
        TerminalAgentConfigurationError,
        match="explicit node-owned command",
    ):
        load_terminal_agent_node_configuration(path)


def test_mimo_configuration_accepts_only_loopback_attach(tmp_path: Path) -> None:
    path = _configuration(tmp_path, skill_runtime="mimo-code")
    value = json.loads(path.read_text(encoding="utf-8"))
    value["mimo"]["attachedUrl"] = "http://10.99.0.10:4123"
    _write(path, json.dumps(value))

    with pytest.raises(TerminalAgentConfigurationError, match="URL"):
        load_terminal_agent_node_configuration(path)


def _runtime(profile_id: str) -> DelegatingAgentRuntime:
    return DelegatingAgentRuntime(
        descriptor=AgentRuntimeDescriptor(
            profile_id=profile_id,
            runtime_id=f"{profile_id}-runtime",
            display_name=profile_id,
            capabilities=AgentRuntimeCapabilities(
                modes=frozenset({"developer"}),
                streaming=True,
                structured_output=False,
                activity_events=True,
                persistent_sessions=True,
            ),
        ),
        execute=lambda _request: AgentRuntimeResult(text="ok"),
    )


def test_configured_registry_uses_exact_node_runtime_transports(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    configuration = load_terminal_agent_node_configuration(
        _configuration(tmp_path, skill_runtime="mimo-code")
    )
    captured: dict[str, Any] = {}

    class FakeCodex:
        def __init__(self, **kwargs: Any) -> None:
            captured["codex"] = kwargs

    class FakeMimoClient:
        def __init__(self, **kwargs: Any) -> None:
            captured["mimo_client"] = kwargs

    class FakeMimoServer:
        def __init__(self, **kwargs: Any) -> None:
            captured["mimo_server"] = kwargs

    import app.terminal_agent_registry as registry_module

    monkeypatch.setattr(
        registry_module,
        "load_terminal_agent_node_configuration_from_env",
        lambda: configuration,
    )
    monkeypatch.setattr(registry_module, "CodexAppServerRuntime", FakeCodex)
    monkeypatch.setattr(registry_module, "MimoClientRuntime", FakeMimoClient)
    monkeypatch.setattr(
        registry_module,
        "MimoDeveloperServerRuntime",
        FakeMimoServer,
    )
    monkeypatch.setattr(
        registry_module,
        "_codex_runtime_adapter",
        lambda _settings, _transport: _runtime("codex-cli"),
    )
    monkeypatch.setattr(
        registry_module,
        "_mimo_runtime_adapter",
        lambda _settings, **_kwargs: _runtime("mimo-code"),
    )
    registry = build_agent_runtime_registry(
        Settings.for_testing(database_url=tmp_path / "app.db"),
        runtime_root=tmp_path / "runtime",
    )

    assert captured["codex"]["command"] == configuration.codex_command
    assert captured["mimo_server"]["attached_url"] == (
        "http://127.0.0.1:4123"
    )
    assert captured["mimo_server"]["attached_password"] == (
        "mimo-node-password-0123456789"
    )
    assert registry.capability(TERMINAL_AGENT_CATALOG_CAPABILITY_ID) is (
        configuration.catalog
    )


def test_agent_card_identity_is_bound_to_machine_skill_hash(
    tmp_path: Path,
) -> None:
    configuration = load_terminal_agent_node_configuration(
        _configuration(tmp_path)
    )
    registry = AgentRuntimeRegistry()
    registry.register(_runtime("codex-cli"))
    registry.register_capability(
        TERMINAL_AGENT_CATALOG_CAPABILITY_ID,
        configuration.catalog,
    )
    settings = replace(
        Settings.for_testing(database_url=tmp_path / "provider.db"),
        provider_execution_enabled=True,
        provider_execution_workspace_root=tmp_path,
        provider_execution_allowed_node_id="node-primary",
        provider_execution_allowed_agent_id="agent-primary",
        provider_execution_allowed_slot_id="slot-primary",
        provider_execution_card_updated_at="2026-08-03T00:00:00+00:00",
    )
    service = TerminalProviderExecutionService(
        settings=settings,
        runtime_registry=registry,
    )

    card = service._agent_card("codex-cli")

    assert card["skills"] == ["construction-estimates-ru"]
    assert card["agent_card_id"].startswith("agentcard_")
    assert any(
        value.startswith("skill.catalog.sha256:")
        for value in card["policy_constraints"]
    )


def test_authenticated_assistant_projection_is_dynamic(tmp_path: Path) -> None:
    configuration = load_terminal_agent_node_configuration(
        _configuration(tmp_path)
    )
    registry = AgentRuntimeRegistry()
    registry.register(_runtime("codex-cli"))
    registry.register_capability(
        TERMINAL_AGENT_CATALOG_CAPABILITY_ID,
        configuration.catalog,
    )
    request = SimpleNamespace(
        app=SimpleNamespace(
            state=SimpleNamespace(agent_runtime_registry=registry)
        )
    )
    response = Response()

    payload = list_assistants(request, response, object())

    assert payload["nodeId"] == "primary-agent-node"
    assert payload["assistants"][0]["assistantId"] == "estimator"
    assert payload["assistants"][0]["availability"] == "available"
    assert response.headers["Cache-Control"] == "no-store"
