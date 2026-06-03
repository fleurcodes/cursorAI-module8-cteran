import { useState } from 'react';
import Card from '../shared/Card';
import Avatar from '../shared/Avatar';
import type { Activity, ActivityType } from '../types/activity';

interface ActivityFeedProps {
  activities: Activity[];
  /** Initial number of items shown before "Load more". Defaults to 10. */
  maxVisible?: number;
}

const activityIcon: Record<ActivityType, React.ReactNode> = {
  task_completed: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  task_created: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  member_added: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  ),
  comment: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  file_uploaded: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  ),
  meeting_scheduled: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  milestone_reached: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
    </svg>
  ),
};

const activityIconBg: Record<ActivityType, string> = {
  task_completed: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  task_created: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  member_added: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  comment: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  file_uploaded: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  meeting_scheduled: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
  milestone_reached: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
};

function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now.getTime() - past.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function ActivityFeed({ activities, maxVisible = 10 }: ActivityFeedProps) {
  const [visibleCount, setVisibleCount] = useState(maxVisible);
  const visible = activities.slice(0, visibleCount);
  const hasMore = activities.length > visibleCount;

  return (
    <Card>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
      <ol className="space-y-4" aria-label="Activity feed">
        {visible.map((activity) => (
          <li key={activity.id} className="flex items-start gap-3">
            {/* Activity type icon */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${activityIconBg[activity.type]}`} aria-hidden="true">
              {activityIcon[activity.type]}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Avatar src={activity.userAvatarUrl} alt={activity.userName} size="xs" />
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{activity.userName}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{activity.description}</p>
              {activity.projectName && (
                <p className="text-xs text-primary mt-0.5">{activity.projectName}</p>
              )}
            </div>

            {/* Timestamp */}
            <time
              dateTime={activity.timestamp}
              className="flex-shrink-0 text-xs text-gray-400 whitespace-nowrap"
            >
              {formatRelativeTime(activity.timestamp)}
            </time>
          </li>
        ))}
      </ol>
      {hasMore && (
        <button
          type="button"
          onClick={() => setVisibleCount((n) => n + 10)}
          className="mt-4 w-full py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Load more ({activities.length - visibleCount} remaining)
        </button>
      )}
    </Card>
  );
}
