import type { ReactNode } from 'react';

type IconProps = {
  className?: string;
};

const base = 'h-5 w-5';

function Svg({
  className = base,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="6.25" />
      <path strokeLinecap="round" d="m16 16 4 4" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={props.className ?? base}
      fill="currentColor"
      aria-hidden
    >
      <path d="M3.7 6.2A1.7 1.7 0 0 1 5.4 4.5h3.6c.32 0 .63.13.86.36l1.2 1.24h7.5A1.7 1.7 0 0 1 20.3 7.8v9.5a1.7 1.7 0 0 1-1.7 1.7H5.4a1.7 1.7 0 0 1-1.7-1.7z" />
    </svg>
  );
}

export function FolderPlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.5 7.2A1.7 1.7 0 0 1 5.2 5.5h3.4c.3 0 .6.12.82.34L11 7.5h7.3A1.7 1.7 0 0 1 20 9.2v8.1a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7z"
      />
      <path strokeLinecap="round" d="M12 11.5v5M9.5 14h5" />
    </Svg>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V7m0 0 3.5 3.5M12 7 8.5 10.5" />
      <path strokeLinecap="round" d="M5 18.5h14" />
    </Svg>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="18" cy="6" r="2.2" />
      <circle cx="6" cy="12" r="2.2" />
      <circle cx="18" cy="18" r="2.2" />
      <path d="m8 12.8 8 4.2M16 7.2l-8 4.2" />
    </Svg>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="6" cy="12" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.15" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path strokeLinecap="round" d="m7 7 10 10M17 7 7 17" />
    </Svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
    </Svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m15 6-6 6 6 6" />
    </Svg>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.5" y="4.5" width="6" height="6" rx="1" />
      <rect x="13.5" y="4.5" width="6" height="6" rx="1" />
      <rect x="4.5" y="13.5" width="6" height="6" rx="1" />
      <rect x="13.5" y="13.5" width="6" height="6" rx="1" />
    </Svg>
  );
}

export function ListIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path strokeLinecap="round" d="M9 7h11M9 12h11M9 17h11" />
      <circle cx="5" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="17" r="1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <path strokeLinecap="round" d="M12 11.2V17M12 8v.2" />
    </Svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v9m0 0 3.5-3.5M12 15 8.5 11.5" />
      <path strokeLinecap="round" d="M5 18.5h14" />
    </Svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path strokeLinecap="round" d="M5 7h14M10 7V5.8A1.3 1.3 0 0 1 11.3 4.5h1.4A1.3 1.3 0 0 1 14 5.8V7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7l.7 12.2A1.5 1.5 0 0 0 9.2 20.5h5.6a1.5 1.5 0 0 0 1.5-1.3L16.9 7" />
    </Svg>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.8 16.4 16.6 4.6a1.6 1.6 0 0 1 2.3 2.3L7.1 18.7 4 19.5z"
      />
    </Svg>
  );
}

export function MoveIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M12 5l3.5 3.5M12 5 8.5 8.5M5 12h14" />
    </Svg>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 1 0-7.07-7.07L10 5.93m4 5.14a5 5 0 0 0-7.07 0L5.52 12.48a5 5 0 0 0 7.07 7.07L14 18.07"
      />
    </Svg>
  );
}

export function PeopleIcon({
  className,
  filled = false,
}: IconProps & { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? base}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.75}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 19v-1.2A2.8 2.8 0 0 0 13.2 15H8.8A2.8 2.8 0 0 0 6 17.8V19m9.5-10.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm5.5 7.3V17a2 2 0 0 0-1.5-1.94 4.5 4.5 0 0 0-2-.41m-9-4.15a2.25 2.25 0 1 1-2.5-3.74"
      />
    </svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3.4" />
      <path strokeLinecap="round" d="M12 3.6v1.6M12 18.8v1.6M4.9 4.9l1.1 1.1M18 18l1.1 1.1M3.6 12h1.6M18.8 12h1.6M4.9 19.1 6 18M18 6l1.1-1.1" />
    </Svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.4 14.2A6.4 6.4 0 0 1 9.8 7.6 5.3 5.3 0 1 0 16.4 14.2z"
      />
    </Svg>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5.5h4.2A1.3 1.3 0 0 1 19.5 6.8v10.4a1.3 1.3 0 0 1-1.3 1.3H14M10 16.5 14 12l-4-4.5M14 12H4.5" />
    </Svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path strokeLinecap="round" d="M5 7h14M5 12h14M5 17h14" />
    </Svg>
  );
}

export function SidebarIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M9.5 5v14" />
    </Svg>
  );
}

export function DriveIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.8 10.2 12 4.8l7.2 5.4V18a1.5 1.5 0 0 1-1.5 1.5h-3.4v-5.2h-4.6V19.5H6.3A1.5 1.5 0 0 1 4.8 18z" />
    </Svg>
  );
}

export function InboxIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 13.2 6.4 5.8A1.5 1.5 0 0 1 7.85 4.7h8.3A1.5 1.5 0 0 1 17.6 5.8l1.9 7.4v4.6A1.5 1.5 0 0 1 18 19.3H6a1.5 1.5 0 0 1-1.5-1.5z" />
      <path strokeLinecap="round" d="M4.6 13.2h4.1l1 2.2h4.6l1-2.2h4.1" />
    </Svg>
  );
}

export function SentIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M14.5 7.5 19 12l-4.5 4.5" />
    </Svg>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path strokeLinejoin="round" d="M3.5 12s3.2-6.2 8.5-6.2S20.5 12 20.5 12 17.3 18.2 12 18.2 3.5 12 3.5 12z" />
      <circle cx="12" cy="12" r="2.4" />
    </Svg>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path strokeLinecap="round" d="m5 5 14 14" />
      <path strokeLinejoin="round" d="M9.2 9.4A3.2 3.2 0 0 0 12 15.2M7.1 7.4C4.9 8.8 3.5 12 3.5 12s3.2 6.2 8.5 6.2c1.4 0 2.7-.3 3.8-.8M16.7 15.8c2-1.3 3.8-3.8 3.8-3.8S17.3 5.8 12 5.8c-.6 0-1.1 0-1.6.1" />
    </Svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="8.5" y="8.5" width="11" height="11" rx="1.4" />
      <path d="M6.2 15.2H5.6A1.6 1.6 0 0 1 4 13.6V5.6A1.6 1.6 0 0 1 5.6 4h8a1.6 1.6 0 0 1 1.6 1.6v.7" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m5.5 12.2 4.2 4.3 8.8-9" />
    </Svg>
  );
}

export function PdfIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={props.className ?? base}
      fill="none"
      aria-hidden
    >
      <path
        d="M7 3.6h6.1L19.2 9.8V20a1.6 1.6 0 0 1-1.6 1.6H7A1.6 1.6 0 0 1 5.4 20V5.2A1.6 1.6 0 0 1 7 3.6z"
        className="fill-pdf/15 stroke-pdf"
        strokeWidth="1.5"
      />
      <path d="M13.1 3.6v5.5h5.5" className="stroke-pdf" strokeWidth="1.5" />
    </svg>
  );
}

export function SortAscIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path strokeLinecap="round" d="m8 10 4-4 4 4M12 7v11" />
    </Svg>
  );
}

export function ExternalIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5.5h4.5V10M18.5 5.5 10 14" />
      <path strokeLinecap="round" d="M9 6.5H6.8A1.3 1.3 0 0 0 5.5 7.8v9.4A1.3 1.3 0 0 0 6.8 18.5h9.4a1.3 1.3 0 0 0 1.3-1.3V15" />
    </Svg>
  );
}

export function ActivityIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 14.5 8 10l3 4.5 4-7 4.5 7"
      />
    </Svg>
  );
}

export function HistoryIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 9h10.2A1.8 1.8 0 0 1 16.5 10.8v8.4a1.8 1.8 0 0 1-1.8 1.8H4.5A1.8 1.8 0 0 1 2.7 19.2v-8.4A1.8 1.8 0 0 1 4.5 9z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.2 9V6.8A1.8 1.8 0 0 1 9 5h10.2A1.8 1.8 0 0 1 21 6.8v8.4a1.8 1.8 0 0 1-1.8 1.8H16.5"
      />
    </Svg>
  );
}

export function OpenIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 12h15M13.5 6.5 19.5 12l-6 5.5"
      />
    </Svg>
  );
}
