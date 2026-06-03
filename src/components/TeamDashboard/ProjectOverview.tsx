import Card from '../shared/Card';
import type { Project } from '../types/project';

interface ProjectOverviewProps {
  project: Project;
}

const trendIcon = (value: number) =>
  value >= 0 ? (
    <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  ) : (
    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
    </svg>
  );

export default function ProjectOverview({ project }: ProjectOverviewProps) {
  const todoTasks = Math.max(0, project.totalTasks - project.completedTasks - project.inProgressTasks);
  const safeTotal = Math.max(1, project.totalTasks);

  const metrics = [
    {
      label: 'Total Tasks',
      value: project.totalTasks,
      trend: 4,
      trendLabel: 'vs last week',
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      label: 'Completed',
      value: project.completedTasks,
      trend: 8,
      trendLabel: 'vs last week',
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      label: 'In Progress',
      value: project.inProgressTasks,
      trend: -2,
      trendLabel: 'vs last week',
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-50 dark:bg-orange-900/20',
    },
    {
      label: 'Overdue',
      value: project.overdueTasks,
      trend: -1,
      trendLabel: 'vs last week',
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-900/20',
    },
  ];

  return (
    <Card>
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{project.name}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{project.description}</p>
      </div>

      {/* Overall progress */}
      <div className="mb-5">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Overall Progress</span>
          <span className="text-sm font-bold text-primary">{project.progress}%</span>
        </div>
        <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${project.progress}%` }}
            role="progressbar"
            aria-valuenow={project.progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>Started {project.startDate}</span>
          <span>Due {project.endDate}</span>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className={`${m.bg} rounded-xl p-3`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{m.label}</p>
            <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
            <div className="flex items-center gap-1 mt-1">
              {trendIcon(m.trend)}
              <span className={`text-xs ${m.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(m.trend)} {m.trendLabel}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Task breakdown bar */}
      <div className="mt-5">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Task Breakdown</p>
        <div className="flex w-full h-3 rounded-full overflow-hidden gap-0.5">
          {project.completedTasks > 0 && (
            <div
              className="bg-green-400 dark:bg-green-500"
              style={{ width: `${(project.completedTasks / safeTotal) * 100}%` }}
              title={`Completed: ${project.completedTasks}`}
            />
          )}
          {project.inProgressTasks > 0 && (
            <div
              className="bg-blue-400 dark:bg-blue-500"
              style={{ width: `${(project.inProgressTasks / safeTotal) * 100}%` }}
              title={`In Progress: ${project.inProgressTasks}`}
            />
          )}
          {todoTasks > 0 && (
            <div
              className="bg-gray-200 dark:bg-gray-700 flex-1"
              title={`To Do: ${todoTasks}`}
            />
          )}
        </div>
        <div className="flex gap-4 mt-2 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" />
            Completed
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />
            In Progress
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 inline-block" />
            To Do
          </span>
        </div>
      </div>
    </Card>
  );
}
