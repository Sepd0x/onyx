import { CH, EV } from '../ipc';

let counter = 0;

// Run a streaming AI feature: subscribe to ai:streamDelta for our id, forward each
// chunk to onDelta, and resolve with the final { text, usage } | { error } when the
// invoke returns. Always unsubscribes. The main process falls back to a non-stream
// completion if streaming fails, so the returned result is reliable either way.
export async function streamAi(
  feature: string,
  payload: any,
  onDelta?: (chunk: string) => void
): Promise<any> {
  if (!window.api) return { error: 'failed' };
  const id = `s${Date.now()}_${counter++}`;
  let unsub: (() => void) | undefined;
  if (onDelta) {
    unsub = window.api.on(EV.aiStreamDelta, (d: any) => {
      if (d && d.id === id && typeof d.delta === 'string') onDelta(d.delta);
    });
  }
  try {
    return await window.api.invoke(CH.aiStream, { id, feature, payload });
  } finally {
    unsub?.();
  }
}
