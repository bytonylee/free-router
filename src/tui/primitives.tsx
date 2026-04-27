import { useState, type ReactNode } from "react";
import { Text, Box, useInput } from "ink";

type SelectOption = { label: string; value: string };

export function Select({
  options,
  onChange,
}: {
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  const [idx, setIdx] = useState(0);

  useInput((input, key) => {
    if (options.length === 0) return;
    if (key.upArrow || (key.ctrl && input === "p")) {
      setIdx((i) => (i - 1 + options.length) % options.length);
    } else if (key.downArrow || (key.ctrl && input === "n")) {
      setIdx((i) => (i + 1) % options.length);
    } else if (key.return) {
      const safeIdx = Math.min(idx, options.length - 1);
      onChange(options[safeIdx].value);
    }
  });

  return (
    <Box flexDirection="column">
      {options.map((opt, i) => (
        <Text key={opt.value} color={i === idx ? "cyan" : undefined}>
          {i === idx ? "❯ " : "  "}
          {opt.label}
        </Text>
      ))}
    </Box>
  );
}

export function PasswordInput({
  placeholder,
  onSubmit,
}: {
  placeholder?: string;
  onSubmit: (value: string) => void;
}) {
  const [buf, setBuf] = useState("");

  useInput((input, key) => {
    if (key.return) {
      onSubmit(buf);
      return;
    }
    if (key.escape) {
      onSubmit("");
      return;
    }
    if (key.backspace || key.delete) {
      setBuf((b) => b.slice(0, -1));
      return;
    }
    if (key.ctrl || key.meta) return;
    if (!input) return;
    if (input.length === 1 && input < " ") return;
    setBuf((b) => b + input);
  });

  if (buf) {
    return <Text color="cyan">{"•".repeat(buf.length)}</Text>;
  }
  return <Text dimColor>{placeholder ?? ""}</Text>;
}

type StatusVariant = "success" | "error" | "warning" | "info";

export function StatusMessage({
  variant,
  children,
}: {
  variant: StatusVariant;
  children: ReactNode;
}) {
  const color =
    variant === "success"
      ? "green"
      : variant === "error"
        ? "red"
        : variant === "warning"
          ? "yellow"
          : "blue";
  const icon =
    variant === "success"
      ? "✓"
      : variant === "error"
        ? "✗"
        : variant === "warning"
          ? "!"
          : "i";
  return (
    <Text color={color}>
      {icon} {children}
    </Text>
  );
}
