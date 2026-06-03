/**
 * Domain types — what the UI works with. Distinct from raw DB rows because
 * the UI often needs joined / computed shapes (e.g., a task with its
 * assignees and label list pre-attached).
 */

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';
export type BoardRole = 'admin' | 'member';
export type Visibility = 'public' | 'private';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type SubtaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'rejected';
export type BugSeverity = 'trivial' | 'minor' | 'major' | 'critical' | 'blocker';
export type BugStatus = 'open' | 'assigned' | 'fixing' | 'fixed' | 'reopened' | 'closed';
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';
export type NotificationType =
  | 'task_assigned'
  | 'task_moved'
  | 'task_commented'
  | 'task_mentioned'
  | 'subtask_review_requested'
  | 'subtask_approved'
  | 'subtask_rejected'
  | 'bug_assigned'
  | 'invitation_received'
  | 'invitation_accepted'
  | 'board_member_added';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_developer: boolean;
  is_qa: boolean;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
}

export interface WorkspaceWithRole extends Workspace {
  role: WorkspaceRole;
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  profile: Profile;
}

export interface Board {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  color: string;
  visibility: Visibility;
  created_by: string;
  archived_at: string | null;
  created_at: string;
}

export interface BoardWithMeta extends Board {
  /** Effective board role for the current user. */
  my_role: BoardRole | null;
  is_starred: boolean;
}

export interface BoardMember {
  board_id: string;
  user_id: string;
  role: BoardRole;
  profile: Profile;
}

export interface BoardColumn {
  id: string;
  board_id: string;
  name: string;
  position: number;
  color: string | null;
  wip_limit: number | null;
}

export interface Label {
  id: string;
  board_id: string;
  name: string;
  color: string;
}

export interface Task {
  id: string;
  board_id: string;
  column_id: string;
  seq_number: number;
  title: string;
  description: string | null;
  position: number;
  priority: TaskPriority;
  due_date: string | null;
  weight_stars: number;
  created_by: string;
  archived_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assignees?: TaskAssignee[];
  labels?: Label[];
  subtasks?: Subtask[];
  comment_count?: number;
}

export interface TaskAssignee {
  task_id: string;
  user_id: string;
  profile?: Profile;
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  status: SubtaskStatus;
  assignee_id: string | null;
  created_by: string;
  review_note: string | null;
  reviewed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Bug {
  id: string;
  board_id: string;
  seq_number: number;
  title: string;
  description: string | null;
  steps_to_repro: string | null;
  expected: string | null;
  actual: string | null;
  severity: BugSeverity;
  status: BugStatus;
  reporter_id: string;
  assignee_id: string | null;
  weight_stars: number;
  created_at: string;
  updated_at: string;
  reporter?: Profile;
  assignee?: Profile | null;
}

export type CommentParentType = 'task' | 'subtask' | 'bug';

export interface Comment {
  id: string;
  parent_type: CommentParentType;
  parent_id: string;
  body: string;
  body_json: unknown;
  author_id: string;
  edited_at: string | null;
  created_at: string;
  author?: Profile;
}

export interface Invitation {
  id: string;
  workspace_id: string | null;
  board_id: string | null;
  email: string;
  role: WorkspaceRole;
  token: string;
  status: InvitationStatus;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}
