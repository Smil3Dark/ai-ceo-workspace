export interface Agent {
  id: number; name: string; description: string; role: string;
  specialty: string; instructions: string; objective: string;
  is_ceo: boolean; status: string; team_id?: number | null;
  provider_id?: number | null; model: string; autonomy: string;
  budget: number; spent: number; priority: number;
  avatar: Record<string, any>; voice: Record<string, any>;
  memory_scope: string[]; tools: string[];
  config_pending_reason: string;
  permissions?: PermRow[];
  running_tasks?: number;
}
export interface PermRow {
  scope: string; effect: string; requires_confirmation: boolean;
  constraints: Record<string, any>; permission_id: number | null;
  sensitive: boolean;
}
export interface Provider {
  id: number; name: string; kind: string; base_url: string;
  default_model: string; enabled: boolean; is_free: boolean;
  cost_per_1k_in: number; cost_per_1k_out: number;
  last_test_ok: boolean; last_test_detail: string; has_key: boolean;
}
export interface Task {
  id: number; title: string; description: string; status: string;
  priority: number; agent_id?: number | null; agent_name?: string;
  project_id?: number | null; depends_on: number[]; result: any;
  error: string; attempts: number; max_attempts: number; cost_usd: number;
  created_by: string; created_at: string;
}
export interface Approval {
  id: number; agent: string; agent_id: number; task_id?: number;
  action_type: string; reason: string; resources: any;
  cost_estimate?: number; risk: string; status: string; created_at: string;
}
export interface Memory {
  id: number; category: string; kind: string; content: string;
  source: string; tags: string[]; importance: number; verified: boolean;
  created_at: string; updated_at: string;
}
export interface Notification {
  id: number; level: string; title: string; body: string; link: string;
  read: boolean; created_at: string; event_type: string;
}
export interface Project { id: number; name: string; description: string; status: string }
export interface Goal { id: number; title: string; horizon: string; priority: number; status: string }
export interface Msg {
  id: number; role: 'user' | 'assistant' | 'system'; content: string;
  meta?: any; created_at: string;
}
export interface AgentVisual {
  agent_id: number; name: string; role: string; state: string;
  task?: string | null; avatar: Record<string, any>; db_status: string;
}
export interface OfficeData {
  config: { scenario: string; layout: any; lighting: any; cycle: any; placements: Record<string, any> };
  agents: AgentVisual[];
}
