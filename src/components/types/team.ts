export type OnlineStatus = 'online' | 'away' | 'offline';
export type MemberRole = 'admin' | 'developer' | 'designer' | 'manager' | 'qa';

export interface TeamMember {
  id: string;
  name: string;
  role: MemberRole;
  avatarUrl: string;
  status: OnlineStatus;
  email: string;
  tasksCompleted: number;
  tasksInProgress: number;
}
