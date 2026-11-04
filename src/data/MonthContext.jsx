import { createContext, useContext, useMemo, useState } from 'react';
import { currentMonthWIB, shiftMonth } from '../lib/time.js';

// One shared month for the whole app: the progress module, the table's month
// scope and the calendar always show the same month (02 §6).
const MonthContext = createContext(null);

export function MonthProvider({ children }) {
  const [month, setMonth] = useState(() => currentMonthWIB());
  const value = useMemo(
    () => ({
      month,
      setMonth,
      prev: () => setMonth((m) => shiftMonth(m, -1)),
      next: () => setMonth((m) => shiftMonth(m, 1)),
      goToday: () => setMonth(currentMonthWIB()),
    }),
    [month],
  );
  return <MonthContext.Provider value={value}>{children}</MonthContext.Provider>;
}

export function useMonth() {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error('useMonth must be used inside MonthProvider');
  return ctx;
}
