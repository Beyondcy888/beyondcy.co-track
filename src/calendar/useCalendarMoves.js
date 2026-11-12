// What happens when something is dropped on another day (update v3, file 05 §3).
//   content: staff in their own tracker, Admin everywhere; Uploaded content is locked
//   projects: only Admin (it changes the deadline)
// The chip moves at once (optimistic), then saves; the toast offers Undo for 8 seconds.
// If saving fails the chip goes back and the database's message is shown.
import { useCallback, useMemo } from 'react';
import { useTracker } from '../data/TrackerProvider.jsx';
import { friendlyError } from '../lib/errors.js';
import { formatDropDate, shortTitle } from '../lib/week.js';
import { projectError, useProjects } from '../projects/ProjectsProvider.jsx';
import { useToast } from '../ui/Toast.jsx';

const UNDO_MS = 8000;
export const LOCKED_HINT = "Uploaded content can't be moved";

export function useCalendarMoves() {
  const t = useTracker();
  const ps = useProjects();
  const toast = useToast();
  const { moveItem: saveItemDate } = t;
  const { setDueDate, isAdmin } = ps;

  const moveItem = useCallback(
    async (item, date) => {
      const from = item.publish_date ?? null;
      if (from === date) return;
      const title = shortTitle(item.content);
      const r = await saveItemDate(item.id, date);
      if (r.error) {
        toast(friendlyError(r.error), { tone: 'danger', duration: 6500 });
        return;
      }
      const message = date
        ? `Moved "${title}" to ${formatDropDate(date)}`
        : `Removed the date from "${title}".${item.status === 'planned' ? " It's back to Not started." : ''}`;
      toast(message, {
        duration: UNDO_MS,
        action: {
          label: 'Undo',
          onClick: async () => {
            const u = await saveItemDate(item.id, from);
            if (u.error) toast(friendlyError(u.error), { tone: 'danger', duration: 6500 });
            else toast(from ? `"${title}" is back on ${formatDropDate(from)}` : `"${title}" has no date again`);
          },
        },
      });
    },
    [saveItemDate, toast],
  );

  const moveProject = useCallback(
    async (project, date) => {
      const from = project.due_date;
      if (!date || from === date) return;
      const r = await setDueDate(project.id, date);
      if (r.error) {
        toast(projectError(r.error), { tone: 'danger', duration: 6500 });
        return;
      }
      toast(`Project deadline moved to ${formatDropDate(date)}`, {
        duration: UNDO_MS,
        action: {
          label: 'Undo',
          onClick: async () => {
            const u = await setDueDate(project.id, from);
            if (u.error) toast(projectError(u.error), { tone: 'danger', duration: 6500 });
            else toast(`Project deadline is back on ${formatDropDate(from)}`);
          },
        },
      });
    },
    [setDueDate, toast],
  );

  const denied = useCallback(() => toast(LOCKED_HINT, { duration: 2600 }), [toast]);

  return useMemo(
    () => ({
      /** Not started and Planned content can move; Uploaded is locked. */
      canMoveItem: (item) => item.status !== 'uploaded',
      canMoveProject: isAdmin,
      moveItem,
      moveProject,
      denied,
    }),
    [isAdmin, moveItem, moveProject, denied],
  );
}
