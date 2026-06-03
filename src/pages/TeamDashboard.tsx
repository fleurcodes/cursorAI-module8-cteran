import { useState, useCallback, useEffect, useMemo } from 'react';
import ProjectOverview from '../components/TeamDashboard/ProjectOverview';
import ProjectTaskList from '../components/TeamDashboard/ProjectTaskList';
import TeamMembers from '../components/TeamDashboard/TeamMembers';
import ProgressChart from '../components/TeamDashboard/ProgressChart';
import ActivityFeed from '../components/TeamDashboard/ActivityFeed';
import QuickActions from '../components/TeamDashboard/QuickActions';
import ProjectCard from '../components/TeamDashboard/ProjectCard';
import {
  CreateTaskModal,
  CreateProjectModal,
  AddMemberModal,
  ReportModal,
  ScheduleMeetingModal,
} from '../components/TeamDashboard/DashboardModals';
import type { MemberRole } from '../components/types/team';
import type { Project, ProjectStatus } from '../components/types/project';
import type { Activity } from '../components/types/activity';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchProjects,
  fetchTeamSummary,
  fetchNotifications,
  fetchUsers,
  createTask,
  createProject,
  updateTask,
  updateProject,
  addProjectMember,
  sendNotification,
  mapApiProjectToProject,
  buildWeeklyCompletedCounts,
  aggregateTeamMembers,
  notificationsToActivities,
  type ApiProject,
  type ApiTeamMemberRow,
} from '../services/teamDashboardApi';

type ActiveModal =
  | 'create-task'
  | 'create-project'
  | 'add-member'
  | 'report'
  | 'schedule-meeting'
  | null;

export default function TeamDashboard() {
  const { user } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [apiProjects, setApiProjects] = useState<ApiProject[]>([]);
  const [teamRows, setTeamRows] = useState<ApiTeamMemberRow[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [weeklyData, setWeeklyData] = useState<Record<string, number[]>>({});
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.supportRole === 'admin';

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rawProjects, teamRes, rawNotifications] = await Promise.all([
        fetchProjects(),
        fetchTeamSummary(),
        fetchNotifications(),
      ]);

      setApiProjects(rawProjects);
      setProjects(rawProjects.map(mapApiProjectToProject));
      setTeamRows(teamRes.team ?? []);
      setActivities(notificationsToActivities(rawNotifications));

      const weekly: Record<string, number[]> = {};
      for (const p of rawProjects) {
        weekly[String(p.id)] = buildWeeklyCompletedCounts(p.tasks);
      }
      setWeeklyData(weekly);

      setSelectedProjectId((prev) => {
        if (prev && rawProjects.some((p) => String(p.id) === prev)) return prev;
        return rawProjects[0] ? String(rawProjects[0].id) : '';
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
      setProjects([]);
      setApiProjects([]);
      setTeamRows([]);
      setActivities([]);
      setWeeklyData({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const members = useMemo(() => {
    if (apiProjects.length === 0) return [];
    const pid =
      selectedProjectId && apiProjects.some((p) => String(p.id) === selectedProjectId)
        ? selectedProjectId
        : String(apiProjects[0].id);
    return aggregateTeamMembers(apiProjects, teamRows, { projectId: pid });
  }, [apiProjects, teamRows, selectedProjectId]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? projects[0];
  const selectedApiProject = apiProjects.find((p) => String(p.id) === selectedProjectId) ?? apiProjects[0];
  const closeModal = useCallback(() => setActiveModal(null), []);

  const handleProjectStatusChange = useCallback(
    async (status: ProjectStatus) => {
      const pid = parseInt(selectedProjectId, 10);
      if (Number.isNaN(pid)) return;
      try {
        await updateProject(pid, { status });
        await loadDashboard();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not update project status');
      }
    },
    [selectedProjectId, loadDashboard]
  );

  const handleTaskStatusChange = useCallback(
    async (taskId: number, status: string) => {
      try {
        await updateTask(taskId, { status });
        await loadDashboard();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not update task status');
      }
    },
    [loadDashboard]
  );

  const handleTaskSubmit = useCallback(
    async (title: string, assigneeId: string, priority: string) => {
      const pid = parseInt(selectedProjectId, 10);
      if (Number.isNaN(pid)) return;
      try {
        await createTask(pid, {
          title,
          assignee_id: parseInt(assigneeId, 10),
          priority,
        });
        closeModal();
        await loadDashboard();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not create task');
      }
    },
    [selectedProjectId, closeModal, loadDashboard]
  );

  const handleMemberSubmit = useCallback(
    async (name: string, email: string, role: MemberRole) => {
      const pid = parseInt(selectedProjectId, 10);
      if (Number.isNaN(pid)) return;
      const users = await fetchUsers();
      const match = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
      if (!match) {
        throw new Error(
          `No registered user found with that email. Ask ${name} to register first, then add them by email.`
        );
      }
      await addProjectMember(pid, { user_id: match.id, role });
      closeModal();
      await loadDashboard();
    },
    [selectedProjectId, closeModal, loadDashboard]
  );

  const handleMeetingSubmit = useCallback(
    async (date: string, time: string, agenda: string, attendeeIds: string[]) => {
      const pid = parseInt(selectedProjectId, 10);
      const selfId = user ? parseInt(user.id, 10) : NaN;
      if (Number.isNaN(pid) || Number.isNaN(selfId)) {
        closeModal();
        return;
      }
      const attendeeNames = members
        .filter((m) => attendeeIds.includes(m.id))
        .map((m) => (m.name ?? '').split(/\s+/).filter(Boolean)[0] ?? m.name)
        .join(', ');
      const message = [
        `Project: ${selectedProject?.name ?? ''}`,
        `When: ${date} at ${time}`,
        agenda ? `Agenda: ${agenda}` : null,
        attendeeNames ? `Attendees: ${attendeeNames}` : null,
      ]
        .filter(Boolean)
        .join(' — ');
      try {
        const targets = new Set([selfId, ...attendeeIds.map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n))]);
        for (const uid of targets) {
          await sendNotification({
            user_id: uid,
            project_id: pid,
            title: 'Meeting scheduled',
            message: message.length >= 5 ? message : `${message} (details)`,
            level: 'info',
          });
        }
        closeModal();
        await loadDashboard();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not schedule meeting');
      }
    },
    [members, selectedProjectId, selectedProject?.name, user, closeModal, loadDashboard]
  );

  const handleCreateProject = useCallback(
    async (name: string, description: string) => {
      if (!user || user.supportRole !== 'admin') return;
      const created = await createProject({
        name,
        description: description.trim() || null,
        member_ids: [],
      });
      closeModal();
      setSelectedProjectId(String(created.id));
      await loadDashboard();
    },
    [user, closeModal, loadDashboard]
  );

  if (loading && projects.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-6">
        <p className="text-sm text-gray-600 dark:text-gray-400">Loading team dashboard…</p>
      </div>
    );
  }

  if (!loading && projects.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-6">
        <div className="max-w-md text-center rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">No projects yet</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {isAdmin ? (
              <>
                You are not on any project yet, or the list is empty. Create a project on the server to get started,
                then add members from the dashboard.
              </>
            ) : (
              <>
                Your account is not assigned to any project, or the project list is empty. Ask an administrator to
                create a project and add you, then refresh this page.
              </>
            )}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveModal('create-project')}
                className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90"
              >
                New project
              </button>
            )}
            <button
              type="button"
              onClick={() => void loadDashboard()}
              className="rounded-full border border-gray-300 dark:border-gray-600 px-5 py-2 text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {error && (
        <div
          className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-900 dark:text-amber-100 flex flex-wrap items-center justify-between gap-2"
          role="alert"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-amber-800 dark:text-amber-200 underline font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 sm:px-6 lg:px-8 py-5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Team Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {members.filter((m) => m.status === 'online').length} of {members.length} members online
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveModal('create-project')}
                className="rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/15 dark:border-primary/30 dark:bg-primary/20"
              >
                New project
              </button>
            )}
            <div className="flex items-center gap-2">
              {members.slice(0, 6).map((m) => (
                <div key={m.id} className="relative flex-shrink-0" title={`${m.name} — ${m.status}`}>
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold ring-2 ring-white dark:ring-gray-900">
                    {m.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </div>
                  <span
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-gray-900 ${
                      m.status === 'online' ? 'bg-green-400' : m.status === 'away' ? 'bg-yellow-400' : 'bg-gray-400'
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <section className="mb-6" aria-label="Project selector">
          <h2 className="sr-only">Select project</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isSelected={project.id === selectedProjectId}
                onClick={() => setSelectedProjectId(project.id)}
              />
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-6">
            {selectedProject && (
              <>
                <ProjectOverview project={selectedProject} />
                {selectedApiProject && (
                  <ProjectTaskList
                    tasks={selectedApiProject.tasks ?? []}
                    currentUserId={user?.id}
                    projectStatus={selectedProject.status}
                    onProjectStatusChange={handleProjectStatusChange}
                    onTaskStatusChange={handleTaskStatusChange}
                  />
                )}
                <ProgressChart
                  project={selectedProject}
                  weeklyData={weeklyData[selectedProjectId] ?? [0, 0, 0, 0, 0, 0, 0]}
                />
              </>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <QuickActions
              onCreateTask={() => setActiveModal('create-task')}
              onAddMember={() => setActiveModal('add-member')}
              onGenerateReport={() => setActiveModal('report')}
              onScheduleMeeting={() => setActiveModal('schedule-meeting')}
            />
            <TeamMembers members={members} onAddMember={() => setActiveModal('add-member')} />
            <ActivityFeed activities={activities} maxVisible={10} />
          </div>
        </div>
      </main>

      {activeModal === 'create-project' && (
        <CreateProjectModal onClose={closeModal} onSubmit={(n, d) => void handleCreateProject(n, d)} />
      )}
      {activeModal === 'create-task' && members.length > 0 && selectedProject && (
        <CreateTaskModal
          members={members}
          projectName={selectedProject.name}
          onClose={closeModal}
          onSubmit={handleTaskSubmit}
        />
      )}
      {activeModal === 'create-task' && members.length === 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close"
            onClick={closeModal}
          />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 max-w-sm text-center">
            <p className="text-sm text-gray-700 dark:text-gray-300">Add team members to this project before creating tasks.</p>
            <button
              type="button"
              onClick={closeModal}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
            >
              OK
            </button>
          </div>
        </div>
      )}
      {activeModal === 'add-member' && <AddMemberModal onClose={closeModal} onSubmit={handleMemberSubmit} />}
      {activeModal === 'report' && selectedProject && (
        <ReportModal
          report={{
            name: selectedProject.name,
            status: selectedProject.status,
            progress: selectedProject.progress,
            totalTasks: selectedProject.totalTasks,
            completedTasks: selectedProject.completedTasks,
            inProgressTasks: selectedProject.inProgressTasks,
            overdueTasks: selectedProject.overdueTasks,
            startDate: selectedProject.startDate,
            endDate: selectedProject.endDate,
          }}
          onClose={closeModal}
        />
      )}
      {activeModal === 'schedule-meeting' && selectedProject && (
        <ScheduleMeetingModal
          members={members}
          projectName={selectedProject.name}
          onClose={closeModal}
          onSubmit={(d, t, a, ids) => void handleMeetingSubmit(d, t, a, ids)}
        />
      )}
    </div>
  );
}
