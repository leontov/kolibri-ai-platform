"""Provider Execution service that binds AgentCards to machine-skill hashes."""

from __future__ import annotations

import hashlib
from typing import Any

from .assistant_catalog import TerminalAgentCatalog
from .provider_execution import ProviderExecutionService, _contract
from .terminal_agent_registry import TERMINAL_AGENT_CATALOG_CAPABILITY_ID
from .terminal_agent_security import canonical_json


class TerminalProviderExecutionService(ProviderExecutionService):
    """Add only safe skill identifiers and hashes to the existing AgentCard."""

    def _agent_card(self, runtime_profile: str) -> dict[str, Any]:
        card = dict(super()._agent_card(runtime_profile))
        catalog = self.runtime_registry.capability(
            TERMINAL_AGENT_CATALOG_CAPABILITY_ID
        )
        if not isinstance(catalog, TerminalAgentCatalog):
            return card
        skills = catalog.skill_ids_for_runtime(runtime_profile)
        if not skills:
            return card

        manifest_hash = catalog.skill_manifest_hash_for_runtime(runtime_profile)
        identity_digest = hashlib.sha256(
            canonical_json(
                {
                    "baseAgentCardId": card["agent_card_id"],
                    "runtimeProfile": runtime_profile,
                    "skillManifestHash": manifest_hash,
                }
            ).encode("utf-8", "strict")
        ).hexdigest()
        card["agent_card_id"] = f"agentcard_{identity_digest[:40]}"
        card["skills"] = list(skills)
        constraints = set(card["policy_constraints"])
        constraints.add(f"skill.catalog.sha256:{manifest_hash[7:]}")
        card["policy_constraints"] = sorted(constraints)
        return _contract(card, "kolibri.agent_card")
