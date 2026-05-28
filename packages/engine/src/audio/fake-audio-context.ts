/**
 * Test-only helper that installs a stub `AudioContext` on `globalThis` so
 * the engine's audio path runs in jest (which has no Web Audio). The stub
 * is intentionally minimal — it covers the surface the engine actually
 * touches:
 *
 * - `createGain`, `createStereoPanner`, `createBufferSource`.
 * - `decodeAudioData`, `currentTime`, `destination`, `state`, `resume`,
 *   `suspend`, `close`.
 *
 * Returns a teardown that restores `globalThis.AudioContext` to whatever
 * it was before (usually `undefined` in node). Re-entrant safe: each
 * install captures the prior value and the matching restore puts it back.
 *
 * @internal
 */

export type StubAudioContext = AudioContext & {
  readonly _gainNodes: readonly StubGainNode[];
  readonly _pannerNodes: readonly StubPannerNode[];
  readonly _sourceNodes: readonly StubBufferSourceNode[];
  advanceTime(seconds: number): void;
  closed: boolean;
};

export type StubGainNode = GainNode & {
  readonly _connections: readonly AudioNode[];
};

export type StubPannerNode = StereoPannerNode & {
  readonly _connections: readonly AudioNode[];
};

export type StubBufferSourceNode = {
  buffer: AudioBuffer | null;
  loop: boolean;
  onended: (() => void) | null;
  started: boolean;
  stopped: boolean;
  startedAt: number | null;
  startedOffset: number | null;
  readonly _connections: readonly AudioNode[];
  start(when?: number, offset?: number): void;
  stop(): void;
  connect(target: AudioNode): AudioNode;
  disconnect(): void;
  triggerEnded(): void;
};

export function installFakeAudioContext(): {
  context: StubAudioContext;
  uninstall: () => void;
} {
  const ctor = (globalThis as Record<string, unknown>)['AudioContext'];
  const context = createFakeContext();
  (globalThis as Record<string, unknown>)['AudioContext'] = function () {
    return context;
  };

  return {
    context,
    uninstall: (): void => {
      if (ctor === undefined) {
        delete (globalThis as Record<string, unknown>)['AudioContext'];
      } else {
        (globalThis as Record<string, unknown>)['AudioContext'] = ctor;
      }
    },
  };
}

function createFakeContext(): StubAudioContext {
  const gainNodes: StubGainNode[] = [];
  const pannerNodes: StubPannerNode[] = [];
  const sourceNodes: StubBufferSourceNode[] = [];
  let currentTime = 0;
  let state: AudioContextState = 'running';

  const destination = { id: 'destination' } as unknown as AudioDestinationNode;

  const ctx = {
    get currentTime() {
      return currentTime;
    },
    get destination() {
      return destination;
    },
    get state() {
      return state;
    },
    createGain(): GainNode {
      const connections: AudioNode[] = [];
      const gain = { value: 1 } as AudioParam;
      const node = {
        gain,
        connect(target: AudioNode) {
          connections.push(target);
        },
        disconnect() {
          connections.length = 0;
        },
        _connections: connections,
      } as unknown as StubGainNode;
      gainNodes.push(node);
      return node;
    },
    createStereoPanner(): StereoPannerNode {
      const connections: AudioNode[] = [];
      const pan = { value: 0 } as AudioParam;
      const node = {
        pan,
        connect(target: AudioNode) {
          connections.push(target);
        },
        disconnect() {
          connections.length = 0;
        },
        _connections: connections,
      } as unknown as StubPannerNode;
      pannerNodes.push(node);
      return node;
    },
    createBufferSource(): AudioBufferSourceNode {
      const connections: AudioNode[] = [];
      const node: StubBufferSourceNode = {
        buffer: null,
        loop: false,
        onended: null,
        started: false,
        stopped: false,
        startedAt: null,
        startedOffset: null,
        start(when: number = 0, offset: number = 0): void {
          node.started = true;
          node.startedAt = currentTime + when;
          node.startedOffset = offset;
        },
        stop(): void {
          node.stopped = true;
        },
        connect(target: AudioNode): AudioNode {
          connections.push(target);
          return target;
        },
        disconnect(): void {
          connections.length = 0;
        },
        triggerEnded(): void {
          node.onended?.();
        },
        _connections: connections,
      } as unknown as StubBufferSourceNode;
      sourceNodes.push(node);
      return node as unknown as AudioBufferSourceNode;
    },
    decodeAudioData(_bytes: ArrayBuffer): Promise<AudioBuffer> {
      return Promise.resolve({
        duration: 1,
        numberOfChannels: 2,
        sampleRate: 44_100,
      } as unknown as AudioBuffer);
    },
    resume(): Promise<void> {
      state = 'running';
      return Promise.resolve();
    },
    suspend(): Promise<void> {
      state = 'suspended';
      return Promise.resolve();
    },
    close(): Promise<void> {
      state = 'closed';
      (ctx as unknown as StubAudioContext).closed = true;
      return Promise.resolve();
    },
    advanceTime(seconds: number): void {
      currentTime += seconds;
    },
    _gainNodes: gainNodes,
    _pannerNodes: pannerNodes,
    _sourceNodes: sourceNodes,
    closed: false,
  };

  return ctx as unknown as StubAudioContext;
}
