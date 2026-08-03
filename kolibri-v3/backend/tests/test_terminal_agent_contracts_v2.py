from __future__ import annotations

import json
from pathlib import Path

import pytest


CONTRACT_ROOT = (
    Path(__file__).resolve().parents[2] / "contracts" / "v1" / "product"
)


def _load(name: str) -> dict[str, object]:
    return json.loads((CONTRACT_ROOT / name).read_text(encoding="utf-8"))


def test_run_request_v2_is_fail_closed_and_authority_owned() -> None:
    schema = _load("run-request-v2.schema.json")
    assert schema["additionalProperties"] is False
    required = set(schema["required"])
    assert {
        "tenant_id",
        "user_id",
        "assistant_binding",
        "access_policy",
        "idempotency_key",
        "authority",
    } <= required
    properties = schema["properties"]
    assert "workspace_root" not in properties
    assert "skill_path" not in properties
    assert "provider_credentials" not in properties
    assistant_binding = properties["assistant_binding"]
    assert assistant_binding["additionalProperties"] is False
    assert {
        "assistant_manifest_hash",
        "runtime_profile",
        "node_id",
        "selected_skills",
        "skill_manifest_hash",
        "assignment_hash",
    } <= set(assistant_binding["required"])
    authority = properties["authority"]
    assert authority["properties"]["issuer"]["const"] == (
        "logical_home_control_plane"
    )
    assert authority["properties"]["signature"]["pattern"].startswith(
        "^hmac-sha256:"
    )


def test_public_run_event_v2_contains_only_public_event_types() -> None:
    schema = _load("public-run-event-v2.schema.json")
    event_types = set(schema["properties"]["type"]["enum"])
    assert event_types == {
        "RUN_ACCEPTED",
        "RUN_STARTED",
        "STATUS_CHANGED",
        "PUBLIC_PROGRESS",
        "TEXT_MESSAGE_START",
        "TEXT_MESSAGE_CONTENT",
        "TEXT_MESSAGE_END",
        "ACTIVITY_STARTED",
        "ACTIVITY_COMPLETED",
        "APPROVAL_REQUIRED",
        "ARTIFACT_CREATED",
        "ARTIFACT_UPDATED",
        "RUN_FINISHED",
        "RUN_ERROR",
        "RUN_CANCELLED",
    }
    forbidden = {"CHAIN_OF_THOUGHT", "RAW_STDERR", "SYSTEM_PROMPT"}
    assert not (event_types & forbidden)


def test_artifact_envelope_uses_immutable_refs_and_provenance() -> None:
    schema = _load("artifact-envelope-v1.schema.json")
    required = set(schema["required"])
    assert {
        "artifact_id",
        "document_id",
        "content_ref",
        "content_hash",
        "node_id",
        "runtime_profile",
        "assistant_id",
        "skills",
        "source_references",
        "validation_results",
    } <= required
    definitions = schema["definitions"]
    assert definitions["immutable_ref"]["pattern"].startswith("^artifact://")
    assert schema["properties"]["content_ref"] == {
        "$ref": "#/definitions/immutable_ref"
    }
    assert "content" not in schema["properties"]
    assert "absolute_path" not in schema["properties"]


@pytest.mark.parametrize(
    "name, schema_id, version",
    [
        ("run-request-v2.schema.json", "kolibri.run_request", "2.0"),
        (
            "public-run-event-v2.schema.json",
            "kolibri.public_run_event",
            "2.0",
        ),
        (
            "artifact-envelope-v1.schema.json",
            "kolibri.artifact_envelope",
            "1.0",
        ),
    ],
)
def test_contract_identity_is_versioned(
    name: str,
    schema_id: str,
    version: str,
) -> None:
    schema = _load(name)
    properties = schema["properties"]
    assert properties["schema_id"]["const"] == schema_id
    assert properties["schema_version"]["const"] == version
