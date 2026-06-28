import { useState, useCallback } from 'react';

export interface MutationOptions<TData, TVars, TSnapshot = unknown> {
  /**
   * Called immediately before the mutation fires.
   * Apply the optimistic update here and return a snapshot for rollback.
   */
  onMutate?: (vars: TVars) => TSnapshot | Promise<TSnapshot>;

  /**
   * Called when the server responds with an error.
   * Use the snapshot to rollback the optimistic update.
   */
  onError?: (error: unknown, vars: TVars, snapshot: TSnapshot | undefined) => void;

  /**
   * Called when the mutation succeeds.
   * Typically used to invalidate queries.
   */
  onSuccess?: (data: TData, vars: TVars) => void;
}

// Overloads: when TVars is void the caller passes no argument.
export function useMutation<TData>(
  mutationFn: () => Promise<TData>,
  options?: MutationOptions<TData, void>
): { mutate: () => void; mutateAsync: () => Promise<TData>; isPending: boolean; error: unknown };

export function useMutation<TData, TVars>(
  mutationFn: (vars: TVars) => Promise<TData>,
  options?: MutationOptions<TData, TVars>
): { mutate: (vars: TVars) => void; mutateAsync: (vars: TVars) => Promise<TData>; isPending: boolean; error: unknown };

// Implementation
export function useMutation<TData, TVars = void>(
  mutationFn: (vars: TVars) => Promise<TData>,
  options: MutationOptions<TData, TVars, unknown> = {}
) {
  const { onMutate, onError, onSuccess } = options;
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const mutateAsync = useCallback(
    async (vars: TVars): Promise<TData> => {
      setIsPending(true);
      setError(null);

      let snapshot: unknown;
      if (onMutate) {
        snapshot = await onMutate(vars);
      }

      try {
        const data = await mutationFn(vars);
        if (onSuccess) onSuccess(data, vars);
        return data;
      } catch (err) {
        setError(err);
        if (onError) onError(err, vars, snapshot);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mutationFn, onMutate, onError, onSuccess]
  );

  const mutate = useCallback(
    (vars: TVars) => {
      mutateAsync(vars).catch(() => {
        // Error already stored in state and passed to onError; suppress unhandled rejection.
      });
    },
    [mutateAsync]
  );

  return { mutate, mutateAsync, isPending, error };
}
