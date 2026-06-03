import type { OnlineStatus } from '../types/team';

interface TeamAvatarProps {
  src: string;
  alt: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  status?: OnlineStatus;
  showStatus?: boolean;
}

const sizeClasses = {
  xs: 'w-7 h-7 text-xs',
  sm: 'w-9 h-9 text-sm',
  md: 'w-12 h-12 text-base',
  lg: 'w-16 h-16 text-xl',
};

const statusColors: Record<OnlineStatus, string> = {
  online: 'bg-green-400',
  away: 'bg-yellow-400',
  offline: 'bg-gray-400',
};

const statusDotSize = {
  xs: 'w-2 h-2',
  sm: 'w-2.5 h-2.5',
  md: 'w-3 h-3',
  lg: 'w-3.5 h-3.5',
};

export default function Avatar({ src, alt, size = 'md', status, showStatus = false }: TeamAvatarProps) {
  const initials = alt
    .split(' ')
    .map((n) => n.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="relative inline-flex flex-shrink-0">
      <div
        className={`${sizeClasses[size]} rounded-full overflow-hidden ring-2 ring-white dark:ring-gray-800 flex-shrink-0`}
        role="img"
        aria-label={alt}
      >
        {src ? (
          <img src={src} alt={alt} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
            {initials}
          </div>
        )}
      </div>
      {showStatus && status && (
        <span
          className={`absolute bottom-0 right-0 ${statusDotSize[size]} ${statusColors[status]} rounded-full ring-2 ring-white dark:ring-gray-800`}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
}
