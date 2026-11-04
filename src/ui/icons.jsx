// Small stroke icons (decorative: always paired with visible or screen-reader text).
const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: 'false',
};

const make = (paths) =>
  function Icon(props) {
    return (
      <svg {...base} {...props}>
        {paths}
      </svg>
    );
  };

export const IconPlus = make(<path d="M12 5v14M5 12h14" />);
export const IconSearch = make(
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </>,
);
export const IconChevronLeft = make(<path d="m14.5 6-6 6 6 6" />);
export const IconChevronRight = make(<path d="m9.5 6 6 6-6 6" />);
export const IconChevronDown = make(<path d="m6 9.5 6 6 6-6" />);
export const IconX = make(<path d="M6 6l12 12M18 6 6 18" />);
export const IconMenu = make(<path d="M4 7h16M4 12h16M4 17h16" />);
export const IconGrid = make(
  <>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
  </>,
);
export const IconLayers = make(
  <>
    <path d="m12 4 8 4-8 4-8-4 8-4Z" />
    <path d="m4 12 8 4 8-4" />
    <path d="m4 16 8 4 8-4" />
  </>,
);
export const IconUser = make(
  <>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 19.5c1.2-3.2 3.8-4.8 7-4.8s5.8 1.6 7 4.8" />
  </>,
);
export const IconUsers = make(
  <>
    <circle cx="9" cy="9" r="3.2" />
    <path d="M3.5 19c.9-2.9 3-4.4 5.5-4.4s4.6 1.5 5.5 4.4" />
    <path d="M15.5 6.2a3 3 0 0 1 0 5.6M17.5 14.9c1.5.6 2.5 1.9 3 4.1" />
  </>,
);
export const IconLogOut = make(
  <>
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
    <path d="M9 16l-4-4 4-4M5 12h10" />
  </>,
);
export const IconTrash = make(
  <>
    <path d="M4.5 7h15M9.5 7V4.8h5V7" />
    <path d="M6.5 7l.8 12.2h9.4L17.5 7" />
  </>,
);
export const IconComment = make(<path d="M5 5.5h14v10H10l-4 3.5v-3.5H5z" />);
export const IconExternal = make(
  <>
    <path d="M13.5 4.5h6v6M19.5 4.5 11 13" />
    <path d="M18 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H10" />
  </>,
);
export const IconCheck = make(<path d="m5 12.5 4.5 4.5L19 7.5" />);
export const IconPencil = make(<path d="M15.5 5.5l3 3L8.5 18.5H5.5v-3z" />);
export const IconCalendar = make(
  <>
    <rect x="4" y="5.5" width="16" height="14.5" rx="2" />
    <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
  </>,
);
/** The sidebar toggle: a panel with its left column (like reference 1). */
export const IconPanel = make(
  <>
    <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
    <path d="M9.5 4.5v15" />
  </>,
);
export const IconTarget = make(
  <>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4.2" />
    <circle cx="12" cy="12" r="0.9" fill="currentColor" />
  </>,
);
export const IconMore = make(
  <>
    <circle cx="6" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="18" cy="12" r="1.3" fill="currentColor" stroke="none" />
  </>,
);
export const IconImage = make(
  <>
    <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m4.5 17.5 5-4.5 3.5 3 2.5-2 4 3.5" />
  </>,
);
export const IconMove = make(<path d="M12 4v16M8 7.5 12 4l4 3.5M8 16.5l4 3.5 4-3.5" />);
export const IconInfo = make(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.5" />
    <circle cx="12" cy="7.8" r="0.8" fill="currentColor" stroke="none" />
  </>,
);
export const IconAlert = make(
  <>
    <path d="M12 4.5 20.5 19h-17z" />
    <path d="M12 10v4" />
    <circle cx="12" cy="16.6" r="0.8" fill="currentColor" stroke="none" />
  </>,
);
export const IconInstagram = make(
  <>
    <rect x="4" y="4" width="16" height="16" rx="4.5" />
    <circle cx="12" cy="12" r="3.6" />
    <circle cx="16.6" cy="7.4" r="0.6" fill="currentColor" />
  </>,
);
