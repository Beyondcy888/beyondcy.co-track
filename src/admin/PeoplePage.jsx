import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.js';
import { useApi } from '../data/ApiContext.js';
import { useAppData } from '../data/AppDataProvider.jsx';
import { PageHeader } from '../layout/PageHeader.jsx';
import { friendlyError } from '../lib/errors.js';
import { useConfirm } from '../ui/Confirm.jsx';
import { useToast } from '../ui/Toast.jsx';
import { Spinner } from '../ui/bits.jsx';

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

/**
 * /admin/people: display name, email (read-only), role, active.
 * Changing someone's role is how brands "roll" between people.
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
    toast(`Saved ${r.data.display_name}`);
    app.reloadPeople();
    if (self) reloadProfile();
    return true;
  }

  const roles = [...app.roles].sort((a, b) => a.sort_order - b.sort_order);
  const needRole = people?.filter((p) => !p.role_id).length ?? 0;

  return (
    <div className="people-page">
      <PageHeader title="People" />

      <div className="people-intro">
        <p>
          A role is access to one tracker. To move someone to another brand, change their role. To remove access,
          turn Active off (don't delete accounts: their items and history stay theirs).
        </p>
        <p className="dim">
          New accounts are created in the Supabase dashboard (Authentication → Users → Add user). They appear here
          without a role until you give them one.
        </p>
      </div>

      {error && (
        <div className="notice notice-danger" role="alert">
          {error}
        </div>
      )}
      {!people && !error && (
        <div className="loading-block">
          <Spinner label="Loading people" /> Loading people
        </div>
      )}

      {people && (
        <>
          {needRole > 0 && (
            <p className="people-needs">
              {needRole === 1 ? 'One person needs' : `${needRole} people need`} a role.
            </p>
          )}
          <div className="table-wrap people-wrap">
            <table className="table people-table">
              <colgroup>
                <col style={{ width: 220 }} />
                <col style={{ width: 260 }} />
                <col style={{ width: 240 }} />
                <col style={{ width: 120 }} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Display name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Active</th>
                </tr>
              </thead>
              <tbody>
                {people.map((person) => (
                  <tr key={person.id} className={person.is_active ? '' : 'is-inactive'}>
                    <td>
                      <NameInput person={person} onSave={(patch) => save(person, patch)} />
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
                        <input
                          type="checkbox"
                          checked={person.is_active}
                          onChange={(e) => save(person, { is_active: e.target.checked })}
                        />
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
        </>
      )}
    </div>
  );
}
