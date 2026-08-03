"""Authenticated public projection of configured terminal assistants."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request, Response

from .agent_runtime import AgentRuntimeRegistry
from .assistant_catalog import TerminalAgentCatalog
from .identity import require_user
from .schemas import UserSession
from .terminal_agent_registry import TERMINAL_AGENT_CATALOG_CAPABILITY_ID


router = APIRouter(prefix="/v1/assistants", tags=["assistants"])
IdentityDependency = Annotated[UserSession, Depends(require_user)]


@router.get("")
def list_assistants(
    request: Request,
    response: Response,
    _identity: IdentityDependency,
) -> dict[str, Any]:
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    response.headers["X-Content-Type-Options"] = "nosniff"
    registry = getattr(request.app.state, "agent_runtime_registry", None)
    if not isinstance(registry, AgentRuntimeRegistry):
        return TerminalAgentCatalog.empty().public_view(AgentRuntimeRegistry())
    catalog = registry.capability(TERMINAL_AGENT_CATALOG_CAPABILITY_ID)
    if not isinstance(catalog, TerminalAgentCatalog):
        catalog = TerminalAgentCatalog.empty()
    return catalog.public_view(registry)
