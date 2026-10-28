"""SQLAlchemy models. One table per domain entity; JSON columns keep flexible payloads."""
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, JSON,
)
from sqlalchemy.orm import relationship

from .database import Base


def now():
    return datetime.utcnow()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)
    created_at = Column(DateTime, default=now)


class UserProfile(Base):
    __tablename__ = "user_profiles"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    display_name = Column(String(120), default="")
    occupation = Column(String(200), default="")
    companies = Column(Text, default="")
    goals_summary = Column(Text, default="")
    comm_prefs = Column(JSON, default=dict)
    work_hours = Column(JSON, default=dict)
    budget_monthly = Column(Float, default=0.0)
    privacy_pref = Column(String(40), default="balanced")  # local_first|balanced|cloud_ok
    extra = Column(JSON, default=dict)
    updated_at = Column(DateTime, default=now, onupdate=now)


class Goal(Base):
    __tablename__ = "goals"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String(300), nullable=False)
    horizon = Column(String(20), default="mid")  # short|mid|long
    priority = Column(Integer, default=3)
    status = Column(String(20), default="active")  # active|done|archived
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)


class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    status = Column(String(20), default="active")  # active|paused|done|archived
    context = Column(JSON, default=dict)
    created_at = Column(DateTime, default=now)


class Team(Base):
    __tablename__ = "teams"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)


class Agent(Base):
    __tablename__ = "agents"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String(120), nullable=False)
    description = Column(Text, default="")
    role = Column(String(120), default="")
    specialty = Column(String(120), default="")
    instructions = Column(Text, default="")
    objective = Column(Text, default="")
    is_ceo = Column(Boolean, default=False)
    status = Column(String(30), default="pending_config")
    # active|paused|pending_config|archived
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    supervisor_id = Column(Integer, ForeignKey("agents.id"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    provider_id = Column(Integer, ForeignKey("providers.id"), nullable=True)
    model = Column(String(120), default="")
    autonomy = Column(String(30), default="ask_first")  # ask_first|balanced|autonomous
    budget = Column(Float, default=0.0)  # 0 = use global budget
    spent = Column(Float, default=0.0)
    priority = Column(Integer, default=3)
    avatar = Column(JSON, default=dict)  # style,color,outfit,accessories,idle_anim
    voice = Column(JSON, default=dict)   # enabled,voice_name,lang,rate,pitch
    memory_scope = Column(JSON, default=list)  # categories the agent may read
    tools = Column(JSON, default=list)   # tool names enabled for this agent
    constraints = Column(JSON, default=dict)  # start/finish conditions, retry policy
    config_pending_reason = Column(String(300), default="")
    created_at = Column(DateTime, default=now)
    updated_at = Column(DateTime, default=now, onupdate=now)


class Provider(Base):
    __tablename__ = "providers"
    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)
    kind = Column(String(40), nullable=False)  # ollama|openai_compat
    base_url = Column(String(400), default="")
    default_model = Column(String(120), default="")
    secret_name = Column(String(120), default="")  # reference into secrets table
    enabled = Column(Boolean, default=True)
    is_free = Column(Boolean, default=True)
    cost_per_1k_in = Column(Float, default=0.0)
    cost_per_1k_out = Column(Float, default=0.0)
    last_test_at = Column(DateTime, nullable=True)
    last_test_ok = Column(Boolean, default=False)
    last_test_detail = Column(String(400), default="")
    meta = Column(JSON, default=dict)
    created_at = Column(DateTime, default=now)


class Secret(Base):
    __tablename__ = "secrets"
    id = Column(Integer, primary_key=True)
    name = Column(String(120), unique=True, nullable=False)
    value_enc = Column(Text, nullable=False)
    created_at = Column(DateTime, default=now)


class Permission(Base):
    __tablename__ = "permissions"
    id = Column(Integer, primary_key=True)
    agent_id = Column(Integer, ForeignKey("agents.id"))
    scope = Column(String(80), nullable=False)
    # file_read|file_write|memory_read|memory_write|doc_index|doc_search|
    # external_http|send_message|publish|purchase|delegate|grant_permissions|
    # create_agent|exec_code|external_share
    effect = Column(String(10), default="allow")  # allow|deny
    constraints = Column(JSON, default=dict)  # paths/domains/categories/limits
    requires_confirmation = Column(Boolean, default=False)


class AuthorizationRequest(Base):
    __tablename__ = "authorization_requests"
    id = Column(Integer, primary_key=True)
    agent_id = Column(Integer, ForeignKey("agents.id"))
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    action_type = Column(String(80), nullable=False)
    reason = Column(Text, default="")
    resources = Column(JSON, default=dict)
    payload = Column(JSON, default=dict)  # frozen action to run if approved
    cost_estimate = Column(Float, nullable=True)
    risk = Column(String(20), default="medium")  # low|medium|high
    status = Column(String(20), default="pending")
    # pending|approved|rejected|modified|postponed|expired
    resolution_note = Column(Text, default="")
    created_at = Column(DateTime, default=now)
    resolved_at = Column(DateTime, nullable=True)


class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    parent_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    title = Column(String(300), nullable=False)
    description = Column(Text, default="")
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=True)
    status = Column(String(30), default="pending")
    # pending|planned|running|awaiting_authorization|blocked|verifying|
    # completed|failed|cancelled
    priority = Column(Integer, default=3)
    depends_on = Column(JSON, default=list)  # task ids
    input = Column(JSON, default=dict)
    expected_output = Column(JSON, default=dict)  # verification contract
    result = Column(JSON, default=dict)
    error = Column(Text, default="")
    attempts = Column(Integer, default=0)
    max_attempts = Column(Integer, default=3)
    cost_usd = Column(Float, default=0.0)
    created_by = Column(String(30), default="user")  # user|ceo|agent
    idempotency_key = Column(String(120), nullable=True, unique=True)
    created_at = Column(DateTime, default=now)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)


class Execution(Base):
    __tablename__ = "executions"
    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("tasks.id"))
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=True)
    step = Column(Integer, default=0)
    kind = Column(String(30), default="llm_call")  # llm_call|tool_call|verification|system
    detail = Column(JSON, default=dict)
    tokens_in = Column(Integer, default=0)
    tokens_out = Column(Integer, default=0)
    cost = Column(Float, default=0.0)
    status = Column(String(20), default="ok")  # ok|error|denied
    created_at = Column(DateTime, default=now)


class Memory(Base):
    __tablename__ = "memories"
    id = Column(Integer, primary_key=True)
    owner_type = Column(String(20), default="user")  # user|agent|system
    owner_id = Column(Integer, default=0)
    category = Column(String(40), default="fact")
    # profile|preference|goal|project|agent|task_history|document|verified_knowledge|fact
    kind = Column(String(20), default="fact")  # fact|preference|hypothesis|objective
    content = Column(Text, nullable=False)
    source = Column(String(200), default="")
    tags = Column(JSON, default=list)
    importance = Column(Integer, default=3)
    verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=now)
    updated_at = Column(DateTime, default=now, onupdate=now)


class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String(300), nullable=False)
    path = Column(String(500), nullable=False)
    mime = Column(String(120), default="")
    size = Column(Integer, default=0)
    indexed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=now)


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    level = Column(String(20), default="info")  # info|warning|error|action_required
    title = Column(String(300), nullable=False)
    body = Column(Text, default="")
    link = Column(String(300), default="")
    event_type = Column(String(60), default="")
    dedupe_key = Column(String(200), default="")
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=now)


class CostRecord(Base):
    __tablename__ = "cost_records"
    id = Column(Integer, primary_key=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=True)
    provider_id = Column(Integer, ForeignKey("providers.id"), nullable=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    model = Column(String(120), default="")
    tokens_in = Column(Integer, default=0)
    tokens_out = Column(Integer, default=0)
    cost_usd = Column(Float, default=0.0)
    estimated = Column(Boolean, default=True)
    created_at = Column(DateTime, default=now)


class OfficeConfig(Base):
    __tablename__ = "office_configs"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    scenario = Column(String(40), default="corporate")  # corporate|home_office
    layout = Column(JSON, default=dict)     # furniture placements
    lighting = Column(JSON, default=dict)   # intensity, ambient, interior lights
    cycle = Column(JSON, default=dict)      # mode fixed|auto, speed, start_hour
    placements = Column(JSON, default=dict) # agent_id -> {x,z,zone}
    updated_at = Column(DateTime, default=now, onupdate=now)


class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String(200), default="Conversación")
    created_at = Column(DateTime, default=now)


class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"))
    role = Column(String(20), nullable=False)  # user|assistant|system
    content = Column(Text, nullable=False)
    meta = Column(JSON, default=dict)
    created_at = Column(DateTime, default=now)


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id = Column(Integer, primary_key=True)
    ts = Column(DateTime, default=now)
    agent_id = Column(Integer, nullable=True)
    task_id = Column(Integer, nullable=True)
    action = Column(String(200), nullable=False)
    tool = Column(String(80), default="")
    result = Column(String(40), default="")
    permissions_used = Column(JSON, default=list)
    auth_id = Column(Integer, nullable=True)
    cost = Column(Float, default=0.0)
    error = Column(Text, default="")


class Setting(Base):
    __tablename__ = "settings"
    key = Column(String(80), primary_key=True)
    value = Column(JSON, default=dict)


class PauseState(Base):
    """Single row storing the global pause flag; kept in DB so it survives restarts."""
    __tablename__ = "pause_state"
    id = Column(Integer, primary_key=True)
    paused = Column(Boolean, default=False)
    reason = Column(String(300), default="")
    updated_at = Column(DateTime, default=now, onupdate=now)
