import React from "react";
import { FONT } from "../font";

export type TextRole = "title" | "subtitle" | "body" | "small";

const SIZE: Record<TextRole, number> = {
  title: 92,
  subtitle: 64,
  body: 52,
  small: 36,
};

export function BigText({
  children,
  role = "title",
  size,
}: {
  children: React.ReactNode;
  role?: TextRole;
  size?: number;
}) {
  return (
    <div
      style={{
        fontFamily: FONT,
        whiteSpace: "pre-line",
        wordBreak: "break-word",
        fontSize: size ?? SIZE[role],
        lineHeight: 1.16,
        fontWeight: 900,
        letterSpacing: 0,
        color: "inherit",
      }}
    >
      {children}
    </div>
  );
}
