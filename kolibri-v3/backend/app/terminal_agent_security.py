"""Fail-closed helpers for execution-node configuration files."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import stat
from typing import Any
from urllib.parse import urlsplit


class TerminalAgentConfigurationError(ValueError):
    """A public-safe node configuration error without secret material."""


HASH_PATTERN = re.compile(r"^sha256:[0-9a-f]{64}$")
IDENTIFIER_PATTERN = re.compile(r"^[a-z][a-z0-9_.:-]{2,127}$")
PROFILE_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]{1,95}$")
NODE_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$")
MIME_PATTERN = re.compile(
    r"^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}/"
    r"[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$"
)
SCHEMA_PATTERN = re.compile(r"^kolibri\.[a-z][a-z0-9_.]{1,126}$")


def sha256_bytes(value: bytes) -> str:
    return "sha256:" + hashlib.sha256(value).hexdigest()


def canonical_json(value: object) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    )


def sha256_json(value: object) -> str:
    return sha256_bytes(canonical_json(value).encode("utf-8", "strict"))


def strict_object(
    value: object,
    *,
    fields: frozenset[str],
    required: frozenset[str] | None = None,
    name: str,
) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise TerminalAgentConfigurationError(f"{name} must be an object")
    if set(value) - fields:
        raise TerminalAgentConfigurationError(f"{name} has unknown fields")
    if required is not None and not required.issubset(value):
        raise TerminalAgentConfigurationError(f"{name} is incomplete")
    return value


def bounded_text(
    value: object,
    *,
    name: str,
    minimum: int = 1,
    maximum: int = 500,
) -> str:
    if not isinstance(value, str):
        raise TerminalAgentConfigurationError(f"{name} must be text")
    normalized = value.strip()
    if (
        not minimum <= len(normalized) <= maximum
        or "\x00" in normalized
        or any(
            ord(character) < 32 and character not in "\t\n"
            for character in normalized
        )
    ):
        raise TerminalAgentConfigurationError(f"{name} is invalid")
    return normalized


def unique_text_list(
    value: object,
    *,
    name: str,
    pattern: re.Pattern[str],
    minimum: int = 0,
    maximum: int = 128,
) -> tuple[str, ...]:
    if not isinstance(value, list) or not minimum <= len(value) <= maximum:
        raise TerminalAgentConfigurationError(f"{name} is invalid")
    normalized = tuple(
        bounded_text(item, name=name, maximum=160) for item in value
    )
    if len(normalized) != len(set(normalized)) or any(
        pattern.fullmatch(item) is None for item in normalized
    ):
        raise TerminalAgentConfigurationError(f"{name} is invalid")
    return normalized


def secure_file_bytes(
    path: Path,
    *,
    maximum_bytes: int,
    secret: bool,
) -> bytes:
    if not path.is_absolute():
        raise TerminalAgentConfigurationError(
            "configured file path must be absolute"
        )
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
    try:
        descriptor = os.open(path, flags)
    except OSError as exc:
        raise TerminalAgentConfigurationError(
            "configured file is unavailable"
        ) from exc
    try:
        metadata = os.fstat(descriptor)
        unsafe_mode = 0o077 if secret else 0o022
        if (
            not stat.S_ISREG(metadata.st_mode)
            or metadata.st_nlink != 1
            or metadata.st_uid not in {0, os.geteuid()}
            or metadata.st_size <= 0
            or metadata.st_size > maximum_bytes
            or metadata.st_mode & unsafe_mode
        ):
            raise TerminalAgentConfigurationError("configured file is unsafe")
        payload = os.read(descriptor, maximum_bytes + 1)
    finally:
        os.close(descriptor)
    if not payload or len(payload) > maximum_bytes:
        raise TerminalAgentConfigurationError("configured file is invalid")
    return payload


def secure_directory(path: Path) -> Path:
    if not path.is_absolute():
        raise TerminalAgentConfigurationError("skill root must be absolute")
    try:
        metadata = os.lstat(path)
        resolved = path.resolve(strict=True)
    except OSError as exc:
        raise TerminalAgentConfigurationError("skill root is unavailable") from exc
    if (
        not stat.S_ISDIR(metadata.st_mode)
        or stat.S_ISLNK(metadata.st_mode)
        or metadata.st_uid not in {0, os.geteuid()}
        or metadata.st_mode & 0o022
        or resolved != path
    ):
        raise TerminalAgentConfigurationError("skill root is unsafe")
    return resolved


def validate_loopback_url(value: object) -> str:
    raw = bounded_text(value, name="MiMo attached URL", maximum=256)
    try:
        parsed = urlsplit(raw)
        port = parsed.port
    except ValueError as exc:
        raise TerminalAgentConfigurationError(
            "MiMo attached URL is invalid"
        ) from exc
    if (
        parsed.scheme != "http"
        or parsed.hostname != "127.0.0.1"
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path
        or parsed.query
        or parsed.fragment
        or port is None
        or not 1 <= port <= 65_535
        or parsed.netloc != f"127.0.0.1:{port}"
    ):
        raise TerminalAgentConfigurationError("MiMo attached URL is invalid")
    return raw
