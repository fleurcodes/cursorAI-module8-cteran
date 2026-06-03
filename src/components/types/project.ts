export type ProjectStatus = 'on-track' | 'at-risk' | 'delayed' | 'completed';
export type MilestoneStatus = 'completed' | 'in-progress' | 'upcoming';

export interface Milestone {
  id: string;
  title: string;
  dueDate: string;
  status: MilestoneStatus;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  progress: number;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  startDate: string;
  endDate: string;
  milestones: Milestone[];
  teamMemberIds: string[];
}
