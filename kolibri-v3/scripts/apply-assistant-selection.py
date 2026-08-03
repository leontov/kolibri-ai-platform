#!/usr/bin/env python3
"""Guarded wiring for server-owned assistant selection."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def write(relative: str, value: str) -> None:
    (ROOT / relative).write_text(value, encoding="utf-8")


def replace_once(source: str, old: str, new: str, *, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return source.replace(old, new, 1)


def patch_models() -> None:
    path = "backend/app/chat/models.py"
    source = read(path)
    if "assistant_id: AssistantId | None" in source:
        return
    source = replace_once(
        source,
        'AccessMode = Literal["standard", "auto", "full"]\n',
        'AccessMode = Literal["standard", "auto", "full"]\n'
        'AssistantId: TypeAlias = Annotated[\n'
        '    str,\n'
        '    StringConstraints(\n'
        '        strict=True,\n'
        '        min_length=3,\n'
        '        max_length=128,\n'
        '        pattern=r"^[a-z][a-z0-9_.:-]{2,127}$",\n'
        '    ),\n'
        ']\n',
        label="models type",
    )
    source = replace_once(
        source,
        'class ForwardedProps(StrictModel):\n'
        '    agent_profile: AgentProfile | None = Field(\n',
        'class ForwardedProps(StrictModel):\n'
        '    assistant_id: AssistantId | None = Field(\n'
        '        default=None,\n'
        '        alias="assistantId",\n'
        '    )\n'
        '    agent_profile: AgentProfile | None = Field(\n',
        label="models field",
    )
    write(path, source)


def patch_execution_adapter() -> None:
    path = "backend/app/chat/execution_adapter.py"
    source = read(path)
    if "assistant_binding: ResolvedAssistantBinding | None" in source:
        return
    source = replace_once(
        source,
        'from ..agent_runtime import AgentRuntimeRegistry\n',
        'from ..agent_runtime import AgentRuntimeRegistry\n'
        'from ..assistant_selection import (\n'
        '    AssistantSelectionError,\n'
        '    ResolvedAssistantBinding,\n'
        '    resolve_assistant_binding,\n'
        ')\n',
        label="execution imports",
    )
    source = replace_once(
        source,
        'class PreparedChatExecution:\n'
        '    execution_plane: str\n',
        'class PreparedChatExecution:\n'
        '    execution_plane: str\n'
        '    assistant_binding: ResolvedAssistantBinding | None\n',
        label="execution dataclass",
    )
    source = replace_once(
        source,
        '    execution_mode = run_input.forwarded_props.execution_mode\n'
        '    runtime_profile = (\n'
        '        run_input.forwarded_props.agent_profile\n'
        '        or identity.preferred_agent_profile.value\n'
        '    )\n',
        '    execution_mode = run_input.forwarded_props.execution_mode\n'
        '    try:\n'
        '        assistant_binding = resolve_assistant_binding(\n'
        '            request.app.state.agent_runtime_registry,\n'
        '            assistant_id=run_input.forwarded_props.assistant_id,\n'
        '            execution_mode=execution_mode,\n'
        '            access_mode=run_input.forwarded_props.access_mode,\n'
        '        )\n'
        '    except AssistantSelectionError as exc:\n'
        '        raise _error(\n'
        '            status.HTTP_422_UNPROCESSABLE_ENTITY,\n'
        '            exc.code,\n'
        '            exc.message,\n'
        '        ) from exc\n'
        '    runtime_profile = (\n'
        '        assistant_binding.runtime_profile\n'
        '        if assistant_binding is not None\n'
        '        else (\n'
        '            run_input.forwarded_props.agent_profile\n'
        '            or identity.preferred_agent_profile.value\n'
        '        )\n'
        '    )\n',
        label="execution resolution",
    )
    source = replace_once(
        source,
        '    return PreparedChatExecution(\n'
        '        execution_plane=execution_plane,\n',
        '    return PreparedChatExecution(\n'
        '        execution_plane=execution_plane,\n'
        '        assistant_binding=assistant_binding,\n',
        label="execution return",
    )
    write(path, source)


def patch_service() -> None:
    path = "backend/app/chat/service.py"
    source = read(path)
    if "persist_assistant_binding(" in source:
        return
    source = replace_once(
        source,
        'from ..attachment_service import (\n',
        'from ..assistant_selection import persist_assistant_binding\n'
        'from ..attachment_service import (\n',
        label="service import",
    )
    marker = '''            # A runtime skill is reviewed server-owned guidance, not a
            # browser-selected prompt and not an AgentAssignment.  Recording
'''
    insertion = '''            if prepared.assistant_binding is not None:
                persist_assistant_binding(
                    database,
                    tenant_id=identity.tenant_id,
                    run_id=run_id,
                    binding=prepared.assistant_binding,
                    created_at=created_at,
                )
            # A runtime skill is reviewed server-owned guidance, not a
            # browser-selected prompt and not an AgentAssignment.  Recording
'''
    source = replace_once(source, marker, insertion, label="service persist")
    source = replace_once(
        source,
        '                estimate_owned_model_policy\n'
        '                and execution_mode != "developer"\n'
        '            ):\n',
        '                estimate_owned_model_policy\n'
        '                and execution_mode != "developer"\n'
        '                and prepared.assistant_binding is None\n'
        '            ):\n',
        label="service legacy skill gate",
    )
    write(path, source)


def patch_agui_schema() -> None:
    path = ROOT / "contracts/v1/chat/ag-ui-run-input.schema.json"
    value = json.loads(path.read_text(encoding="utf-8"))
    forwarded = value["properties"]["forwardedProps"]
    if "assistantId" in forwarded["properties"]:
        return
    forwarded["properties"]["assistantId"] = {
        "type": ["string", "null"],
        "minLength": 3,
        "maxLength": 128,
        "pattern": "^[a-z][a-z0-9_.:-]{2,127}$",
    }
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def patch_client() -> None:
    path = "lib/product-chat/client.ts"
    source = read(path)
    if "getAssistantId: () => string | null" in source:
        return
    source = replace_once(
        source,
        'const SAFE_SHORT_RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,123}$/;\n',
        'const SAFE_SHORT_RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,123}$/;\n'
        'const SAFE_ASSISTANT_ID = /^[a-z][a-z0-9_.:-]{2,127}$/;\n',
        label="client regex",
    )
    source = replace_once(
        source,
        '  readonly getAgentProfile: () => KolibriAgentProfile;\n',
        '  readonly getAssistantId: () => string | null;\n'
        '  readonly getAgentProfile: () => KolibriAgentProfile;\n',
        label="client options",
    )
    source = replace_once(
        source,
        '  fetch: fetchImpl = defaultFetch,\n'
        '  getAgentProfile,\n',
        '  fetch: fetchImpl = defaultFetch,\n'
        '  getAssistantId,\n'
        '  getAgentProfile,\n',
        label="client destructure",
    )
    source = replace_once(
        source,
        '    const body = parseAgUiRequestBody(init?.body);\n'
        '    const profile = getAgentProfile();\n',
        '    const body = parseAgUiRequestBody(init?.body);\n'
        '    const assistantId = getAssistantId();\n'
        '    if (assistantId !== null && !SAFE_ASSISTANT_ID.test(assistantId)) {\n'
        '      throw new ProductChatContractError(\n'
        '        "Invalid Kolibri assistant ID.",\n'
        '      );\n'
        '    }\n'
        '    const profile = getAgentProfile();\n',
        label="client validation",
    )
    source = replace_once(
        source,
        '        forwardedProps: {\n'
        '          // Developer mode is a browser request hint, never an authority\n',
        '        forwardedProps: {\n'
        '          // An assistant ID is a preference only. The backend resolves\n'
        '          // its runtime, machine skills, node pool and immutable hashes.\n'
        '          ...(assistantId === null ? {} : { assistantId }),\n'
        '          // Developer mode is a browser request hint, never an authority\n',
        label="client forwarded props",
    )
    write(path, source)


def patch_runtime_provider() -> None:
    path = "app/MyRuntimeProvider.tsx"
    source = read(path)
    if "loadTerminalAssistantCatalog" in source:
        return
    source = replace_once(
        source,
        'import { useIdentity } from "@/lib/identity/provider";\n',
        'import { useIdentity } from "@/lib/identity/provider";\n'
        'import {\n'
        '  loadTerminalAssistantCatalog,\n'
        '  type TerminalAssistant,\n'
        '} from "@/lib/assistants/catalog";\n'
        'import { AssistantSelectionProvider } from "@/lib/assistants/selection-context";\n',
        label="runtime imports",
    )
    source = replace_once(
        source,
        '  const developerAccessModeRef = useRef(developerAccessMode);\n'
        '  developerAccessModeRef.current = developerAccessMode;\n',
        '  const developerAccessModeRef = useRef(developerAccessMode);\n'
        '  developerAccessModeRef.current = developerAccessMode;\n'
        '  const [assistantStatus, setAssistantStatus] = useState<\n'
        '    "inactive" | "loading" | "ready" | "error"\n'
        '  >(authenticated ? "loading" : "inactive");\n'
        '  const [assistants, setAssistants] = useState<\n'
        '    readonly TerminalAssistant[]\n'
        '  >([]);\n'
        '  const [selectedAssistantId, setSelectedAssistantId] =\n'
        '    useState<string | null>(null);\n'
        '  const selectedAssistantIdRef = useRef(selectedAssistantId);\n'
        '  selectedAssistantIdRef.current = selectedAssistantId;\n',
        label="runtime state",
    )
    source = replace_once(
        source,
        '  useEffect(() => {\n'
        '    if (!developerAgentAvailable) setDeveloperAccessMode("standard");\n'
        '  }, [developerAgentAvailable]);\n',
        '  useEffect(() => {\n'
        '    if (!developerAgentAvailable) setDeveloperAccessMode("standard");\n'
        '  }, [developerAgentAvailable]);\n'
        '\n'
        '  useEffect(() => {\n'
        '    if (!authenticated) {\n'
        '      setAssistantStatus("inactive");\n'
        '      setAssistants([]);\n'
        '      setSelectedAssistantId(null);\n'
        '      return;\n'
        '    }\n'
        '    let current = true;\n'
        '    setAssistantStatus("loading");\n'
        '    void loadTerminalAssistantCatalog()\n'
        '      .then((catalog) => {\n'
        '        if (!current) return;\n'
        '        setAssistants(catalog.assistants);\n'
        '        setSelectedAssistantId((selected) =>\n'
        '          catalog.assistants.some(\n'
        '            (assistant) =>\n'
        '              assistant.assistantId === selected &&\n'
        '              assistant.availability === "available",\n'
        '          )\n'
        '            ? selected\n'
        '            : null,\n'
        '        );\n'
        '        setAssistantStatus("ready");\n'
        '      })\n'
        '      .catch(() => {\n'
        '        if (!current) return;\n'
        '        setAssistants([]);\n'
        '        setSelectedAssistantId(null);\n'
        '        setAssistantStatus("error");\n'
        '      });\n'
        '    return () => {\n'
        '      current = false;\n'
        '    };\n'
        '  }, [authenticated]);\n',
        label="runtime load catalog",
    )
    source = replace_once(
        source,
        '        fetch: createProductAgUiFetch({\n'
        '          getAgentProfile: () => profileRef.current,\n',
        '        fetch: createProductAgUiFetch({\n'
        '          getAssistantId: () => selectedAssistantIdRef.current,\n'
        '          getAgentProfile: () => profileRef.current,\n',
        label="runtime fetch",
    )
    source = replace_once(
        source,
        '      <AssistantRuntimeProvider runtime={runtime}>\n'
        '        <GeneratedImageToolUI />\n'
        '        <WeatherToolUI />\n'
        '        <DeveloperActivityToolUIs />\n'
        '        {children}\n'
        '      </AssistantRuntimeProvider>\n',
        '      <AssistantSelectionProvider\n'
        '        value={{\n'
        '          status: assistantStatus,\n'
        '          assistants,\n'
        '          selectedAssistantId,\n'
        '          setSelectedAssistantId,\n'
        '        }}\n'
        '      >\n'
        '        <AssistantRuntimeProvider runtime={runtime}>\n'
        '          <GeneratedImageToolUI />\n'
        '          <WeatherToolUI />\n'
        '          <DeveloperActivityToolUIs />\n'
        '          {children}\n'
        '        </AssistantRuntimeProvider>\n'
        '      </AssistantSelectionProvider>\n',
        label="runtime provider",
    )
    write(path, source)


def patch_thread() -> None:
    path = "components/assistant-ui/thread.tsx"
    source = read(path)
    if 'assistant-selector"' in source:
        return
    source = replace_once(
        source,
        'import { AgentProfileSelector } from "@/components/assistant-ui/agent-profile-selector";\n',
        'import { AgentProfileSelector } from "@/components/assistant-ui/agent-profile-selector";\n'
        'import { AssistantSelector } from "@/components/assistant-ui/assistant-selector";\n',
        label="thread import",
    )
    source = replace_once(
        source,
        '        {authenticated && !compact ? (\n'
        '          <AgentProfileSelector control="developer" />\n'
        '        ) : null}\n',
        '        {authenticated ? <AssistantSelector compact={compact} /> : null}\n'
        '        {authenticated && !compact ? (\n'
        '          <AgentProfileSelector control="developer" />\n'
        '        ) : null}\n',
        label="thread selector",
    )
    write(path, source)


def patch_schema_version_references() -> None:
    replacements = {
        ".github/workflows/kolibri-v3.yml": [
            ("--expected-schema 44", "--expected-schema 45"),
        ],
        "kolibri-v3/deploy/home-ci/gate-inside-container.sh": [
            ("--expected-schema 44", "--expected-schema 45"),
        ],
        "kolibri-v3/deploy/portable/install.sh": [
            ("--expected-schema 44", "--expected-schema 45"),
        ],
        "kolibri-v3/backend/app/release_monitor.py": [
            ('default="44"', 'default="45"'),
            ("default=44", "default=45"),
        ],
        "kolibri-v3/deploy/portable/install-contract.py": [
            ('default="44"', 'default="45"'),
            ("default=44", "default=45"),
        ],
        "kolibri-v3/tests/portable-release.test.mjs": [
            ("--expected-schema', '44", "--expected-schema', '45"),
            ('--expected-schema", "44', '--expected-schema", "45'),
            ("expected_schema=44", "expected_schema=45"),
        ],
        "kolibri-v3/backend/tests/test_release_monitor.py": [
            ("expected_schema=44", "expected_schema=45"),
            ('"44"', '"45"'),
        ],
        "kolibri-v3/backend/tests/test_runtime_readiness.py": [
            ("user_version = 44", "user_version = 45"),
            ("schema_version == 44", "schema_version == 45"),
        ],
    }
    for relative, candidates in replacements.items():
        path = REPO / relative
        if not path.exists():
            continue
        source = path.read_text(encoding="utf-8")
        updated = source
        for old, new in candidates:
            if old in updated:
                updated = updated.replace(old, new)
        if updated != source:
            path.write_text(updated, encoding="utf-8")


def main() -> None:
    patch_models()
    patch_execution_adapter()
    patch_service()
    patch_agui_schema()
    patch_client()
    patch_runtime_provider()
    patch_thread()
    patch_schema_version_references()


if __name__ == "__main__":
    main()
