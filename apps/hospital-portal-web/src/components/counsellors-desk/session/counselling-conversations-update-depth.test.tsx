import { createElement, useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CounsellingConversationRecorder } from './CounsellingConversationRecorder';
import { CounsellingConversationsView } from './CounsellingConversationsPanel';

const audioBlob = new Blob(['audio']);
const startRecording = vi.fn(async () => undefined);

const toastApi = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  custom: vi.fn(),
  dismiss: vi.fn(),
}));
const uploadControl = vi.hoisted(() => ({
  impl: (): Promise<{ conversationId: string; recordingId: string }> => Promise.resolve({
    conversationId: 'c1',
    recordingId: 'r1',
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: toastApi,
}));

vi.mock('@/hooks/use-audio-recorder', () => ({
  useAudioRecorder: () => ({
    state: 'stopped',
    duration: 4,
    audioBlob,
    isSupported: true,
    startRecording,
    stopRecording() {},
  }),
}));

vi.mock('@/lib/api/counselling-recording.api', () => ({
  counsellingRecordingApi: {
    upload: (..._args: unknown[]) => uploadControl.impl(),
    list: vi.fn(async () => ({ conversations: [] })),
  },
}));

vi.mock('./CounsellingConversationRecorderView', () => ({
  CounsellingConversationRecorderView: ({
    phase,
    onStop,
  }: {
    phase: string;
    onStop: () => void;
  }) => {
    useEffect(() => {
      if (phase === 'recording') onStop();
    }, [onStop, phase]);
    return null;
  },
}));

class HtmlElement {}
class HtmlIFrameElement extends HtmlElement {}

type MiniNode = {
  nodeType: number;
  nodeName: string;
  tagName?: string;
  textContent: string;
  childNodes: MiniNode[];
  parentNode: MiniNode | null;
  style: Record<string, string>;
  namespaceURI: string;
  appendChild: (child: MiniNode) => MiniNode;
  insertBefore: (child: MiniNode, ref: MiniNode | null) => MiniNode;
  removeChild: (child: MiniNode) => MiniNode;
  setAttribute: () => void;
  getAttribute: () => null;
  removeAttribute: () => void;
  hasAttribute: () => boolean;
  addEventListener: () => void;
  removeEventListener: () => void;
  contains: () => boolean;
  focus: () => void;
  blur: () => void;
  firstChild: MiniNode | null;
};

function installMiniDom() {
  function el(name: string): MiniNode {
    const node = {
      nodeType: name === '#text' ? 3 : 1,
      nodeName: name.toUpperCase(),
      tagName: name === '#text' ? undefined : name.toUpperCase(),
      textContent: '',
      childNodes: [] as MiniNode[],
      parentNode: null as MiniNode | null,
      ownerDocument: null as unknown,
      style: { setProperty() {}, removeProperty() {}, getPropertyValue() { return ''; } },
      namespaceURI: 'http://www.w3.org/1999/xhtml',
      appendChild(child: MiniNode) {
        child.parentNode = node;
        node.childNodes.push(child);
        return child;
      },
      insertBefore(child: MiniNode, ref: MiniNode | null) {
        child.parentNode = node;
        const index = ref ? node.childNodes.indexOf(ref) : -1;
        if (index < 0) node.childNodes.push(child);
        else node.childNodes.splice(index, 0, child);
        return child;
      },
      removeChild(child: MiniNode) {
        node.childNodes = node.childNodes.filter((item) => item !== child);
        child.parentNode = null;
        return child;
      },
      setAttribute() {},
      getAttribute() { return null; },
      removeAttribute() {},
      hasAttribute() { return false; },
      addEventListener() {},
      removeEventListener() {},
      contains() { return false; },
      focus() {},
      blur() {},
      get firstChild() { return node.childNodes[0] ?? null; },
    };
    Object.setPrototypeOf(node, HtmlElement.prototype);
    return node;
  }

  const document = {
    nodeType: 9,
    activeElement: null as MiniNode | null,
    documentElement: null as MiniNode | null,
    head: null as MiniNode | null,
    body: null as MiniNode | null,
    createElement(name: string) {
      const node = el(name);
      node.ownerDocument = document;
      return node;
    },
    createElementNS(_namespace: string, name: string) {
      return document.createElement(name);
    },
    createTextNode(text: string) {
      const node = el('#text');
      node.nodeType = 3;
      node.textContent = String(text);
      node.ownerDocument = document;
      return node;
    },
    createComment(text: string) {
      return document.createTextNode(text);
    },
    getElementById() {
      return null;
    },
    addEventListener() {},
    removeEventListener() {},
  };
  document.documentElement = document.createElement('html');
  document.head = document.createElement('head');
  document.body = document.createElement('body');
  document.documentElement.appendChild(document.head);
  document.documentElement.appendChild(document.body);

  const previous = {
    document: globalThis.document,
    HTMLElement: globalThis.HTMLElement,
    HTMLIFrameElement: globalThis.HTMLIFrameElement,
  };
  Object.assign(globalThis, {
    document,
    HTMLElement: HtmlElement,
    Element: HtmlElement,
    Node: class {},
    HTMLIFrameElement: HtmlIFrameElement,
    addEventListener() {},
    removeEventListener() {},
    IS_REACT_ACT_ENVIRONMENT: true,
    sessionStorage: {
      getItem() { return null; },
      setItem() {},
    },
  });
  globalThis.window = globalThis;
  return {
    document,
    restore() {
      globalThis.document = previous.document;
      globalThis.HTMLElement = previous.HTMLElement;
      globalThis.HTMLIFrameElement = previous.HTMLIFrameElement;
    },
  };
}

function textOf(node: { nodeType: number; textContent: string; childNodes?: Array<{ nodeType: number; textContent: string; childNodes?: unknown[] }> }): string {
  if (node.nodeType === 3) return node.textContent ?? '';
  const nested = (node.childNodes ?? []).map((child) => textOf(child as typeof node)).join('');
  return nested || (typeof node.textContent === 'string' ? node.textContent : '');
}

const sample = [
  {
    id: 'c1',
    sequenceNumber: 1,
    startedAt: '2026-09-27T03:42:00',
    endedAt: null,
    status: 'Active',
    createdAt: '2026-09-27T03:42:00',
    counsellorName: 'Amelia',
    recordings: [
      { id: 'r1', createdAt: '2026-09-27T03:42:00', durationSeconds: 30, recordingState: 'Uploaded', transcriptionStatus: null },
      { id: 'r2', createdAt: '2026-09-27T03:50:00', durationSeconds: 20, recordingState: 'Uploaded', transcriptionStatus: null },
    ],
  },
];

describe('conversations update depth', () => {
  let root: Root | null = null;
  let restore: (() => void) | null = null;

  afterEach(() => {
    root?.unmount();
    root = null;
    restore?.();
    restore = null;
  });

  it('keeps a saved recording and open conversation history from retriggering parent updates', async () => {
    const dom = installMiniDom();
    restore = dom.restore;
    const container = dom.document.createElement('div');
    dom.document.body?.appendChild(container);
    const observed = { version: 0, phase: 'idle', renders: 0 };

    function Harness() {
      observed.renders += 1;
      if (observed.renders > 25) {
        throw new Error('Maximum update depth exceeded');
      }
      const [phase, setPhase] = useState<'idle' | 'recording' | 'stopping' | 'uploading' | 'saved' | 'failed'>('idle');
      const [version, setVersion] = useState(0);
      const startRef = useRef<() => void>(() => undefined);
      observed.version = version;
      observed.phase = phase;
      useEffect(() => {
        startRef.current();
      }, []);
      return createElement(
        'div',
        null,
        createElement(CounsellingConversationRecorder, {
          sessionId: 'session-1',
          expectedVersion: 1,
          onRegisterStart: (start: () => void) => {
            startRef.current = start;
          },
          onPhaseChange: (next: typeof phase) => {
            setPhase(next);
            if (next === 'saved') setVersion((value) => value + 1);
          },
        }),
        createElement(CounsellingConversationsView, {
          conversations: sample,
          playingId: null,
          onPlay: () => undefined,
        }),
      );
    }

    root = createRoot(container);
    await act(async () => {
      root?.render(createElement(Harness));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(observed).toMatchObject({ phase: 'saved', version: 1 });
    expect(observed.renders).toBeGreaterThan(1);
    expect(observed.renders).toBeLessThan(25);
    const text = textOf(container);
    expect(text).toContain('Conversation 1');
    expect(text).toContain('Recording 1');
    expect(text).toContain('Recording 2');
    expect(text).not.toContain('Playing recording');

    const html = renderToStaticMarkup(createElement(CounsellingConversationsView, {
      conversations: sample,
      playingId: null,
      onPlay: () => undefined,
    }));
    expect(html).not.toContain('counselling-conversations-header');
    expect(html).not.toContain('Start recording');
    expect(html).toContain('Conversation 1');
    expect(html).not.toContain('data-testid="conversation-transcript-summary"');
    expect(html).not.toContain('AI Summary');
    expect(html).not.toContain('Playing recording');
  });
});

describe('recording save toast', () => {
  let root: Root | null = null;
  let restore: (() => void) | null = null;

  beforeEach(() => {
    uploadControl.impl = () => Promise.resolve({ conversationId: 'c1', recordingId: 'r1' });
    toastApi.success.mockClear();
    toastApi.error.mockClear();
  });

  afterEach(() => {
    root?.unmount();
    root = null;
    restore?.();
    restore = null;
  });

  async function mountSavingRecorder() {
    const dom = installMiniDom();
    restore = dom.restore;
    const container = dom.document.createElement('div');
    dom.document.body?.appendChild(container);
    function Harness() {
      const startRef = useRef<() => void>(() => undefined);
      useEffect(() => {
        startRef.current();
      }, []);
      return createElement(CounsellingConversationRecorder, {
        sessionId: 'session-1',
        expectedVersion: 1,
        onRegisterStart: (start: () => void) => {
          startRef.current = start;
        },
      });
    }
    root = createRoot(container);
    await act(async () => {
      root?.render(createElement(Harness));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it('does not toast success until the save resolves, then toasts exactly once', async () => {
    let finish: (value: { conversationId: string; recordingId: string }) => void = () => undefined;
    uploadControl.impl = () => new Promise((resolve) => {
      finish = resolve;
    });
    await mountSavingRecorder();
    expect(toastApi.success).not.toHaveBeenCalled();
    await act(async () => {
      finish({ conversationId: 'c1', recordingId: 'r1' });
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(toastApi.success).toHaveBeenCalledTimes(1);
    expect(toastApi.success.mock.calls[0]?.[0]).toBe('Recording saved successfully.');
    expect(toastApi.error).not.toHaveBeenCalled();
  });

  it('does not toast success when the save fails and keeps the existing error toast', async () => {
    uploadControl.impl = () => Promise.reject(new Error('network'));
    await mountSavingRecorder();
    await act(async () => {
      await Promise.resolve();
    });
    expect(toastApi.success).not.toHaveBeenCalled();
    expect(toastApi.error).toHaveBeenCalledWith('Recording could not be saved.');
  });
});
