// The sidebar's three behaviours (09_UPDATE_V2.md §4), like Notion:
//   pinned → part of the layout; hidden → content takes the full width;
//   peek   → while hidden, holding the cursor at the far left edge slides it in as an overlay.
// Phones (≤720px) and touch screens have no hover: the header button opens it as a drawer.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useMediaQuery } from '../data/useMediaQuery.js';

const KEY = 'byc.sidebar';
const PEEK_IN_MS = 120;
const PEEK_OUT_MS = 300;

export const SidebarContext = createContext(null);

function readPinned() {
  try {
    return localStorage.getItem(KEY) !== 'hidden';
  } catch {
    return true;
  }
}

function writePinned(pinned) {
  try {
    localStorage.setItem(KEY, pinned ? 'pinned' : 'hidden');
  } catch {
    /* private mode or blocked storage: the choice just isn't remembered */
  }
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useSidebarController() {
  const [pinned, setPinnedState] = useState(readPinned);
  const [peek, setPeek] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const mobile = useMediaQuery('(max-width: 720px)');
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)');
  const sidebarRef = useRef(null);
  const focusInto = useRef(false);
  const focusOut = useRef(false);
  const inTimer = useRef(null);
  const outTimer = useRef(null);

  const clearTimers = () => {
    clearTimeout(inTimer.current);
    clearTimeout(outTimer.current);
  };

  const setPinned = useCallback((next, { keyboard = false } = {}) => {
    clearTimers();
    const el = sidebarRef.current;
    if (!next && el && el.contains(document.activeElement)) focusOut.current = true;
    if (next && keyboard) focusInto.current = true;
    setPinnedState(next);
    writePinned(next);
    setPeek(false);
  }, []);

  const openDrawer = useCallback((open, { keyboard = false } = {}) => {
    if (open && keyboard) focusInto.current = true;
    if (!open && sidebarRef.current?.contains(document.activeElement)) focusOut.current = true;
    setDrawer(open);
  }, []);

  /** The toggle button / Ctrl+\: pin ↔ hide on desktop (from a peek: pin), open ↔ close on phones. */
  const toggle = useCallback(
    ({ keyboard = false } = {}) => {
      if (mobile) openDrawer(!drawer, { keyboard });
      else setPinned(!pinned, { keyboard });
    },
    [mobile, drawer, pinned, openDrawer, setPinned],
  );

  // Ctrl+\ (Cmd+\ on Mac)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '\\' || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      e.preventDefault();
      toggle({ keyboard: true });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  // Esc closes the peek or the drawer
  useEffect(() => {
    if (!peek && !drawer) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('dialog[open]')) return; // a modal (item drawer, confirm) handles its own Esc
      if (sidebarRef.current?.contains(document.activeElement)) focusOut.current = true;
      clearTimers();
      if (drawer) setDrawer(false);
      else setPeek(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [peek, drawer]);

  // the phone drawer closes when the layout leaves phone width
  useEffect(() => {
    if (!mobile) setDrawer(false);
  }, [mobile]);

  useEffect(() => () => clearTimers(), []);

  // focus: into the sidebar when it was opened by keyboard; back to the header toggle when it hides
  useEffect(() => {
    if (focusInto.current) {
      focusInto.current = false;
      requestAnimationFrame(() => sidebarRef.current?.querySelector('.sidebar-nav')?.querySelector(FOCUSABLE)?.focus());
    } else if (focusOut.current) {
      focusOut.current = false;
      // the visible one: the phone top bar's button, or the page header's "Show sidebar"
      requestAnimationFrame(() =>
        [...document.querySelectorAll('[data-sidebar-toggle="outside"]')].find((el) => el.offsetParent !== null)?.focus(),
      );
    }
  }, [pinned, drawer, peek]);

  // ------------------------------------------------------------ peek (hover devices, desktop, hidden)
  const peekAllowed = !pinned && !mobile && canHover;

  const edgeEnter = useCallback(() => {
    clearTimeout(outTimer.current);
    clearTimeout(inTimer.current);
    inTimer.current = setTimeout(() => setPeek(true), PEEK_IN_MS);
  }, []);
  const edgeLeave = useCallback(() => clearTimeout(inTimer.current), []);
  const panelEnter = useCallback(() => clearTimeout(outTimer.current), []);
  const panelLeave = useCallback(() => {
    clearTimeout(outTimer.current);
    outTimer.current = setTimeout(() => setPeek(false), PEEK_OUT_MS);
  }, []);

  useEffect(() => {
    if (!peekAllowed) setPeek(false);
  }, [peekAllowed]);

  const shown = mobile ? drawer : pinned || peek;

  return useMemo(
    () => ({
      pinned,
      peek: peek && peekAllowed,
      drawer,
      mobile,
      peekAllowed,
      shown,
      sidebarRef,
      toggle,
      setPinned,
      openDrawer,
      edgeEnter,
      edgeLeave,
      panelEnter,
      panelLeave,
    }),
    [pinned, peek, peekAllowed, drawer, mobile, shown, toggle, setPinned, openDrawer, edgeEnter, edgeLeave, panelEnter, panelLeave],
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
