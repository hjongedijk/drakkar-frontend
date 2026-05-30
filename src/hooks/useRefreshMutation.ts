import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../components/ToastProvider";

export function useRefreshMutation<TArgs, TResult>(
  mutationFn: (args: TArgs) => Promise<TResult>,
  keys: unknown[][],
  messages?: { success?: string | ((result: TResult) => string); error?: string }
) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  return useMutation({
    mutationFn,
    onSuccess: (result) => {
      for (const key of keys) void queryClient.invalidateQueries({ queryKey: key });
      if (messages?.success) notify(typeof messages.success === "function" ? messages.success(result) : messages.success, "success");
    },
    onError: (error) => {
      notify(error instanceof Error ? error.message : messages?.error ?? "Action failed", "error");
    }
  });
}
