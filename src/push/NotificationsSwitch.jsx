// The "Notifications" switch in each person's menu (update v4, file 06): On / Off /
// "Blocked in browser settings" / "Not available here". No how-to text (the owner explains
// adding the tracker to the home screen). It applies to this device.
import { useEffect, useState } from 'react';
import { useApi } from '../data/ApiContext.js';
import { friendlyError } from '../lib/errors.js';
import { useToast } from '../ui/Toast.jsx';
import { IconBell } from '../ui/icons.jsx';
import { pushState, turnOff, turnOn } from './push.js';

const NOTE = {
  blocked: 'Blocked in browser settings',
  unsupported: 'Not available here',
};

export function NotificationsSwitch() {
  const api = useApi();
  const toast = useToast();
  const [state, setState] = useState(null); // null while checking
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    pushState().then((s) => live && setState(s));
    return () => {
      live = false;
    };
  }, []);

  const usable = state === 'on' || state === 'off';
  const toggle = async () => {
    if (!usable || busy) return;
    setBusy(true);
    const r = state === 'on' ? await turnOff(api) : await turnOn(api);
    setBusy(false);
    setState(r.state);
    if (r.error) toast(friendlyError(r.error), { tone: 'danger', duration: 6000 });
    else if (r.state === 'on') toast('Notifications are on for this device');
    else if (r.state === 'off' && state === 'on') toast('Notifications are off for this device');
  };

  return (
    <div className={`notif-row${usable ? '' : ' is-disabled'}`}>
      <IconBell width={16} height={16} className="notif-icon" />
      <span className="notif-text">
        <span className="notif-label" id="notif-label">
          Notifications
        </span>
        <span className="notif-note">{state == null ? 'Checking…' : NOTE[state] ?? (state === 'on' ? 'On for this device' : 'Off')}</span>
      </span>
      <button
        type="button"
        role="switch"
        className="notif-switch"
        aria-checked={state === 'on'}
        aria-labelledby="notif-label"
        disabled={!usable || busy}
        onClick={toggle}
      >
        <span className="notif-track" aria-hidden="true" />
      </button>
    </div>
  );
}
