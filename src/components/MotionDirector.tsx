"use client";

import { useLayoutEffect, useRef } from "react";
import { motionEvents, parseSnapshot, type MotionEvents, type SeenSnapshot } from "@/components/motion-events";

export interface MotionDirectorProps {
  projectId: string;
  snapshot: string; // JSON SeenSnapshot of what the server just rendered
}

const LIFT_MS = 1500;
const PRINT_MS = 600;
const FEED_MS = 1200;

const storageKey = (projectId: string) => `tollgate:seen:${projectId}`;

function readStored(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null; // storage blocked (private window, previews): no animation, the page still shows the state
  }
}

function store(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignored for the same reason
  }
}

// Sets data-fx on the elements the CSS animates, and takes it off once the animation is over, so a later
// refresh never replays it. Returns a function that stops it early.
function play(events: MotionEvents): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  const marked: Element[] = [];
  const mark = (el: Element, fx: string, ms: number) => {
    el.setAttribute("data-fx", fx);
    marked.push(el);
    timers.push(setTimeout(() => el.removeAttribute("data-fx"), ms));
  };
  const byOrder = (id: string) => document.querySelectorAll(`[data-fx-order="${CSS.escape(id)}"]`);

  for (const id of events.lift) byOrder(id).forEach((el) => mark(el, "lift", LIFT_MS));
  for (const id of events.print) document.querySelectorAll(`.ticket[data-fx-order="${CSS.escape(id)}"]`).forEach((el) => mark(el, "print", PRINT_MS));
  if (events.paid) document.querySelectorAll("[data-fx-total]").forEach((el) => mark(el, "settle", LIFT_MS));
  if (events.launchMoved) document.querySelectorAll("[data-fx-launch]").forEach((el) => mark(el, "flip", LIFT_MS));
  if (events.activityAfter !== null) {
    const after = events.activityAfter;
    let i = 0;
    document.querySelectorAll<HTMLElement>("[data-fx-activity]").forEach((el) => {
      if (Number(el.dataset.fxActivity) <= after) return;
      el.style.setProperty("--fx-i", String(i++));
      mark(el, "in", FEED_MS + i * 60);
    });
  }
  return () => {
    for (const t of timers) clearTimeout(t);
    for (const el of marked) el.removeAttribute("data-fx");
  };
}

// Plays the one-off transitions the server can't: a ticket that just turned paid lifts its barrier, a new draft
// prints, new activity slides in. It compares what the server rendered with what this tab last drew. A layout
// effect, so the first frame of a refreshed screen already starts the animation instead of flashing the end state.
// Under prefers-reduced-motion nothing is marked: the new state simply shows.
export function MotionDirector({ projectId, snapshot }: MotionDirectorProps) {
  // The snapshot this effect last compared against, so running it twice for the same render (React's development
  // double-run) compares with the same earlier screen instead of the one it just stored.
  const compared = useRef<{ key: string; snapshot: string; before: SeenSnapshot | null } | null>(null);

  useLayoutEffect(() => {
    const key = storageKey(projectId);
    const now = parseSnapshot(snapshot);
    if (!now) return;
    const same = compared.current?.key === key && compared.current.snapshot === snapshot;
    const before = same && compared.current ? compared.current.before : parseSnapshot(readStored(key));
    compared.current = { key, snapshot, before };
    store(key, snapshot);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    return play(motionEvents(before, now));
  }, [projectId, snapshot]);

  return null;
}
