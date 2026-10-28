"""Pydantic schemas for API I/O."""
from typing import Any, Optional

from pydantic import BaseModel, Field


class ProfileIn(BaseModel):
    display_name: str = ""
    occupation: str = ""
    companies: str = ""
    goals_summary: str = ""
    comm_prefs: dict = Field(default_factory=dict)
    work_hours: dict = Field(default_factory=dict)
    budget_monthly: float = 0.0
    privacy_pref: str = "balanced"
    extra: dict = Field(default_factory=dict)


class GoalIn(BaseModel):
    title: str
    horizon: str = "mid"
    priority: int = 3
    project_id: Optional[int] = None


class ProjectIn(BaseModel):
    name: str
    description: str = ""
    status: str = "active"
    context: dict = Field(default_factory=dict)


class AgentProposalIn(BaseModel):
    description: str
    answers: dict = Field(default_factory=dict)


class AgentIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    role: Optional[str] = None
    specialty: Optional[str] = None
    instructions: Optional[str] = None
    objective: Optional[str] = None
    model: Optional[str] = None
    provider_id: Optional[int] = None
    autonomy: Optional[str] = None
    budget: Optional[float] = None
    priority: Optional[int] = None
    avatar: Optional[dict] = None
    voice: Optional[dict] = None
    memory_scope: Optional[list] = None
    tools: Optional[list] = None
    team_id: Optional[int] = None
    project_id: Optional[int] = None
    status: Optional[str] = None


class ProviderIn(BaseModel):
    name: str
    kind: str = "ollama"
    base_url: str = ""
    default_model: str = ""
    api_key: str = ""
    is_free: bool = True
    cost_per_1k_in: float = 0.0
    cost_per_1k_out: float = 0.0
    meta: dict = Field(default_factory=dict)


class PermissionIn(BaseModel):
    scope: str
    effect: str = "allow"
    constraints: dict = Field(default_factory=dict)
    requires_confirmation: bool = False


class ResolveAuthIn(BaseModel):
    decision: str  # approved|rejected|modified|postponed
    note: str = ""


class MemoryIn(BaseModel):
    category: str = "fact"
    kind: str = "fact"
    content: str
    source: str = ""
    tags: list = Field(default_factory=list)
    importance: int = 3
    verified: bool = False


class TaskIn(BaseModel):
    title: str
    description: str = ""
    agent_id: Optional[int] = None
    project_id: Optional[int] = None
    priority: int = 3
    depends_on: list = Field(default_factory=list)
    input: dict = Field(default_factory=dict)
    expected_output: dict = Field(default_factory=dict)


class ChatIn(BaseModel):
    text: str
    conversation_id: Optional[int] = None


class OnboardingIn(BaseModel):
    profile: ProfileIn = Field(default_factory=ProfileIn)
    ai_mode: str = "local"           # local|online|hybrid
    cost_pref: str = "free_first"    # free_first|paid|mixed
    priority_pref: str = "balanced"  # save_money|quality|privacy|speed|balanced
    provider_choice: str = "recommend"  # recommend|manual|mixed
    assistant_name: str = "Atlas"


class SimStepIn(BaseModel):
    title: str
    agent_name: Optional[str] = None
    depends_on: list = Field(default_factory=list)
    tools: list = Field(default_factory=list)


class SimulateIn(BaseModel):
    steps: list[SimStepIn]
    use_real_llm: bool = False


class OfficeConfigIn(BaseModel):
    scenario: Optional[str] = None
    layout: Optional[dict] = None
    lighting: Optional[dict] = None
    cycle: Optional[dict] = None
    placements: Optional[dict] = None
