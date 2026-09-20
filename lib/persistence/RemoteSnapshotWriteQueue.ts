export class RemoteSnapshotWriteQueue<TSnapshot> {
  private tail = Promise.resolve();
  private confirmed = "";
  private pending = "";
  private requestId = 0;

  constructor(
    private readonly normalize: (snapshot: TSnapshot) => string,
    private readonly persist: (snapshot: TSnapshot) => Promise<TSnapshot>,
  ) {}

  markConfirmed(snapshot: TSnapshot) {
    this.confirmed = this.normalize(snapshot);
    this.pending = this.confirmed;
  }

  enqueue(snapshot: TSnapshot, force = false): Promise<void> {
    const fingerprint = this.normalize(snapshot);
    if (
      !force &&
      (fingerprint === this.confirmed || fingerprint === this.pending)
    ) {
      return this.tail;
    }

    const currentRequest = ++this.requestId;
    this.pending = fingerprint;
    const next = this.tail
      .catch(() => undefined)
      .then(async () => {
        if (currentRequest !== this.requestId) return;
        const persisted = await this.persist(snapshot);
        const confirmed = this.normalize(persisted);
        if (confirmed !== fingerprint) {
          throw new Error(
            "O snapshot remoto não reconciliou com a alteração local.",
          );
        }
        this.confirmed = confirmed;
      });
    this.tail = next;
    return next;
  }

  flush(snapshot: TSnapshot): Promise<void> {
    return this.enqueue(snapshot);
  }
}
