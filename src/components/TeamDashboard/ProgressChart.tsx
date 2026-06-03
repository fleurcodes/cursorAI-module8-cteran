import Card from '../shared/Card';
import type { Project } from '../types/project';

interface ProgressChartProps {
  project: Project;
  weeklyData: number[];
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ProgressChart({ project, weeklyData }: ProgressChartProps) {
  const maxVal = Math.max(...weeklyData, 1);
  const safeTotal = Math.max(1, project.totalTasks);

  // Donut chart values
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const completedStroke = (project.completedTasks / safeTotal) * circumference;
  const inProgressStroke = (project.inProgressTasks / safeTotal) * circumference;
  const inProgressOffset = -completedStroke;

  return (
    <Card>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">Progress Chart</h2>

      {/* Donut chart */}
      <div className="flex flex-col sm:flex-row items-center gap-6 mb-6">
        <div className="relative flex-shrink-0">
          <svg width="100" height="100" viewBox="0 0 100 100" aria-label="Task completion donut chart" role="img">
            {/* Background ring */}
            <circle
              cx="50" cy="50" r={radius}
              fill="none"
              stroke="currentColor"
              className="text-gray-100 dark:text-gray-800"
              strokeWidth="12"
            />
            {/* Completed segment */}
            {project.completedTasks > 0 && (
              <circle
                cx="50" cy="50" r={radius}
                fill="none"
                stroke="currentColor"
                className="text-green-400"
                strokeWidth="12"
                strokeDasharray={`${completedStroke} ${circumference - completedStroke}`}
                strokeDashoffset={circumference / 4}
                strokeLinecap="round"
                style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
              />
            )}
            {/* In-progress segment */}
            {project.inProgressTasks > 0 && (
              <circle
                cx="50" cy="50" r={radius}
                fill="none"
                stroke="currentColor"
                className="text-blue-400"
                strokeWidth="12"
                strokeDasharray={`${inProgressStroke} ${circumference - inProgressStroke}`}
                strokeDashoffset={circumference / 4 + inProgressOffset}
                strokeLinecap="round"
                style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-gray-900 dark:text-white">{project.progress}%</span>
            <span className="text-xs text-gray-400">done</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-3 w-full">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">Completed</span>
              <span className="font-medium text-green-600 dark:text-green-400">{project.completedTasks}</span>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-400 rounded-full"
                style={{ width: `${(project.completedTasks / safeTotal) * 100}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">In Progress</span>
              <span className="font-medium text-blue-600 dark:text-blue-400">{project.inProgressTasks}</span>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-400 rounded-full"
                style={{ width: `${(project.inProgressTasks / safeTotal) * 100}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">Overdue</span>
              <span className="font-medium text-red-600 dark:text-red-400">{project.overdueTasks}</span>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-400 rounded-full"
                style={{ width: `${(project.overdueTasks / safeTotal) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Weekly bar chart */}
      <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Tasks Completed This Week</p>
        <div className="flex items-end gap-2 h-24" aria-label="Weekly tasks completed bar chart" role="img">
          {weeklyData.map((val, i) => (
            <div key={DAYS[i]} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs text-gray-500">{val}</span>
              <div className="w-full rounded-t-md bg-primary/80 dark:bg-primary/60 transition-all duration-500"
                style={{ height: `${(val / maxVal) * 72}px` }}
                title={`${DAYS[i]}: ${val} tasks`}
              />
              <span className="text-xs text-gray-400">{DAYS[i]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Milestones timeline */}
      <div className="border-t border-gray-100 dark:border-gray-800 pt-5 mt-4">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Milestones</p>
        <ol className="relative border-l border-gray-200 dark:border-gray-700 ml-2 space-y-3">
          {project.milestones.map((ms) => {
            const dotColor =
              ms.status === 'completed' ? 'bg-green-400' :
              ms.status === 'in-progress' ? 'bg-blue-400' : 'bg-gray-300 dark:bg-gray-600';
            return (
              <li key={ms.id} className="ml-4">
                <span className={`absolute -left-1.5 mt-1 w-3 h-3 rounded-full ${dotColor}`} aria-hidden="true" />
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-700 dark:text-gray-300">{ms.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    ms.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    ms.status === 'in-progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                    'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                  }`}>{ms.status}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{ms.dueDate}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </Card>
  );
}
