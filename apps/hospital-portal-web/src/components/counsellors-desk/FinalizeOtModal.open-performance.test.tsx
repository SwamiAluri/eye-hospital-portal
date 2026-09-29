import { createElement, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loads = vi.hoisted(() => ({
  detail: null as null | (() => Promise<Record<string, unknown>>),
  surgeons: null as null | (() => Promise<Array<{ id: string; name: string }>>),
  theaters: null as null | (() => Promise<Array<{ id: string; name: string }>>),
  anesthetists: null as null | (() => Promise<Array<{ id: string; name: string }>>),
  calls: [] as string[],
  canMutate: true,
}));

vi.mock('react-hot-toast', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/hooks/use-permissions', () => ({
  useHasPermission: () => loads.canMutate,
}));

vi.mock('@/hooks/use-ip-checklist-permissions', () => ({
  useIpChecklistPermissions: () => ({ canEditCounsellorOutpatient: true }),
}));

vi.mock('@/hooks/use-anesthesia-type-master', () => ({
  useAnesthesiaTypeMaster: () => ({
    options: [{ label: 'Local' }],
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/components/counsellors-desk/CounsellorOutpatientChecklist', () => ({
  CounsellorOutpatientChecklist: () => null,
}));

vi.mock('@/components/counsellors-desk/SearchableMasterSelect', () => ({
  SearchableMasterSelect: () => createElement('div', { 'data-testid': 'finalize-ot-anesthesia-type' }),
}));

vi.mock('@/components/counsellors-desk/AnesthetistSelect', () => ({
  AnesthetistSelect: (props: { loading?: boolean }) =>
    createElement(
      'div',
      { 'data-testid': props.loading ? 'anesthetist-select-loading' : 'anesthetist-select' },
      props.loading ? 'Loading anaesthetists…' : 'Anaesthetist ready',
    ),
}));

vi.mock('@/components/counsellors-desk/session/primitives', async () => {
  const actual = await vi.importActual<typeof import('@/components/counsellors-desk/session/primitives')>(
    '@/components/counsellors-desk/session/primitives',
  );
  return {
    ...actual,
    CounsellingSelect: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
    CounsellingSelectTrigger: ({
      children,
      'data-testid': testId,
    }: {
      children: React.ReactNode;
      'data-testid'?: string;
    }) => createElement('button', { type: 'button', 'data-testid': testId }, children),
    CounsellingSelectValue: () => createElement('span', null, 'selected'),
    CounsellingSelectContent: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
    CounsellingSelectItem: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
  };
});

vi.mock('@/components/counsellors-desk/session/primitives/CounsellingTimePicker', () => ({
  CounsellingTimePicker: (props: { 'data-testid'?: string }) =>
    createElement('input', { 'data-testid': props['data-testid'] }),
}));

vi.mock('@/components/counsellors-desk/session/primitives/CounsellingDatePicker', () => ({
  CounsellingDatePicker: (props: { 'data-testid'?: string }) =>
    createElement('input', { 'data-testid': props['data-testid'] }),
}));

vi.mock('@/lib/api/counsellors-desk.api', () => ({
  counsellorsDeskApi: {
    getOtScheduleDetail: (id: string) => {
      loads.calls.push(`detail:${id}`);
      return loads.detail!();
    },
    getSurgeons: () => {
      loads.calls.push('surgeons');
      return loads.surgeons!();
    },
    getOtTheaters: () => {
      loads.calls.push('theaters');
      return loads.theaters!();
    },
    getAnesthetists: () => {
      loads.calls.push('anesthetists');
      return loads.anesthetists!();
    },
    updateOtDetails: vi.fn(),
    confirmOtSchedule: vi.fn(),
  },
}));

import { FinalizeOtModal } from './FinalizeOtModal';

type MiniNode = {
  nodeType: number;
  nodeName: string;
  tagName?: string;
  textContent: string;
  childNodes: MiniNode[];
  parentNode: MiniNode | null;
  ownerDocument: unknown;
  attributes: Record<string, string>;
  disabled?: boolean;
  style: { overflow?: string };
  appendChild: (child: MiniNode) => MiniNode;
  insertBefore: (child: MiniNode, ref: MiniNode | null) => MiniNode;
  removeChild: (child: MiniNode) => MiniNode;
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
  removeAttribute: (name: string) => void;
  hasAttribute: (name: string) => boolean;
  addEventListener: () => void;
  removeEventListener: () => void;
  contains: () => boolean;
  focus: () => void;
  blur: () => void;
  firstChild: MiniNode | null;
};

class HtmlElement {}
class HtmlIFrameElement extends HtmlElement {}

function el(name: string): MiniNode {
  const node: MiniNode = {
    nodeType: name === '#text' ? 3 : 1,
    nodeName: name.toUpperCase(),
    tagName: name === '#text' ? undefined : name.toUpperCase(),
    textContent: '',
    childNodes: [],
    parentNode: null,
    ownerDocument: null,
    attributes: {},
    style: {},
    appendChild(child) {
      child.parentNode = node;
      node.childNodes.push(child);
      return child;
    },
    insertBefore(child, ref) {
      child.parentNode = node;
      const index = ref ? node.childNodes.indexOf(ref) : -1;
      if (index < 0) node.childNodes.push(child);
      else node.childNodes.splice(index, 0, child);
      return child;
    },
    removeChild(child) {
      node.childNodes = node.childNodes.filter((item) => item !== child);
      child.parentNode = null;
      return child;
    },
    setAttribute(name, value) {
      node.attributes[name] = String(value);
    },
    getAttribute(name) {
      return node.attributes[name] ?? null;
    },
    removeAttribute(name) {
      delete node.attributes[name];
    },
    hasAttribute(name) {
      return name in node.attributes;
    },
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

function installMiniDom() {
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
      return node;
    },
    createComment(text: string) {
      return document.createTextNode(text);
    },
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
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
    HTMLButtonElement: HtmlElement,
    HTMLInputElement: HtmlElement,
    SVGElement: HtmlElement,
    addEventListener() {},
    removeEventListener() {},
    IS_REACT_ACT_ENVIRONMENT: true,
    getComputedStyle() { return { getPropertyValue() { return ''; } }; },
    requestAnimationFrame(cb: FrameRequestCallback) { return setTimeout(() => cb(0), 0); },
    cancelAnimationFrame(id: number) { clearTimeout(id); },
    sessionStorage: { getItem() { return null; }, setItem() {} },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  });
  (globalThis as { window?: unknown }).window = globalThis;
  return {
    document,
    restore() {
      globalThis.document = previous.document;
      globalThis.HTMLElement = previous.HTMLElement;
      globalThis.HTMLIFrameElement = previous.HTMLIFrameElement;
    },
  };
}

function walk(node: MiniNode, visit: (node: MiniNode) => void) {
  visit(node);
  node.childNodes.forEach((child) => walk(child, visit));
}

function textOf(node: MiniNode): string {
  if (node.nodeType === 3) return node.textContent ?? '';
  const nested = node.childNodes.map(textOf).join('');
  return nested || node.textContent || '';
}

function findByTestId(root: MiniNode, testId: string): MiniNode | undefined {
  let found: MiniNode | undefined;
  walk(root, (node) => {
    if (node.attributes['data-testid'] === testId) found = node;
  });
  return found;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function detailFor(name: string, id: string) {
  return {
    id,
    uhid: name === 'Kamala Rao' ? 'UH-1' : 'UH-2',
    patientName: name,
    surgeryName: 'Phaco + IOL',
    eyes: 'RE',
    status: 'NotConfirmed',
    version: 1,
    isLocked: false,
    surgeon: 'Dr. Rao',
    theaterName: 'OT 1',
    startTime: '09:00',
    scheduleDate: '2026-09-28',
    reportingTime: '07:30',
    diagnosis: 'H25.1 Age-related cataract',
    doctorId: '',
    theatreId: 'th-1',
    anesthetistName: 'Dr. Nair',
  };
}

describe('Finalize Surgery open performance', () => {
  let root: Root | null = null;
  let restore: (() => void) | null = null;
  let host: MiniNode;

  beforeEach(() => {
    loads.calls = [];
    loads.canMutate = true;
    const dom = installMiniDom();
    restore = dom.restore;
    host = dom.document.createElement('div');
    dom.document.body?.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => { root?.unmount(); });
    root = null;
    restore?.();
    restore = null;
  });

  const openControls = { setId: (_id: string) => {} };

  async function renderModal(scheduleId: string) {
    function Harness() {
      const [id, setId] = useState(scheduleId);
      openControls.setId = setId;
      return createElement(FinalizeOtModal, {
        isOpen: true,
        scheduleId: id,
        onClose: () => undefined,
        onStatusChange: () => undefined,
      });
    }
    await act(async () => {
      root?.render(createElement(Harness));
    });
  }

  it('shows the case shell when detail is ready and directories are still loading', async () => {
    const detail = deferred<Record<string, unknown>>();
    const surgeons = deferred<Array<{ id: string; name: string }>>();
    const theaters = deferred<Array<{ id: string; name: string }>>();
    const anesthetists = deferred<Array<{ id: string; name: string }>>();
    loads.detail = () => detail.promise;
    loads.surgeons = () => surgeons.promise;
    loads.theaters = () => theaters.promise;
    loads.anesthetists = () => anesthetists.promise;

    await renderModal('case-a');
    expect(loads.calls.filter((c) => c.startsWith('detail:'))).toHaveLength(1);
    expect(loads.calls).toContain('surgeons');
    expect(loads.calls).toContain('theaters');
    expect(loads.calls).toContain('anesthetists');
    expect(textOf(host)).not.toContain('Kamala Rao');

    await act(async () => {
      detail.resolve(detailFor('Kamala Rao', 'case-a'));
    });

    expect(textOf(host)).toContain('Kamala Rao');
    expect(textOf(host)).toContain('UH-1');
    expect(textOf(host)).toContain('Phaco + IOL');
    expect(textOf(host)).toContain('H25.1 Age-related cataract');
    expect(findByTestId(host, 'finalize-ot-reporting-time')).toBeTruthy();
    expect(textOf(host)).toContain('Loading surgeon');
    expect(textOf(host)).toContain('Loading theatre');
    expect(textOf(host)).toContain('Loading anaesthetists');
    expect(findByTestId(host, 'finalize-ot-select-surgeon')).toBeUndefined();
    expect(findByTestId(host, 'finalize-ot-select-theatre')).toBeUndefined();
    expect(findByTestId(host, 'finalize-ot-confirm')?.attributes['aria-disabled']).toBe('true');
    expect(findByTestId(host, 'finalize-ot-save')?.attributes['aria-disabled']).toBe('true');
    expect(loads.calls.filter((c) => c.startsWith('detail:'))).toHaveLength(1);

    await act(async () => {
      surgeons.resolve([{ id: 's1', name: 'Dr. Rao' }]);
    });
    expect(textOf(host)).not.toContain('Loading surgeon');
    expect(textOf(host)).toContain('Loading theatre');
    expect(findByTestId(host, 'finalize-ot-confirm')?.attributes['aria-disabled']).toBe('true');

    await act(async () => {
      theaters.resolve([{ id: 'th-1', name: 'OT 1' }]);
    });
    expect(textOf(host)).not.toContain('Loading theatre');
    expect(textOf(host)).toContain('Loading anaesthetists');
    expect(findByTestId(host, 'finalize-ot-confirm')?.attributes['aria-disabled']).toBe('true');

    await act(async () => {
      anesthetists.resolve([{ id: 'a1', name: 'Dr. Nair' }]);
    });
    expect(textOf(host)).not.toContain('Loading anaesthetists');
    expect(findByTestId(host, 'anesthetist-select')).toBeTruthy();
    expect(findByTestId(host, 'finalize-ot-confirm')?.attributes['aria-disabled']).not.toBe('true');
    expect(findByTestId(host, 'finalize-ot-select-surgeon')).toBeTruthy();
    expect(findByTestId(host, 'finalize-ot-select-theatre')).toBeTruthy();
    expect(textOf(host)).toContain('H25.1 Age-related cataract');
    expect(textOf(host)).toContain('Kamala Rao');
  });

  it('does not keep the previous patient when another case is opened', async () => {
    const first = deferred<Record<string, unknown>>();
    const second = deferred<Record<string, unknown>>();
    let detailCount = 0;
    loads.detail = () => {
      detailCount += 1;
      return detailCount === 1 ? first.promise : second.promise;
    };
    loads.surgeons = () => Promise.resolve([{ id: 's1', name: 'Dr. Rao' }]);
    loads.theaters = () => Promise.resolve([{ id: 'th-1', name: 'OT 1' }]);
    loads.anesthetists = () => Promise.resolve([{ id: 'a1', name: 'Dr. Nair' }]);

    await renderModal('case-a');
    await act(async () => {
      first.resolve(detailFor('Kamala Rao', 'case-a'));
    });
    expect(textOf(host)).toContain('Kamala Rao');

    await act(async () => {
      openControls.setId('case-b');
    });
    expect(textOf(host)).not.toContain('Kamala Rao');

    await act(async () => {
      second.resolve(detailFor('Lakshmi Iyer', 'case-b'));
    });
    expect(textOf(host)).toContain('Lakshmi Iyer');
    expect(textOf(host)).toContain('UH-2');
    expect(textOf(host)).not.toContain('Kamala Rao');
    expect(textOf(host)).not.toContain('UH-1');
  });

  it('hides finalize actions when the user cannot mutate', async () => {
    loads.canMutate = false;
    loads.detail = () => Promise.resolve(detailFor('Kamala Rao', 'case-a'));
    loads.surgeons = () => Promise.resolve([]);
    loads.theaters = () => Promise.resolve([]);
    loads.anesthetists = () => Promise.resolve([]);
    await renderModal('case-a');
    await act(async () => { await Promise.resolve(); });
    expect(textOf(host)).toContain('You cannot finalize surgery');
    expect(findByTestId(host, 'finalize-ot-confirm')?.attributes['aria-disabled']).toBe('true');
  });
});
