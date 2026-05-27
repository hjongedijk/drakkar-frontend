import { assign, fromPromise, setup } from "xstate";
import { api, type CompleteSetupInput, type SetupStatus } from "../api/client";

export type SetupWizardForm = {
  username: string;
  displayName: string;
  password: string;
  confirmPassword: string;
  nzbhydraUrl: string;
  nzbhydraApiKey: string;
  tmdbApiKey: string;
  tvdbApiKey: string;
  plexServerUrl: string;
  plexToken: string;
  plexLibraryPath: string;
  plexSectionId: string;
  usenetName: string;
  usenetHost: string;
  usenetPort: string;
  usenetSsl: boolean;
  usenetUsername: string;
  usenetPassword: string;
  usenetConnections: string;
  requestProviderName: string;
  requestProviderUrl: string;
  requestProviderApiKey: string;
  requestProviderInterval: string;
};

export type PlexPin = {
  pinId: number;
  code: string;
  authUrl: string;
  clientIdentifier: string;
};

export type SetupWizardContext = {
  status: SetupStatus | null;
  form: SetupWizardForm;
  plexPin: PlexPin | null;
  message: string | null;
  error: string | null;
  saveSucceededAt: number | null;
};

type UpdateFieldEvent = {
  type: "updateField";
  field: keyof SetupWizardForm;
  value: string | boolean;
};

type SetupWizardEvent =
  | UpdateFieldEvent
  | { type: "refresh" }
  | { type: "save" }
  | { type: "startPlexOauth" }
  | { type: "dismissMessage" };

type EventWithOutput<T> = {
  output: T;
};

const initialForm: SetupWizardForm = {
  username: "admin",
  displayName: "Admin",
  password: "",
  confirmPassword: "",
  nzbhydraUrl: "",
  nzbhydraApiKey: "",
  tmdbApiKey: "",
  tvdbApiKey: "",
  plexServerUrl: "",
  plexToken: "",
  plexLibraryPath: "/mnt/media",
  plexSectionId: "",
  usenetName: "Primary",
  usenetHost: "",
  usenetPort: "563",
  usenetSsl: true,
  usenetUsername: "",
  usenetPassword: "",
  usenetConnections: "24",
  requestProviderName: "Seerr",
  requestProviderUrl: "",
  requestProviderApiKey: "",
  requestProviderInterval: "15"
};

function statusToForm(status: SetupStatus): SetupWizardForm {
  return {
    ...initialForm,
    nzbhydraUrl: status.prefill.nzbhydraUrl || "",
    nzbhydraApiKey: status.prefill.nzbhydraApiKey || "",
    tmdbApiKey: status.prefill.tmdbApiKey || "",
    tvdbApiKey: status.prefill.tvdbApiKey || "",
    plexServerUrl: status.prefill.plexServerUrl || "",
    plexToken: status.prefill.plexToken || "",
    plexLibraryPath: status.prefill.plexLibraryPath || "/mnt/media",
    plexSectionId: status.prefill.plexSectionId || "",
    usenetName: status.prefill.usenet?.name || "Primary",
    usenetHost: status.prefill.usenet?.host || "",
    usenetPort: String(status.prefill.usenet?.port ?? 563),
    usenetSsl: status.prefill.usenet?.ssl ?? true,
    usenetUsername: status.prefill.usenet?.username || "",
    usenetPassword: status.prefill.usenet?.password || "",
    usenetConnections: String(status.prefill.usenet?.connections ?? 24),
    requestProviderName: status.prefill.requestProvider?.name || "Seerr",
    requestProviderUrl: status.prefill.requestProvider?.baseUrl || "",
    requestProviderApiKey: status.prefill.requestProvider?.apiKey || "",
    requestProviderInterval: String(status.prefill.requestProvider?.syncIntervalMinutes ?? 15)
  };
}

function toSetupPayload(context: SetupWizardContext): CompleteSetupInput {
  const { form, status } = context;
  if (status?.adminRequired && form.password !== form.confirmPassword) {
    throw new Error("passwords do not match");
  }
  return {
    ...(status?.adminRequired
      ? {
          admin: {
            username: form.username,
            displayName: form.displayName,
            password: form.password
          }
        }
      : {}),
    settings: {
      nzbhydraUrl: form.nzbhydraUrl,
      nzbhydraApiKey: form.nzbhydraApiKey,
      tmdbApiKey: form.tmdbApiKey,
      tvdbApiKey: form.tvdbApiKey,
      plexServerUrl: form.plexServerUrl,
      plexToken: form.plexToken,
      plexLibraryPath: form.plexLibraryPath,
      plexSectionId: form.plexSectionId
    },
    ...(form.usenetHost
      ? {
          usenet: {
            name: form.usenetName,
            host: form.usenetHost,
            port: Number(form.usenetPort || 563),
            ssl: form.usenetSsl,
            username: form.usenetUsername,
            password: form.usenetPassword,
            connections: Number(form.usenetConnections || 24),
            priority: 0,
            enabled: true,
            isBackup: false
          }
        }
      : {}),
    ...(form.requestProviderUrl && form.requestProviderApiKey
      ? {
          requestProvider: {
            name: form.requestProviderName,
            baseUrl: form.requestProviderUrl,
            apiKey: form.requestProviderApiKey,
            enabled: true,
            syncIntervalMinutes: Number(form.requestProviderInterval || 15)
          }
        }
      : {})
  };
}

function getEventOutput<T>(event: unknown): T | null {
  if (!event || typeof event !== "object" || !("output" in event)) return null;
  return (event as EventWithOutput<T>).output;
}

export const setupWizardMachine = setup({
  types: {
    context: {} as SetupWizardContext,
    events: {} as SetupWizardEvent
  },
  actors: {
    loadStatus: fromPromise(async () => api.setupStatus()),
    startPlexOauth: fromPromise(async () => api.plexOauthStart()),
    pollPlexOauth: fromPromise(async ({ input }: { input: { pinId: number } }) => api.plexOauthPoll(input.pinId)),
    saveSetup: fromPromise(async ({ input }: { input: { context: SetupWizardContext } }) => api.completeSetup(toSetupPayload(input.context)))
  },
  guards: {
    hasPlexPin: ({ context }) => Boolean(context.plexPin?.pinId),
    plexAuthorized: ({ event }) => {
      const output = getEventOutput<{ authorized: boolean; token?: string }>(event);
      return Boolean(output?.authorized && output.token);
    }
  },
  actions: {
    applyStatus: assign(({ event }) => {
      const status = getEventOutput<SetupStatus>(event);
      if (!status) return {};
      return {
        status,
        form: statusToForm(status),
        error: null,
        message: null
      };
    }),
    setLoadError: assign(({ event }) => ({
      error: "error" in event && event.error instanceof Error ? event.error.message : "Could not load setup status."
    })),
    clearTransientMessage: assign({
      error: null,
      message: null
    }),
    updateField: assign(({ context, event }) => {
      if (event.type !== "updateField") return {};
      return {
        form: {
          ...context.form,
          [event.field]: event.value
        } as SetupWizardForm
      };
    }),
    setPlexPin: assign(({ event }) => {
      const output = getEventOutput<PlexPin>(event);
      if (!output) return {};
      return {
        plexPin: output,
        message: `Plex PIN ${output.code} opened in a new tab. Approve it and Drakkar will detect the token automatically.`,
        error: null
      };
    }),
    setPlexStartError: assign(({ event }) => ({
      error: "error" in event && event.error instanceof Error ? event.error.message : "Could not start Plex OAuth"
    })),
    applyPlexToken: assign(({ context, event }) => {
      const output = getEventOutput<{ authorized: boolean; token?: string }>(event);
      if (!output?.token) return {};
      return {
        form: {
          ...context.form,
          plexToken: output.token
        },
        plexPin: null,
        message: "Plex token received.",
        error: null
      };
    }),
    setSaveError: assign(({ event }) => ({
      error: "error" in event && event.error instanceof Error ? event.error.message : "Could not complete setup"
    })),
    markSaveSuccess: assign({
      saveSucceededAt: () => Date.now(),
      error: null,
      message: () => "Setup saved. Log in with admin user."
    }),
    dismissMessage: assign({
      message: null,
      error: null
    })
  }
}).createMachine({
  id: "setupWizard",
  initial: "loading",
  context: {
    status: null,
    form: initialForm,
    plexPin: null,
    message: null,
    error: null,
    saveSucceededAt: null
  },
  on: {
    updateField: {
      actions: "updateField"
    },
    dismissMessage: {
      actions: "dismissMessage"
    }
  },
  states: {
    loading: {
      invoke: {
        src: "loadStatus",
        onDone: {
          target: "ready",
          actions: "applyStatus"
        },
        onError: {
          target: "loadFailed",
          actions: "setLoadError"
        }
      }
    },
    loadFailed: {
      on: {
        refresh: {
          target: "loading",
          actions: "clearTransientMessage"
        }
      }
    },
    ready: {
      type: "parallel",
      states: {
        submit: {
          initial: "idle",
          states: {
            idle: {
              on: {
                save: {
                  target: "saving",
                  actions: "clearTransientMessage"
                }
              }
            },
            saving: {
              invoke: {
                src: "saveSetup",
                input: ({ context }) => ({ context }),
                onDone: {
                  target: "idle",
                  actions: "markSaveSuccess"
                },
                onError: {
                  target: "idle",
                  actions: "setSaveError"
                }
              }
            }
          }
        },
        plex: {
          initial: "idle",
          states: {
            idle: {
              on: {
                startPlexOauth: {
                  target: "starting",
                  actions: "clearTransientMessage"
                }
              }
            },
            starting: {
              invoke: {
                src: "startPlexOauth",
                onDone: {
                  target: "polling",
                  actions: "setPlexPin"
                },
                onError: {
                  target: "idle",
                  actions: "setPlexStartError"
                }
              }
            },
            polling: {
              always: {
                guard: "hasPlexPin",
                target: "waiting"
              },
              on: {
                startPlexOauth: {
                  target: "starting",
                  actions: "clearTransientMessage"
                }
              }
            },
            waiting: {
              after: {
                3000: {
                  target: "checking"
                }
              },
              on: {
                startPlexOauth: {
                  target: "starting",
                  actions: "clearTransientMessage"
                }
              }
            },
            checking: {
              invoke: {
                src: "pollPlexOauth",
                input: ({ context }) => ({ pinId: context.plexPin?.pinId ?? 0 }),
                onDone: [
                  {
                    guard: "plexAuthorized",
                    target: "idle",
                    actions: "applyPlexToken"
                  },
                  {
                    target: "waiting"
                  }
                ],
                onError: {
                  target: "waiting"
                }
              }
            }
          }
        }
      }
    }
  }
});
