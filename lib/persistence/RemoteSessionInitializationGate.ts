/**
 * Auth restoration can report the same session through getSession() and
 * INITIAL_SESSION. A single initialization prevents a delayed duplicate read
 * from reapplying an older remote snapshot over a newer UI mutation.
 */
export class RemoteSessionInitializationGate {
  private initializedUserId = "";
  private initializing: Promise<void> | undefined;

  async initialize(userId: string, initialize: () => Promise<void>) {
    if (this.initializedUserId === userId) return;
    if (this.initializing) return this.initializing;

    const task = initialize().then(() => {
      this.initializedUserId = userId;
    });
    this.initializing = task;
    try {
      await task;
    } finally {
      if (this.initializing === task) this.initializing = undefined;
    }
  }

  reset() {
    this.initializedUserId = "";
    this.initializing = undefined;
  }
}
