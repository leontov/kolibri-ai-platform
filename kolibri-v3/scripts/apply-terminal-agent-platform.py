#!/usr/bin/env python3
"""One-shot guarded patch for wiring terminal-agent modules into V3 main."""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "backend/app/main.py"


def replace_once(source: str, old: str, new: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"expected one match, found {count}: {old!r}")
    return source.replace(old, new, 1)


def main() -> None:
    source = MAIN.read_text(encoding="utf-8")
    if "from .terminal_agent_registry import build_agent_runtime_registry" in source:
        return
    source = replace_once(
        source,
        "from .attachments import router as attachments_router\n",
        "from .attachments import router as attachments_router\n"
        "from .assistants import router as assistants_router\n",
    )
    source = replace_once(
        source,
        "from .direct_model_runtime import build_agent_runtime_registry\n",
        "from .terminal_agent_registry import build_agent_runtime_registry\n",
    )
    source = replace_once(
        source,
        "from .trusted_agent_control import router as trusted_agent_control_router\n",
        "from .trusted_agent_control import router as trusted_agent_control_router\n"
        "from .terminal_provider_execution import (\n"
        "    TerminalProviderExecutionService,\n"
        ")\n",
    )
    source = replace_once(
        source,
        "app.state.provider_execution_service = ProviderExecutionService(\n",
        "app.state.provider_execution_service = TerminalProviderExecutionService(\n",
    )
    source = replace_once(
        source,
        "    app.include_router(identity_router)\n",
        "    app.include_router(identity_router)\n"
        "    app.include_router(assistants_router)\n",
    )
    MAIN.write_text(source, encoding="utf-8")


if __name__ == "__main__":
    main()
