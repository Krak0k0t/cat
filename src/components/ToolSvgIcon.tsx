import type { ToolId } from '../data/tools';

export function ToolSvgIcon({
  toolId,
  color,
  className = 'w-4 h-4 shrink-0',
}: {
  toolId: ToolId;
  color: string;
  className?: string;
}) {
  switch (toolId) {
    case 'bell':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="M12 3a1.5 1.5 0 0 1 1.5 1.5v.6A5.5 5.5 0 0 1 17.5 10.5v4.3l1.6 2.1a.6.6 0 0 1-.48.96H5.38a.6.6 0 0 1-.48-.96l1.6-2.1v-4.3A5.5 5.5 0 0 1 10.5 5.1v-.6A1.5 1.5 0 0 1 12 3Z"
            fill={color}
            fillOpacity="0.22"
            stroke="#0F181B"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path
            d="M12 3a1.5 1.5 0 0 1 1.5 1.5v.6A5.5 5.5 0 0 1 17.5 10.5v4.3l1.6 2.1H4.9l1.6-2.1v-4.3A5.5 5.5 0 0 1 10.5 5.1v-.6A1.5 1.5 0 0 1 12 3Z"
            fill="none"
            stroke={color}
            strokeWidth="1.45"
            strokeLinejoin="round"
          />
          <path d="M9.6 18.2a2.4 2.4 0 0 0 4.8 0" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'fish_sling':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="M4.5 12c2.8-3.6 7.4-4.2 11.4-1.7l3.6-2.5v8.4l-3.6-2.5C11.9 16.2 7.3 15.6 4.5 12Z"
            fill={color}
            fillOpacity="0.24"
            stroke="#0F181B"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path
            d="M4.5 12c2.8-3.6 7.4-4.2 11.4-1.7l3.6-2.5v8.4l-3.6-2.5C11.9 16.2 7.3 15.6 4.5 12Z"
            fill="none"
            stroke={color}
            strokeWidth="1.45"
            strokeLinejoin="round"
          />
          <circle cx="8.6" cy="11.4" r="1.05" fill="#F7EEDC" />
        </svg>
      );
    case 'sonic_claw':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="M5 17C6.8 10.4 10.8 6.4 17.5 4.8M9 19c1.6-4.8 4.8-7.8 9.8-9.2M13.5 19.5c1-2.6 2.8-4.4 5.8-5.3"
            fill="none"
            stroke="#0F181B"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            d="M5 17C6.8 10.4 10.8 6.4 17.5 4.8M9 19c1.6-4.8 4.8-7.8 9.8-9.2M13.5 19.5c1-2.6 2.8-4.4 5.8-5.3"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'lantern_flare':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" fill={color} fillOpacity="0.28" stroke="#0F181B" strokeWidth="2.2" />
          <circle cx="12" cy="12" r="4.2" fill="none" stroke={color} strokeWidth="1.45" />
          <path
            d="M12 2.5v2.7M12 18.8v2.7M2.5 12h2.7M18.8 12h2.7M5.4 5.4l1.9 1.9M16.7 16.7l1.9 1.9M18.6 5.4l-1.9 1.9M7.3 16.7l-1.9 1.9"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}
