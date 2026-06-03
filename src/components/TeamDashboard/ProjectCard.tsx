import Badge from '../shared/Badge';
import type { Project } from '../types/project';

interface ProjectCardProps {
  project: Project;
  isSelected: boolean;
  onClick: () => void;
}

export default function ProjectCard({ project, isSelected, onClick }: ProjectCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className={`w-full text-left p-4 rounded-2xl border transition-all duration-150 ${
        isSelected
          ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-md'
          : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-primary/40 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{project.name}</h3>
        <Badge variant={project.status} />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{project.description}</p>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs text-gray-400">Progress</span>
        <span className="text-xs font-bold text-primary">{project.progress}%</span>
      </div>
      <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${project.progress}%` }}
        />
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-400">
        <span>{project.completedTasks}/{project.totalTasks} tasks</span>
        <span>Due {project.endDate}</span>
      </div>
    </button>
  );
}
