"use client";

import { useEffect, useRef, type ReactNode } from "react";

export interface ThreadScrollProps {
  count: number; // messages in the thread; a new one scrolls to it
  className?: string;
  children: ReactNode;
}

// The message list, which scrolls on its own on a wide screen. Like any chat, it opens at the latest message (the one
// the newest ticket came from) and follows new ones. Nothing happens when the list doesn't scroll (a phone).
export function ThreadScroll({ count, className = "", children }: ThreadScrollProps) {
  const ref = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const list = ref.current;
    if (!list || window.location.hash) return; // a link into the page decides where it opens
    list.scrollTop = list.scrollHeight;
  }, [count]);

  return (
    <ol ref={ref} className={className}>
      {children}
    </ol>
  );
}
