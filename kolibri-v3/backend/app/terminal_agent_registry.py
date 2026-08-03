"""Compose the V3 runtime registry from an execution-node configuration."""

from __future__ import annotations

from pathlib import Path

from .agent_runtime import AgentRuntimeRegistry
from .assistant_catalog import TerminalAgentCatalog
from .codex_app_server import CodexAppServerRuntime
from .config import Settings
from .direct_model_runtime import (
    _codex_runtime_adapter,
    _mimo_runtime_adapter,
    build_agent_runtime_registry as _build_restricted_registry,
)
from .mimo_client import MimoClientRuntime
from .mimo_developer_runtime import MimoDeveloperServerRuntime
from .terminal_agent_config import (
    load_mimo_password,
    load_terminal_agent_node_configuration_from_env,
)


TERMINAL_AGENT_CATALOG_CAPABILITY_ID = "terminal-agent.catalog"


def build_agent_runtime_registry(
    settings: Settings,
    *,
    runtime_root: Path,
) -> AgentRuntimeRegistry:
    """Use machine runtimes only when an explicit node-owned file enables them."""

    node_configuration = load_terminal_agent_node_configuration_from_env()
    if node_configuration is None:
        registry = _build_restricted_registry(
            settings,
            runtime_root=runtime_root,
        )
        registry.register_capability(
            TERMINAL_AGENT_CATALOG_CAPABILITY_ID,
            TerminalAgentCatalog.empty(),
        )
        return registry

    registry = AgentRuntimeRegistry()
    codex_transport = CodexAppServerRuntime(
        runtime_root=runtime_root / "codex-terminal",
        command=node_configuration.codex_command,
    )
    mimo_client = MimoClientRuntime(
        timeout_seconds=settings.direct_model_timeout_seconds,
    )
    mimo_developer_transport: MimoDeveloperServerRuntime | None = None
    if node_configuration.mimo_attached_url is not None:
        assert node_configuration.mimo_password_file is not None
        mimo_developer_transport = MimoDeveloperServerRuntime(
            runtime_root=runtime_root / "mimo-attached-state",
            attached_url=node_configuration.mimo_attached_url,
            attached_password=load_mimo_password(
                node_configuration.mimo_password_file
            ),
        )
    elif settings.developer_agent_enabled:
        mimo_developer_transport = MimoDeveloperServerRuntime(
            runtime_root=runtime_root / "mimo-developer",
        )

    # Preserve current profile IDs and request contracts; only the provider
    # transport becomes node-owned and tool-capable.
    registry.register(_codex_runtime_adapter(settings, codex_transport))
    registry.register(
        _mimo_runtime_adapter(
            settings,
            client_transport=mimo_client,
            developer_transport=mimo_developer_transport,
        )
    )
    registry.register_capability(
        TERMINAL_AGENT_CATALOG_CAPABILITY_ID,
        node_configuration.catalog,
    )
    return registry
