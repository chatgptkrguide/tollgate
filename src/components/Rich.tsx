import { Fragment, type ReactNode } from "react";
import type { RichPart } from "@/i18n/t";

interface RichProps {
  parts: readonly RichPart[]; // from tRich()
  link?: (text: string) => ReactNode; // draws a <link> part; without it the words show as plain text
  boldClassName?: string;
}

// A translated text with its marks drawn: <b> bold, <link> through `link`, <nowrap> kept on one line, <sr> for screen
// readers only. Each part starts at a different offset in the text, which makes a stable key.
export function Rich({ parts, link, boldClassName }: RichProps) {
  const offsets: number[] = [];
  let at = 0;
  for (const part of parts) {
    offsets.push(at);
    at += part.text.length;
  }
  return (
    <>
      {parts.map((part, i) => {
        const key = `${part.tag ?? "text"}-${offsets[i]}`;
        switch (part.tag) {
          case "b":
            return (
              <b key={key} className={boldClassName}>
                {part.text}
              </b>
            );
          case "link":
            return <Fragment key={key}>{link ? link(part.text) : part.text}</Fragment>;
          case "nowrap":
            return (
              <span key={key} className="whitespace-nowrap">
                {part.text}
              </span>
            );
          case "sr":
            return (
              <span key={key} className="sr-only">
                {part.text}
              </span>
            );
          default:
            return <Fragment key={key}>{part.text}</Fragment>;
        }
      })}
    </>
  );
}
