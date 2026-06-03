import type { MemberRole, OnlineStatus } from '../types/team';
import type { ProjectStatus, MilestoneStatus } from '../types/project';

type BadgeVariant =
  | MemberRole
  | OnlineStatus
  | ProjectStatus
  | MilestoneStatus
  | 'default';

interface BadgeProps {
  variant: BadgeVariant;
  label?: string;
  size?: 'sm' | 'md';
}

const variantClasses: Record<string, string> = {
  // Roles
  admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  developer: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  designer: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  manager: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  qa: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  // Online status
  online: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  away: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  offline: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  // Project status
  'on-track': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  'at-risk': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  delayed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  // Milestone status
  'in-progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  upcoming: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  // Default
  default: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
};

const defaultLabels: Record<string, string> = {
  'on-track': 'On Track',
  'at-risk': 'At Risk',
  'in-progress': 'In Progress',
};

export default function Badge({ variant, label, size = 'sm' }: BadgeProps) {
  const displayLabel = label ?? defaultLabels[variant] ?? variant.charAt(0).toUpperCase() + variant.slice(1);
  return (
    <span className={`inline-flex items-center font-medium rounded-full ${sizeClasses[size]} ${variantClasses[variant] ?? variantClasses.default}`}>
      {displayLabel}
    </span>
  );
}
