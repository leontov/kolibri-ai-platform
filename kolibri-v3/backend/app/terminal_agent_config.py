"""Load one node-owned terminal-agent configuration without copying secrets."""

from __future__ import annotations

from dataclasses import dataclass
import json
import os
from pathlib import Path

from .assistant_catalog import TerminalAgentCatalog, parse_assistants
from .machine_skills import discover_machine_skills, parse_skill_roots
from .terminal_agent_security import (
    NODE_PATTERN,
    TerminalAgentConfigurationError,
    bounded_text,
    secure_file_bytes,
    sha256_bytes,
    strict_object,
    validate_loopback_url,
)


TERMINAL_AGENT_CONFIG_ENV = "KOLIBRI_V3_TERMINAL_AGENT_CONFIG_FILE"
TERMINAL_AGENT_CONFIG_SCHEMA_VERSION = "1.0"
_CONFIG_MAX_BYTES = 512 * 1024
_SECRET_MAX_BYTES = 4 * 1024
_CONFIG_FIELDS = frozenset(
    {
        "schemaVersion",
        "nodeId",
        "skillRoots",
        "assistants",
        "codex",
        "mimo",
    }
)
_CODEX_FIELDS = frozenset({"command"})
_MIMO_FIELDS = frozenset({"attachedUrl", "passwordFile"})


@dataclass(frozen=True, slots=True)
class TerminalAgentNodeConfiguration:
    catalog: TerminalAgentCatalog
    codex_command: tuple[str, ...] | None
    mimo_attached_url: str | None
    mimo_password_file: Path | None


def _parse_codex(value: object) -> tuple[str, ...] | None:
    if value is None:
        return None
    item = strict_object(
        value,
        fields=_CODEX_FIELDS,
        required=_CODEX_FIELDS,
        name="codex",
    )
    command = item["command"]
    if not isinstance(command, list) or not 2 <= len(command) <= 64:
        raise TerminalAgentConfigurationError("Codex command is invalid")
    parts = tuple(
        bounded_text(part, name="Codex command part", maximum=4096)
        for part in command
    )
    if not Path(parts[0]).is_absolute() or sum(map(len, parts)) > 32_768:
        raise TerminalAgentConfigurationError("Codex command is invalid")
    return parts


def _parse_mimo(value: object) -> tuple[str | None, Path | None]:
    if value is None:
        return None, None
    item = strict_object(
        value,
        fields=_MIMO_FIELDS,
        required=_MIMO_FIELDS,
        name="mimo",
    )
    attached_url = validate_loopback_url(item["attachedUrl"])
    password_file = Path(
        bounded_text(
            item["passwordFile"],
            name="MiMo password file",
            maximum=4096,
        )
    )
    if not password_file.is_absolute():
        raise TerminalAgentConfigurationError(
            "MiMo password file must be absolute"
        )
    return attached_url, password_file


def load_terminal_agent_node_configuration(
    path: Path,
) -> TerminalAgentNodeConfiguration:
    payload = secure_file_bytes(
        path,
        maximum_bytes=_CONFIG_MAX_BYTES,
        secret=False,
    )
    try:
        value = json.loads(payload.decode("utf-8", "strict"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise TerminalAgentConfigurationError(
            "terminal agent configuration is invalid JSON"
        ) from exc
    root = strict_object(
        value,
        fields=_CONFIG_FIELDS,
        required=frozenset(
            {"schemaVersion", "nodeId", "skillRoots", "assistants"}
        ),
        name="terminal agent configuration",
    )
    if root["schemaVersion"] != TERMINAL_AGENT_CONFIG_SCHEMA_VERSION:
        raise TerminalAgentConfigurationError(
            "terminal agent configuration version is unsupported"
        )
    node_id = bounded_text(root["nodeId"], name="node id", maximum=200)
    if NODE_PATTERN.fullmatch(node_id) is None:
        raise TerminalAgentConfigurationError("node id is invalid")

    skills = discover_machine_skills(parse_skill_roots(root["skillRoots"]))
    codex_command = _parse_codex(root.get("codex"))
    mimo_url, mimo_password_file = _parse_mimo(root.get("mimo"))
    profiles_with_skills = {
        profile for skill in skills for profile in skill.runtime_profiles
    }
    if "codex-cli" in profiles_with_skills and codex_command is None:
        raise TerminalAgentConfigurationError(
            "Codex machine skills require an explicit node-owned command"
        )
    if "mimo-code" in profiles_with_skills and mimo_url is None:
        raise TerminalAgentConfigurationError(
            "MiMo machine skills require an attached machine runtime"
        )
    assistants = parse_assistants(root["assistants"], skills=skills)
    assistant_profiles = {assistant.runtime_profile for assistant in assistants}
    if "codex-cli" in assistant_profiles and codex_command is None:
        raise TerminalAgentConfigurationError(
            "Codex assistants require an explicit node-owned command"
        )
    if "mimo-code" in assistant_profiles and mimo_url is None:
        raise TerminalAgentConfigurationError(
            "MiMo assistants require an attached machine runtime"
        )
    return TerminalAgentNodeConfiguration(
        catalog=TerminalAgentCatalog(
            node_id=node_id,
            configuration_hash=sha256_bytes(payload),
            skills=skills,
            assistants=assistants,
        ),
        codex_command=codex_command,
        mimo_attached_url=mimo_url,
        mimo_password_file=mimo_password_file,
    )


def load_terminal_agent_node_configuration_from_env(
) -> TerminalAgentNodeConfiguration | None:
    configured = os.getenv(TERMINAL_AGENT_CONFIG_ENV, "").strip()
    if not configured:
        return None
    return load_terminal_agent_node_configuration(Path(configured))


def load_mimo_password(path: Path) -> str:
    payload = secure_file_bytes(
        path,
        maximum_bytes=_SECRET_MAX_BYTES,
        secret=True,
    )
    try:
        value = payload.decode("utf-8", "strict").rstrip("\r\n")
    except UnicodeDecodeError as exc:
        raise TerminalAgentConfigurationError(
            "MiMo password file is invalid"
        ) from exc
    if not 16 <= len(value) <= 1024 or "\x00" in value:
        raise TerminalAgentConfigurationError("MiMo password file is invalid")
    return value
