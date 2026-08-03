"""Discover allowlisted machine skills without exporting their instructions."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import os
from pathlib import Path
import stat
from types import MappingProxyType
from typing import Any, Iterable, Mapping

from .terminal_agent_security import (
    HASH_PATTERN,
    IDENTIFIER_PATTERN,
    PROFILE_PATTERN,
    TerminalAgentConfigurationError,
    bounded_text,
    secure_directory,
    secure_file_bytes,
    strict_object,
    unique_text_list,
)


ALLOWED_RUNTIME_PROFILES = frozenset({"codex-cli", "mimo-code"})
_SKILL_ROOT_FIELDS = frozenset({"id", "path", "runtimeProfiles"})
_SKILL_FILE_MAX_BYTES = 2 * 1024 * 1024
_SKILL_PACKAGE_MAX_BYTES = 16 * 1024 * 1024
_SKILL_PACKAGE_MAX_FILES = 512
_SKILL_ROOT_MAX_RESULTS = 256


@dataclass(frozen=True, slots=True)
class SkillRoot:
    root_id: str
    path: Path
    runtime_profiles: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class MachineSkillManifest:
    skill_id: str
    display_name: str
    description: str
    version: str
    content_hash: str
    runtime_profiles: tuple[str, ...]
    root_id: str

    def __post_init__(self) -> None:
        if IDENTIFIER_PATTERN.fullmatch(self.skill_id) is None:
            raise TerminalAgentConfigurationError("machine skill id is invalid")
        if not self.display_name or len(self.display_name) > 160:
            raise TerminalAgentConfigurationError(
                "machine skill display name is invalid"
            )
        if len(self.description) > 500:
            raise TerminalAgentConfigurationError(
                "machine skill description is invalid"
            )
        if not self.version or len(self.version) > 96:
            raise TerminalAgentConfigurationError(
                "machine skill version is invalid"
            )
        if HASH_PATTERN.fullmatch(self.content_hash) is None:
            raise TerminalAgentConfigurationError(
                "machine skill hash is invalid"
            )
        if (
            not self.runtime_profiles
            or any(
                profile not in ALLOWED_RUNTIME_PROFILES
                for profile in self.runtime_profiles
            )
        ):
            raise TerminalAgentConfigurationError(
                "machine skill runtime profile is invalid"
            )
        if IDENTIFIER_PATTERN.fullmatch(self.root_id) is None:
            raise TerminalAgentConfigurationError(
                "machine skill root id is invalid"
            )

    def public_view(self) -> dict[str, Any]:
        return {
            "skillId": self.skill_id,
            "displayName": self.display_name,
            "description": self.description,
            "version": self.version,
            "contentHash": self.content_hash,
            "runtimeProfiles": list(self.runtime_profiles),
        }


def parse_skill_roots(value: object) -> tuple[SkillRoot, ...]:
    if not isinstance(value, list) or len(value) > 32:
        raise TerminalAgentConfigurationError("skillRoots is invalid")
    roots: list[SkillRoot] = []
    seen: set[str] = set()
    for raw in value:
        item = strict_object(
            raw,
            fields=_SKILL_ROOT_FIELDS,
            required=_SKILL_ROOT_FIELDS,
            name="skill root",
        )
        root_id = bounded_text(item["id"], name="skill root id", maximum=128)
        if IDENTIFIER_PATTERN.fullmatch(root_id) is None or root_id in seen:
            raise TerminalAgentConfigurationError("skill root id is invalid")
        profiles = unique_text_list(
            item["runtimeProfiles"],
            name="skill runtime profiles",
            pattern=PROFILE_PATTERN,
            minimum=1,
            maximum=len(ALLOWED_RUNTIME_PROFILES),
        )
        if any(profile not in ALLOWED_RUNTIME_PROFILES for profile in profiles):
            raise TerminalAgentConfigurationError(
                "skill runtime profile is unsupported"
            )
        root_path = Path(
            bounded_text(item["path"], name="skill root path", maximum=4096)
        )
        roots.append(
            SkillRoot(
                root_id=root_id,
                path=secure_directory(root_path),
                runtime_profiles=profiles,
            )
        )
        seen.add(root_id)
    return tuple(roots)


def _parse_frontmatter(skill_markdown: bytes) -> Mapping[str, str]:
    try:
        text = skill_markdown.decode("utf-8", "strict")
    except UnicodeDecodeError as exc:
        raise TerminalAgentConfigurationError("SKILL.md is not UTF-8") from exc
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return MappingProxyType({})
    values: dict[str, str] = {}
    for line in lines[1:101]:
        if line.strip() == "---":
            return MappingProxyType(values)
        if not line.strip() or line.lstrip().startswith("#") or ":" not in line:
            continue
        key, raw = line.split(":", 1)
        key = key.strip().casefold()
        if key not in {"name", "description", "version"}:
            continue
        value = raw.strip().strip('"\'')
        if value:
            values[key] = value
    return MappingProxyType({})


def _skill_package_hash(skill_dir: Path) -> str:
    files: list[Path] = []
    total = 0
    for candidate in sorted(skill_dir.rglob("*")):
        if len(files) >= _SKILL_PACKAGE_MAX_FILES:
            raise TerminalAgentConfigurationError(
                "machine skill has too many files"
            )
        try:
            metadata = os.lstat(candidate)
        except OSError as exc:
            raise TerminalAgentConfigurationError(
                "machine skill changed during discovery"
            ) from exc
        if stat.S_ISLNK(metadata.st_mode):
            raise TerminalAgentConfigurationError(
                "machine skill contains a symlink"
            )
        if stat.S_ISDIR(metadata.st_mode):
            continue
        if (
            not stat.S_ISREG(metadata.st_mode)
            or metadata.st_size > _SKILL_FILE_MAX_BYTES
        ):
            raise TerminalAgentConfigurationError(
                "machine skill file is unsafe"
            )
        total += metadata.st_size
        if total > _SKILL_PACKAGE_MAX_BYTES:
            raise TerminalAgentConfigurationError("machine skill is too large")
        files.append(candidate)

    digest = hashlib.sha256()
    for candidate in files:
        relative = candidate.relative_to(skill_dir).as_posix().encode("utf-8")
        payload = secure_file_bytes(
            candidate,
            maximum_bytes=_SKILL_FILE_MAX_BYTES,
            secret=False,
        )
        digest.update(len(relative).to_bytes(4, "big"))
        digest.update(relative)
        digest.update(len(payload).to_bytes(8, "big"))
        digest.update(payload)
    return "sha256:" + digest.hexdigest()


def _discover_skill(root: SkillRoot, skill_dir: Path) -> MachineSkillManifest:
    skill_payload = secure_file_bytes(
        skill_dir / "SKILL.md",
        maximum_bytes=_SKILL_FILE_MAX_BYTES,
        secret=False,
    )
    metadata = _parse_frontmatter(skill_payload)
    skill_id = metadata.get("name", skill_dir.name).strip().casefold()
    if IDENTIFIER_PATTERN.fullmatch(skill_id) is None:
        raise TerminalAgentConfigurationError("machine skill name is invalid")
    content_hash = _skill_package_hash(skill_dir)
    version = bounded_text(
        metadata.get("version", f"sha256-{content_hash[7:19]}"),
        name="machine skill version",
        maximum=96,
    )
    display_name = bounded_text(
        metadata.get("name", skill_id),
        name="machine skill name",
        maximum=160,
    )
    description = metadata.get("description", "").strip()
    if len(description) > 500 or "\x00" in description:
        raise TerminalAgentConfigurationError(
            "machine skill description is invalid"
        )
    return MachineSkillManifest(
        skill_id=skill_id,
        display_name=display_name,
        description=description,
        version=version,
        content_hash=content_hash,
        runtime_profiles=root.runtime_profiles,
        root_id=root.root_id,
    )


def discover_machine_skills(
    roots: Iterable[SkillRoot],
) -> tuple[MachineSkillManifest, ...]:
    discovered: dict[str, MachineSkillManifest] = {}
    for root in roots:
        count = 0
        for skill_file in sorted(root.path.rglob("SKILL.md")):
            count += 1
            if count > _SKILL_ROOT_MAX_RESULTS:
                raise TerminalAgentConfigurationError(
                    "skill root contains too many skills"
                )
            skill_dir = skill_file.parent.resolve(strict=True)
            try:
                skill_dir.relative_to(root.path)
            except ValueError as exc:
                raise TerminalAgentConfigurationError(
                    "machine skill escaped its root"
                ) from exc
            manifest = _discover_skill(root, skill_dir)
            previous = discovered.get(manifest.skill_id)
            if previous is None:
                discovered[manifest.skill_id] = manifest
                continue
            if (
                previous.content_hash != manifest.content_hash
                or previous.version != manifest.version
            ):
                raise TerminalAgentConfigurationError(
                    "machine skill id resolves to different content"
                )
            discovered[manifest.skill_id] = MachineSkillManifest(
                skill_id=previous.skill_id,
                display_name=previous.display_name,
                description=previous.description,
                version=previous.version,
                content_hash=previous.content_hash,
                runtime_profiles=tuple(
                    sorted(
                        set(previous.runtime_profiles)
                        | set(manifest.runtime_profiles)
                    )
                ),
                root_id=previous.root_id,
            )
    return tuple(discovered[key] for key in sorted(discovered))
