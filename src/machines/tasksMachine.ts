import { assign, fromPromise, setup } from "xstate";
import { api, type ScheduledTask } from "../api/client";

type TasksContext = {
  tasks: ScheduledTask[];
  error: string | null;
  runningTaskId: string | null;
};

type TasksEvent =
  | { type: "refresh" }
  | { type: "run"; taskId: string }
  | { type: "dismissError" };

type EventWithOutput<T> = {
  output: T;
};

function getEventOutput<T>(event: unknown): T | null {
  if (!event || typeof event !== "object" || !("output" in event)) return null;
  return (event as EventWithOutput<T>).output;
}

function getErrorMessage(event: unknown, fallback: string) {
  if (!event || typeof event !== "object" || !("error" in event)) return fallback;
  const err = (event as { error?: unknown }).error;
  return err instanceof Error ? err.message : fallback;
}

export const tasksMachine = setup({
  types: {
    context: {} as TasksContext,
    events: {} as TasksEvent
  },
  actors: {
    loadTasks: fromPromise(async () => api.tasks()),
    runTask: fromPromise(async ({ input }: { input: { taskId: string } }) => {
      await api.runTask(input.taskId);
      return api.tasks();
    })
  },
  actions: {
    applyTasks: assign(({ event }) => {
      const output = getEventOutput<{ tasks: ScheduledTask[] }>(event);
      if (!output) return {};
      return {
        tasks: output.tasks,
        error: null,
        runningTaskId: null
      };
    }),
    setError: assign(({ event }) => ({
      error: getErrorMessage(event, "Could not load scheduled tasks."),
      runningTaskId: null
    })),
    setRunningTask: assign(({ event }) => {
      if (event.type !== "run") return {};
      return {
        runningTaskId: event.taskId,
        error: null
      };
    }),
    clearError: assign({
      error: null
    })
  }
}).createMachine({
  id: "tasks",
  initial: "loading",
  context: {
    tasks: [],
    error: null,
    runningTaskId: null
  },
  on: {
    dismissError: {
      actions: "clearError"
    }
  },
  states: {
    loading: {
      invoke: {
        src: "loadTasks",
        onDone: {
          target: "ready.idle",
          actions: "applyTasks"
        },
        onError: {
          target: "loadFailed",
          actions: "setError"
        }
      }
    },
    loadFailed: {
      on: {
        refresh: {
          target: "loading",
          actions: "clearError"
        }
      }
    },
    ready: {
      initial: "idle",
      states: {
        idle: {
          on: {
            refresh: "refreshing",
            run: {
              target: "running",
              actions: "setRunningTask"
            }
          }
        },
        refreshing: {
          invoke: {
            src: "loadTasks",
            onDone: {
              target: "idle",
              actions: "applyTasks"
            },
            onError: {
              target: "idle",
              actions: "setError"
            }
          }
        },
        running: {
          invoke: {
            src: "runTask",
            input: ({ context }) => ({ taskId: context.runningTaskId ?? "" }),
            onDone: {
              target: "idle",
              actions: "applyTasks"
            },
            onError: {
              target: "idle",
              actions: "setError"
            }
          }
        }
      }
    }
  }
});
