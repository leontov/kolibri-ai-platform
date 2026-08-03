PRAGMA foreign_keys = ON;

BEGIN IMMEDIATE;

CREATE TABLE chat_run_assistant_bindings (
    tenant_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    assistant_id TEXT NOT NULL
        CHECK (
            length(assistant_id) BETWEEN 3 AND 128
            AND assistant_id GLOB '[a-z]*'
            AND assistant_id NOT GLOB '*[^a-z0-9_.:-]*'
        ),
    assistant_version INTEGER NOT NULL CHECK (assistant_version >= 1),
    manifest_hash TEXT NOT NULL
        CHECK (
            length(manifest_hash) = 71
            AND manifest_hash GLOB 'sha256:[0-9a-f]*'
            AND substr(manifest_hash, 8) NOT GLOB '*[^0-9a-f]*'
        ),
    runtime_profile TEXT NOT NULL
        CHECK (
            length(runtime_profile) BETWEEN 2 AND 96
            AND runtime_profile NOT GLOB '*[^a-z0-9._-]*'
        ),
    node_id TEXT NOT NULL
        CHECK (
            length(node_id) BETWEEN 1 AND 200
            AND node_id NOT GLOB '*[^A-Za-z0-9._:@/-]*'
        ),
    node_pool TEXT NOT NULL
        CHECK (
            length(node_pool) BETWEEN 3 AND 128
            AND node_pool GLOB '[a-z]*'
            AND node_pool NOT GLOB '*[^a-z0-9_.:-]*'
        ),
    required_skill_ids_json TEXT NOT NULL
        CHECK (json_valid(required_skill_ids_json)),
    optional_skill_ids_json TEXT NOT NULL
        CHECK (json_valid(optional_skill_ids_json)),
    skill_manifest_hash TEXT NOT NULL
        CHECK (
            length(skill_manifest_hash) = 71
            AND skill_manifest_hash GLOB 'sha256:[0-9a-f]*'
            AND substr(skill_manifest_hash, 8) NOT GLOB '*[^0-9a-f]*'
        ),
    created_at TEXT NOT NULL,
    PRIMARY KEY (tenant_id, run_id),
    FOREIGN KEY (tenant_id, run_id)
        REFERENCES chat_runs (tenant_id, id)
        ON DELETE CASCADE
) STRICT;

CREATE INDEX ix_chat_run_assistant_bindings_assistant
    ON chat_run_assistant_bindings (
        tenant_id,
        assistant_id,
        assistant_version,
        created_at
    );

PRAGMA user_version = 45;

COMMIT;
