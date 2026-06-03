export type ActivityType =
  | 'task_completed'
  | 'task_created'
  | 'member_added'
  | 'comment'
  | 'file_uploaded'
  | 'meeting_scheduled'
  | 'milestone_reached';

export interface Activity {
  id: string;
  type: ActivityType;
  userId: string;
  userName: string;
  userAvatarUrl: string;
  description: string;
  timestamp: string;
  projectId?: string;
  projectName?: string;
}
