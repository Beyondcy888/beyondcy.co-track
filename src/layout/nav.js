// Which pages a tracker has, per layout (02 §1 "What each person sees after login").
//   single      → the brand page
//   multi_brand → Master · one page per brand
//   team        → My work · Master   (Admin has no lane of their own, so only Master)

export function trackerPages(role, brands, isAdmin) {
  if (!role) return [];
  const base = `/t/${role.id}`;
  switch (role.layout) {
    case 'single': {
      const name = brands[0]?.name ?? role.name;
      return [{ to: base, end: true, label: name, icon: 'brand', initial: name.charAt(0) }];
    }
    case 'multi_brand':
      return [
        { to: base, end: true, label: 'Master', icon: 'master' },
        ...brands.map((b) => ({ to: `${base}/brand/${b.id}`, end: true, label: b.name, icon: 'brand', initial: b.name.charAt(0) })),
      ];
    case 'team':
      return isAdmin
        ? [{ to: `${base}/master`, end: true, label: 'Master', icon: 'master' }]
        : [
            { to: base, end: true, label: 'My work', icon: 'me' },
            { to: `${base}/master`, end: true, label: 'Master', icon: 'master' },
          ];
    default:
      return [];
  }
}

/** Where a staff member lands after login. */
export function homePathFor(profile) {
  if (!profile?.role_id) return '/';
  if (profile.role?.is_admin) return '/';
  return `/t/${profile.role_id}`;
}
