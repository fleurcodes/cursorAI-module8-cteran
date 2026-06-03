import Card from '../shared/Card';

interface QuickActionsProps {
  onCreateTask: () => void;
  onAddMember: () => void;
  onGenerateReport: () => void;
  onScheduleMeeting: () => void;
}

interface Action {
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
}

export default function QuickActions({ onCreateTask, onAddMember, onGenerateReport, onScheduleMeeting }: QuickActionsProps) {
  const actions: Action[] = [
    {
      label: 'New Task',
      description: 'Create a task',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      color: 'bg-primary text-white hover:bg-primary/90',
      onClick: onCreateTask,
    },
    {
      label: 'Add Member',
      description: 'Invite someone',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      ),
      color: 'bg-blue-500 text-white hover:bg-blue-600',
      onClick: onAddMember,
    },
    {
      label: 'Report',
      description: 'Generate report',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'bg-green-500 text-white hover:bg-green-600',
      onClick: onGenerateReport,
    },
    {
      label: 'Meeting',
      description: 'Schedule a call',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      color: 'bg-orange-500 text-white hover:bg-orange-600',
      onClick: onScheduleMeeting,
    },
  ];

  return (
    <Card>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl font-medium transition-all duration-150 active:scale-95 ${action.color}`}
            aria-label={action.label}
          >
            <span aria-hidden="true">{action.icon}</span>
            <span className="text-sm font-semibold">{action.label}</span>
            <span className="text-xs opacity-80">{action.description}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}
