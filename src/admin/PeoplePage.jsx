import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.js';
import { brandStyle } from '../config/brandStyle.js';
import { useApi } from '../data/ApiContext.js';
import { useAppData } from '../data/AppDataProvider.jsx';
import { PageHeader } from '../layout/PageHeader.jsx';
import { friendlyError } from '../lib/errors.js';
import { AvatarEditor } from '../people/AvatarEditor.jsx';
import { FadeIn, SkeletonBlock, SkeletonCircle, SkeletonLine, SkeletonRegion } from '../components/skeleton/Skeleton.jsx';
import { useConfirm } from '../ui/Confirm.jsx';
import { useToast } from '../ui/Toast.jsx';
import { LogoMark } from '../ui/bits.jsx';
import { IconAlert } from '../ui/icons.jsx';

const BASE = import.meta.env.BASE_URL;
const NO_ROLE = '__none';

function NameInput({ person, onSave }) {
  const [value, setValue] = useState(person.display_name);
  useEffect(() => setValue(person.display_name), [person.display_name]);
  const commit = async () => {
    const next = value.trim();
    if (next === person.display_name) return;
    if (!next) {
      setValue(person.display_name);
      return;
    }
    const ok = await onSave({ display_name: next });
    if (!ok) setValue(person.display_name);
  };
  return (
    <input
      className="input people-name"
      value={value}
      aria-label={`Display name for ${person.email}`}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setValue(person.display_name);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

/** The group's small logos: the tracker's brands (from brandStyle), the Beyondcy mark for Admin. */
function GroupLogos({ group, brands }) {
  if (group.role?.is_admin) return <LogoMark height={18} className="pg-logo-mark" />;
  const logos = brands.map((b) => ({ b, style: brandStyle(b.id) })).filter((x) => x.style.logo);
  if (!logos.length) return null;
  return (
    <span className="pg-logos" aria-hidden="true">
      {logos.slice(0, 5).map(({ b, style }) => (
        <img key={b.id} src={`${BASE}${style.logo}`} alt="" title={b.name} decoding="async" style={{ '--ratio': style.ratio }} />
      ))}
    </span>
  );
}

function PeopleSkeleton() {
  return (
    <SkeletonRegion label="Loading people" className="people-sk">
      {[3, 1, 3].map((rows, g) => (
        <div key={g} className="pg pg--sk">
          <div className="pg-head">
            <SkeletonLine width={140} size="lg" />
            <SkeletonLine width={64} size="sm" />
          </div>
          <div className="pg-sk-rows">
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} className="pg-sk-row">
                <SkeletonCircle size={36} />
                <SkeletonBlock width={180} height={36} radius={10} />
                <SkeletonLine width={170} size="sm" />
                <SkeletonBlock width={190} height={36} radius={10} />
                <SkeletonBlock width={56} height={22} radius={999} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </SkeletonRegion>
  );
}

/**
 * /admin/people (update v4, file 07): one section per group, in this order: Admin, then
 * each tracker by roles.sort_order (future trackers appear automatically), then No role
 * (highlighted when someone is waiting). Rows: photo (with the photo menu), display name,
 * email, role, active. Changing a role moves the row into its new group right away.
 * Inactive people stay in their group, dimmed and labelled. Changes are logged in Activity Logs.
 */
export function PeoplePage() {
  const api = useApi();
  const app = useAppData();
  const { profile, reloadProfile } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [people, setPeople] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const r = await api.listPeople();
    if (r.error) setError(friendlyError(r.error));
    else {
      setPeople(r.data ?? []);
      setError(null);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const roles = useMemo(() => [...app.roles].sort((a, b) => a.sort_order - b.sort_order), [app.roles]);

  async function save(person, patch) {
    const self = person.id === profile?.id;
    if (self && 'role_id' in patch && patch.role_id !== person.role_id) {
      const ok = await confirm({
        title: 'Change your own role?',
        body: 'If your new role is not Admin, you lose Admin access (targets, People, every tracker) as soon as it saves.',
        confirmLabel: 'Change my role',
        tone: 'danger',
      });
      if (!ok) return false;
    }
    if (self && patch.is_active === false) {
      const ok = await confirm({
        title: 'Deactivate your own account?',
        body: 'You will be locked out right away, and only another Admin could turn it back on.',
        confirmLabel: 'Deactivate me',
        tone: 'danger',
      });
      if (!ok) return false;
    }
    const r = await api.updatePerson(person.id, patch);
    if (r.error) {
      toast(friendlyError(r.error), { tone: 'danger', duration: 6000 });
      return false;
    }
    setPeople((list) => list.map((p) => (p.id === person.id ? r.data : p)));
    if ('role_id' in patch && patch.role_id !== person.role_id) {
      const role = roles.find((x) => x.id === r.data.role_id);
      toast(role ? `${r.data.display_name} moved to ${role.name}` : `${r.data.display_name} no longer has a role`);
    } else toast(`Saved ${r.data.display_name}`);
    app.reloadPeople();
    if (self) reloadProfile();
    return true;
  }

  // Admin · each tracker (roles.sort_order) · No role (always last)
  const groups = useMemo(() => {
    if (!people) return [];
    const byRole = new Map();
    for (const p of people) {
      const key = p.role_id && roles.some((r) => r.id === p.role_id) ? p.role_id : NO_ROLE;
      if (!byRole.has(key)) byRole.set(key, []);
      byRole.get(key).push(p);
    }
    const sortPeople = (list) =>
      [...list].sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.display_name.localeCompare(b.display_name));
    return [
      ...roles.map((role) => ({ key: role.id, role, name: role.name, people: sortPeople(byRole.get(role.id) ?? []) })),
      { key: NO_ROLE, role: null, name: 'No role', people: sortPeople(byRole.get(NO_ROLE) ?? []) },
    ];
  }, [people, roles]);

  const needRole = groups.find((g) => g.key === NO_ROLE)?.people.length ?? 0;

  return (
    <div className="people-page">
      <PageHeader title="People" />

      <div className="people-intro">
        <p>
          A role is access to one tracker. To move someone to another brand, change their role: their row moves to the
          new group. To remove access, turn Active off (don't delete accounts: their items and history stay theirs).
        </p>
        <p className="dim">
          New accounts are created in the Supabase dashboard (Authentication → Users → Add user). They appear under No
          role until you give them one. Every change here is recorded in Activity Logs.
        </p>
      </div>

      {error && (
        <div className="notice notice-danger" role="alert">
          {error}
        </div>
      )}
      {!people && !error && <PeopleSkeleton />}

      {people && (
        <FadeIn className="people-groups">
          {groups.map((group) => {
            const isNoRole = group.key === NO_ROLE;
            if (isNoRole && group.people.length === 0) return null;
            const brands = group.role && !group.role.is_admin ? app.brandsForRole(group.role.id) : [];
            const inactive = group.people.filter((p) => !p.is_active).length;
            const headId = `pg-${group.key}`;
            return (
              <section key={group.key} className={`pg${isNoRole ? ' pg--norole' : ''}`} aria-labelledby={headId}>
                <header className="pg-head">
                  <h2 id={headId} className="pg-name">
                    {isNoRole && <IconAlert width={16} height={16} />}
                    {group.name}
                  </h2>
                  <GroupLogos group={group} brands={brands} />
                  <p className="pg-count">
                    {isNoRole
                      ? `${needRole === 1 ? '1 person needs' : `${needRole} people need`} a role`
                      : `${group.people.length} ${group.people.length === 1 ? 'person' : 'people'}${inactive ? ` · ${inactive} inactive` : ''}`}
                  </p>
                </header>
                {group.people.length === 0 ? (
                  <p className="pg-empty">Nobody in this tracker yet. Give someone this role below.</p>
                ) : (
                  <div className="table-wrap people-wrap">
                    <table className="table people-table">
                      <colgroup>
                        <col style={{ width: 290 }} />
                        <col style={{ width: 260 }} />
                        <col style={{ width: 240 }} />
                        <col style={{ width: 130 }} />
                      </colgroup>
                      <thead className="sr-only-head">
                        <tr>
                          <th scope="col">Display name</th>
                          <th scope="col">Email</th>
                          <th scope="col">Role</th>
                          <th scope="col">Active</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.people.map((person) => (
                          <tr key={person.id} className={person.is_active ? '' : 'is-inactive'}>
                            <td>
                              <div className="people-who">
                                <AvatarEditor personId={person.id} size={36} />
                                <NameInput person={person} onSave={(patch) => save(person, patch)} />
                                {!person.is_active && <span className="badge people-inactive">Inactive</span>}
                              </div>
                            </td>
                            <td>
                              <span className="cell-text dim" title={person.email}>
                                {person.email}
                              </span>
                              {person.id === profile?.id && <span className="badge people-you">You</span>}
                            </td>
                            <td>
                              <select
                                className={`select people-role${person.role_id ? '' : ' needs-role'}`}
                                value={person.role_id ?? ''}
                                aria-label={`Role for ${person.display_name}`}
                                onChange={(e) => save(person, { role_id: e.target.value || null })}
                              >
                                <option value="">No role</option>
                                {roles.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <label className="switch">
                                <input type="checkbox" checked={person.is_active} onChange={(e) => save(person, { is_active: e.target.checked })} />
                                <span className="switch-track" aria-hidden="true" />
                                <span className="sr-only">Active: {person.display_name}</span>
                                <span aria-hidden="true">{person.is_active ? 'On' : 'Off'}</span>
                              </label>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
        </FadeIn>
      )}
    </div>
  );
}
