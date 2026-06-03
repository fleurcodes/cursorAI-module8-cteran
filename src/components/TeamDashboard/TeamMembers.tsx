import { useState } from 'react';
import Card from '../shared/Card';
import Avatar from '../shared/Avatar';
import Badge from '../shared/Badge';
import type { TeamMember } from '../types/team';

interface TeamMembersProps {
  members: TeamMember[];
  onAddMember: () => void;
}

export default function TeamMembers({ members, onAddMember }: TeamMembersProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Team Members</h2>
        <button
          type="button"
          onClick={onAddMember}
          className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          aria-label="Add team member"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>
      </div>

      <ul className="space-y-3" role="list" aria-label="Team members">
        {members.map((member) => {
          const isExpanded = expandedId === member.id;
          return (
            <li key={member.id}>
              <button
                type="button"
                className="w-full text-left"
                onClick={() => setExpandedId(isExpanded ? null : member.id)}
                aria-expanded={isExpanded}
                aria-controls={`member-details-${member.id}`}
              >
                <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <Avatar
                    src={member.avatarUrl}
                    alt={member.name}
                    size="sm"
                    status={member.status}
                    showStatus
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{member.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant={member.role} />
                      <Badge variant={member.status} />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-400">
                      {member.tasksCompleted} done
                    </p>
                    <p className="text-xs text-gray-400">
                      {member.tasksInProgress} active
                    </p>
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div
                  id={`member-details-${member.id}`}
                  className="mx-2 mt-1 mb-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm"
                >
                  <p className="text-gray-500 dark:text-gray-400 mb-3">{member.email}</p>
                  <div className="flex gap-2">
                    <a
                      href={`mailto:${member.email}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Email
                    </a>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Message
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Compact avatar stack */}
      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
        <div className="flex -space-x-2">
          {members.slice(0, 5).map((m) => (
            <Avatar key={m.id} src={m.avatarUrl} alt={m.name} size="xs" showStatus status={m.status} />
          ))}
          {members.length > 5 && (
            <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 ring-2 ring-white dark:ring-gray-800 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 font-medium">
              +{members.length - 5}
            </div>
          )}
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">{members.length} members</span>
      </div>
    </Card>
  );
}
