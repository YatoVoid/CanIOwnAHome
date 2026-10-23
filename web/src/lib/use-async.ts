"use client";

import { useCallback, useEffect, useState } from "react";

export type AsyncState<T> =
  | { status: "loading" }
  | { status: "done"; data: T }
  | { status: "error"; error: string };

/** Runs `load` on mount and whenever `key` changes; `retry` runs it again. */
export function useAsync<T>(load: () => Promise<T>, key: string) {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the loading state again when the request changes
    setState({ status: "loading" });
    load().then(
      (data) => !cancelled && setState({ status: "done", data }),
      (err: unknown) =>
        !cancelled && setState({ status: "error", error: err instanceof Error ? err.message : "Something went wrong" }),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` identifies the request
  }, [key, attempt]);

  return { state, retry: useCallback(() => setAttempt((n) => n + 1), []) };
}
