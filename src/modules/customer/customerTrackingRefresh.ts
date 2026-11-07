/** Coalesce bursts into one follow-up read and stop work when the view is disposed. */
export function createCustomerTrackingRefreshQueue() {
  let active = true;
  let running = false;
  let pending = false;

  return {
    request: async (read: () => Promise<void>): Promise<void> => {
      if (!active) return;
      if (running) { pending = true; return; }
      running = true;
      try {
        do {
          pending = false;
          await read();
        } while (active && pending);
      } finally {
        running = false;
      }
    },
    dispose: () => { active = false; pending = false; },
  };
}
