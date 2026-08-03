"""Safe assistant manifests projected from execution-node capabilities."""

from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Any

from .agent_runtime import AgentRuntimeRegistry
from .machine_skills import ALLOWED_RUNTIME_PROFILES, MachineSkillManifest
from .terminal_agent_security import (
    HASH_PATTERN,
    IDENTIFIER_PATTERN,
    MIME_PATTERN,
    NODE_PATTERN,
    SCHEMA_PATTERN,
    TerminalAgentConfigurationError,
    bounded_text,
    sha256_bytes,
    sha256_json,
    strict_object,
    unique_text_list,
)


TERMINAL_AGENT_CATALOG_SCHEMA_VERSION = "1.0"
_ICON_PATTERN = re.compile(r"^[a-z][a-z0-9_-]{1,63}$")
_ALLOWED_ACCESS_POLICIES = frozenset({"standard", "auto", "full"})
_ALLOWED_CONCURRENCY_CLASSES = frozenset(
    {"interactive", "background", "exclusive"}
)
_ASSISTANT_FIELDS = frozenset(
    {
        "assistantId",
        "displayName",
        "description",
        "icon",
        "runtimeProfile",
        "requiredSkillIds",
        "optionalSkillIds",
        "capabilities",
        "supportedInputTypes",
        "supportedArtifactSchemas",
        "accessPolicy",
        "concurrencyClass",
        "version",
        "nodePool",
    }
)


@dataclass(frozen=True, slots=True)
class AssistantManifest:
    assistant_id: str
    display_name: str
    description: str
    icon: str
    runtime_profile: str
    required_skill_ids: tuple[str, ...]
    optional_skill_ids: tuple[str, ...]
    capabilities: tuple[str, ...]
    supported_input_types: tuple[str, ...]
    supported_artifact_schemas: tuple[str, ...]
    access_policy: str
    concurrency_class: str
    version: int
    node_pool: str
    manifest_hash: str

    def __post_init__(self) -> None:
        if IDENTIFIER_PATTERN.fullmatch(self.assistant_id) is None:
            raise TerminalAgentConfigurationError("assistant id is invalid")
        if not self.display_name or len(self.display_name) > 160:
            raise TerminalAgentConfigurationError(
                "assistant display name is invalid"
            )
        if not self.description or len(self.description) > 500:
            raise TerminalAgentConfigurationError(
                "assistant description is invalid"
            )
        if _ICON_PATTERN.fullmatch(self.icon) is None:
            raise TerminalAgentConfigurationError("assistant icon is invalid")
        if self.runtime_profile not in ALLOWED_RUNTIME_PROFILES:
            raise TerminalAgentConfigurationError(
                "assistant runtime profile is invalid"
            )
        if set(self.required_skill_ids) & set(self.optional_skill_ids):
            raise TerminalAgentConfigurationError(
                "assistant skill selection overlaps"
            )
        if self.access_policy not in _ALLOWED_ACCESS_POLICIES:
            raise TerminalAgentConfigurationError(
                "assistant access policy is invalid"
            )
        if self.concurrency_class not in _ALLOWED_CONCURRENCY_CLASSES:
            raise TerminalAgentConfigurationError(
                "assistant concurrency class is invalid"
            )
        if not 1 <= self.version <= 2_147_483_647:
            raise TerminalAgentConfigurationError("assistant version is invalid")
        if IDENTIFIER_PATTERN.fullmatch(self.node_pool) is None:
            raise TerminalAgentConfigurationError(
                "assistant node pool is invalid"
            )
        if HASH_PATTERN.fullmatch(self.manifest_hash) is None:
            raise TerminalAgentConfigurationError("assistant hash is invalid")

    def public_view(
        self,
        *,
        node_id: str,
        availability: str,
        unavailable_reason: str | None,
    ) -> dict[str, Any]:
        return {
            "schemaId": "kolibri.assistant_manifest",
            "schemaVersion": TERMINAL_AGENT_CATALOG_SCHEMA_VERSION,
            "assistantId": self.assistant_id,
            "displayName": self.display_name,
            "description": self.description,
            "icon": self.icon,
            "runtimeProfile": self.runtime_profile,
            "requiredSkillIds": list(self.required_skill_ids),
            "optionalSkillIds": list(self.optional_skill_ids),
            "capabilities": list(self.capabilities),
            "supportedInputTypes": list(self.supported_input_types),
            "supportedArtifactSchemas": list(
                self.supported_artifact_schemas
            ),
            "accessPolicy": self.access_policy,
            "concurrencyClass": self.concurrency_class,
            "version": self.version,
            "manifestHash": self.manifest_hash,
            "availability": availability,
            "unavailableReason": unavailable_reason,
            "nodePool": self.node_pool,
            "nodeId": node_id,
        }


@dataclass(frozen=True, slots=True)
class TerminalAgentCatalog:
    node_id: str
    configuration_hash: str
    skills: tuple[MachineSkillManifest, ...]
    assistants: tuple[AssistantManifest, ...]

    def __post_init__(self) -> None:
        if NODE_PATTERN.fullmatch(self.node_id) is None:
            raise TerminalAgentConfigurationError("terminal node id is invalid")
        if HASH_PATTERN.fullmatch(self.configuration_hash) is None:
            raise TerminalAgentConfigurationError(
                "terminal node configuration hash is invalid"
            )
        skill_ids = [skill.skill_id for skill in self.skills]
        assistant_ids = [assistant.assistant_id for assistant in self.assistants]
        if len(skill_ids) != len(set(skill_ids)):
            raise TerminalAgentConfigurationError("machine skill ids conflict")
        if len(assistant_ids) != len(set(assistant_ids)):
            raise TerminalAgentConfigurationError("assistant ids conflict")

    @classmethod
    def empty(cls) -> "TerminalAgentCatalog":
        return cls(
            node_id="node_unconfigured",
            configuration_hash=sha256_bytes(b"unconfigured"),
            skills=(),
            assistants=(),
        )

    def skill_ids_for_runtime(self, runtime_profile: str) -> tuple[str, ...]:
        return tuple(
            skill.skill_id
            for skill in self.skills
            if runtime_profile in skill.runtime_profiles
        )

    def skill_manifest_hash_for_runtime(self, runtime_profile: str) -> str:
        return sha256_json(
            [
                {
                    "skillId": skill.skill_id,
                    "version": skill.version,
                    "contentHash": skill.content_hash,
                }
                for skill in self.skills
                if runtime_profile in skill.runtime_profiles
            ]
        )

    def public_view(self, registry: AgentRuntimeRegistry) -> dict[str, Any]:
        registered = {
            descriptor.profile_id for descriptor in registry.descriptors()
        }
        start_errors = registry.start_errors()
        skill_ids_by_profile = {
            profile: set(self.skill_ids_for_runtime(profile))
            for profile in ALLOWED_RUNTIME_PROFILES
        }
        assistants: list[dict[str, Any]] = []
        for assistant in self.assistants:
            missing = sorted(
                set(assistant.required_skill_ids)
                - skill_ids_by_profile[assistant.runtime_profile]
            )
            if assistant.runtime_profile not in registered:
                availability = "offline"
                reason = "runtime_not_registered"
            elif assistant.runtime_profile in start_errors:
                availability = "offline"
                reason = "runtime_start_failed"
            elif missing:
                availability = "offline"
                reason = "required_skill_missing"
            else:
                availability = "available"
                reason = None
            assistants.append(
                assistant.public_view(
                    node_id=self.node_id,
                    availability=availability,
                    unavailable_reason=reason,
                )
            )
        return {
            "schemaId": "kolibri.terminal_agent_catalog",
            "schemaVersion": TERMINAL_AGENT_CATALOG_SCHEMA_VERSION,
            "nodeId": self.node_id,
            "configurationHash": self.configuration_hash,
            "skills": [skill.public_view() for skill in self.skills],
            "assistants": assistants,
        }


def parse_assistants(
    value: object,
    *,
    skills: tuple[MachineSkillManifest, ...],
) -> tuple[AssistantManifest, ...]:
    if not isinstance(value, list) or len(value) > 64:
        raise TerminalAgentConfigurationError("assistants is invalid")
    available_by_profile = {
        profile: {
            skill.skill_id
            for skill in skills
            if profile in skill.runtime_profiles
        }
        for profile in ALLOWED_RUNTIME_PROFILES
    }
    assistants: list[AssistantManifest] = []
    seen: set[str] = set()
    for raw in value:
        item = strict_object(
            raw,
            fields=_ASSISTANT_FIELDS,
            required=_ASSISTANT_FIELDS,
            name="assistant",
        )
        assistant_id = bounded_text(
            item["assistantId"], name="assistant id", maximum=128
        )
        if (
            IDENTIFIER_PATTERN.fullmatch(assistant_id) is None
            or assistant_id in seen
        ):
            raise TerminalAgentConfigurationError("assistant id is invalid")
        runtime_profile = bounded_text(
            item["runtimeProfile"],
            name="assistant runtime profile",
            maximum=96,
        )
        if runtime_profile not in ALLOWED_RUNTIME_PROFILES:
            raise TerminalAgentConfigurationError(
                "assistant runtime profile is unsupported"
            )
        required = unique_text_list(
            item["requiredSkillIds"],
            name="assistant required skills",
            pattern=IDENTIFIER_PATTERN,
            maximum=64,
        )
        optional = unique_text_list(
            item["optionalSkillIds"],
            name="assistant optional skills",
            pattern=IDENTIFIER_PATTERN,
            maximum=64,
        )
        available = available_by_profile[runtime_profile]
        if set(required) - available:
            raise TerminalAgentConfigurationError(
                "assistant requires an unavailable machine skill"
            )
        capabilities = unique_text_list(
            item["capabilities"],
            name="assistant capabilities",
            pattern=IDENTIFIER_PATTERN,
            minimum=1,
            maximum=64,
        )
        input_types = unique_text_list(
            item["supportedInputTypes"],
            name="assistant input types",
            pattern=MIME_PATTERN,
            minimum=1,
            maximum=32,
        )
        artifact_schemas = unique_text_list(
            item["supportedArtifactSchemas"],
            name="assistant artifact schemas",
            pattern=SCHEMA_PATTERN,
            maximum=64,
        )
        version = item["version"]
        if isinstance(version, bool) or not isinstance(version, int):
            raise TerminalAgentConfigurationError("assistant version is invalid")
        manifest = AssistantManifest(
            assistant_id=assistant_id,
            display_name=bounded_text(
                item["displayName"],
                name="assistant display name",
                maximum=160,
            ),
            description=bounded_text(
                item["description"],
                name="assistant description",
                maximum=500,
            ),
            icon=bounded_text(
                item["icon"], name="assistant icon", maximum=64
            ),
            runtime_profile=runtime_profile,
            required_skill_ids=required,
            optional_skill_ids=optional,
            capabilities=capabilities,
            supported_input_types=input_types,
            supported_artifact_schemas=artifact_schemas,
            access_policy=bounded_text(
                item["accessPolicy"],
                name="assistant access policy",
                maximum=32,
            ),
            concurrency_class=bounded_text(
                item["concurrencyClass"],
                name="assistant concurrency class",
                maximum=32,
            ),
            version=version,
            node_pool=bounded_text(
                item["nodePool"], name="assistant node pool", maximum=128
            ),
            manifest_hash=sha256_json(
                {key: item[key] for key in sorted(_ASSISTANT_FIELDS)}
            ),
        )
        seen.add(assistant_id)
        assistants.append(manifest)
    return tuple(sorted(assistants, key=lambda item: item.assistant_id))
