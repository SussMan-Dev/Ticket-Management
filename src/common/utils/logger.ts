type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

const sensitiveKeyPattern = /authorization|cookie|password|secret|token/i;

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        sensitiveKeyPattern.test(key) ? "[REDACTED]" : redactValue(nestedValue),
      ]),
    );
  }

  return value;
}

function write(level: LogLevel, message: string, context: LogContext = {}): void {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...redactValue(context) as LogContext,
  });

  if (level === "error") {
    console.error(entry);
    return;
  }

  if (level === "warn") {
    console.warn(entry);
    return;
  }

  console.log(entry);
}

export const logger = {
  debug: (message: string, context?: LogContext): void => write("debug", message, context),
  info: (message: string, context?: LogContext): void => write("info", message, context),
  warn: (message: string, context?: LogContext): void => write("warn", message, context),
  error: (message: string, context?: LogContext): void => write("error", message, context),
};
