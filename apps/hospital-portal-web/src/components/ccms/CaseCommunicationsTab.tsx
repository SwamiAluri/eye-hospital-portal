'use client';

import React, {
  useCallback, useEffect, useImperativeHandle, useMemo,
  useRef, useState, forwardRef,
} from 'react';
import {
  Mail, MessageSquare, Phone, Send, CheckCircle2, Clock,
  Zap, Info, RefreshCw, ChevronDown, ChevronUp,
  Sparkles, RotateCcw, Trash2, Paperclip,
  ArrowDownLeft, ArrowUpRight, AlertCircle, Users,
  X, Minus, Bold, Italic, Underline, Strikethrough,
  List, ListOrdered, Link2, IndentDecrease, IndentIncrease,
  RemoveFormatting, Reply, Forward, Check,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/auth-interceptors';
import {
  listCommunications, sendCommunication, getCommunicationTemplates,
  type CcmsCommunicationLog, type CommunicationTemplate,
  type SendCommunicationPayload,
} from '@/lib/api/ccms/ccms-communications.api';
import type { WorkflowHistoryEntry } from '@/lib/api/ccms/ccms-workflow.api';
import type { ApprovalEvent } from '@/lib/api/ccms/ccms-approvals.api';
import { getStateLabel, getTriggerLabel, CCMS_STATE_LABELS } from '@/lib/api/ccms/ccms-state-labels';
import { parseCommMetadata, hasParseDraftReady } from '@/lib/ccms/tpa-email-parse';
import { prefillFromParseDraft, type TpaResponsePrefill } from '@/lib/ccms/tpa-response-prefill';
import type { CounsellorDraftSnapshot } from '@/lib/api/ccms/parse-counsellor-draft';
import type { CoverageCase } from '@/lib/api/ccms/ccms-coverage-cases.api';
import { buildCommsContext, generateSmartDraft } from '@/lib/ccms/ccms-comms-templates';
import { ccmsKeys } from '@/hooks/use-ccms-case';
import { useQueryClient } from '@tanstack/react-query';

// ── Suggested actions per state ───────────────────────────────────────────────

const STATE_ACTIONS: Record<string, { label: string; channel: string; recipient: string; hint: string }[]> = {
  DRAFT:                  [{ label: 'Request policy details from TPA', channel: 'email', recipient: 'tpa',     hint: '' }, { label: 'Contact patient for documents', channel: 'sms', recipient: 'patient', hint: '' }],
  ELIGIBILITY_PENDING:    [{ label: 'Request eligibility from TPA',    channel: 'email', recipient: 'tpa',     hint: '' }, { label: 'Call TPA helpline',          channel: 'phone', recipient: 'tpa',     hint: '' }, { label: 'Notify patient', channel: 'sms', recipient: 'patient', hint: '' }],
  ELIGIBILITY_VERIFIED:   [{ label: 'Inform patient — eligibility OK', channel: 'sms',   recipient: 'patient', hint: '' }, { label: 'Confirm with insurer',        channel: 'email', recipient: 'tpa',     hint: '' }],
  POLICY_CAPTURED:        [{ label: 'Confirm policy capture to TPA',   channel: 'email', recipient: 'tpa',     hint: '' }, { label: 'Update patient on next steps', channel: 'sms',  recipient: 'patient', hint: '' }],
  AUTHORIZATION_REQUIRED: [{ label: 'Initiate pre-auth with TPA',      channel: 'email', recipient: 'tpa',     hint: '' }, { label: 'Alert patient',               channel: 'sms',  recipient: 'patient', hint: '' }],
  PREAUTH_GENERATED:      [{ label: 'Send pre-auth documents to TPA',  channel: 'email', recipient: 'tpa',     hint: '' }, { label: 'Notify patient',             channel: 'sms',  recipient: 'patient', hint: '' }],
  PREAUTH_SENT:           [{ label: 'Chase pre-auth status',           channel: 'email', recipient: 'tpa',     hint: '' }, { label: 'Notify patient of submission', channel: 'sms', recipient: 'patient', hint: '' }],
  WAITING_APPROVAL:       [{ label: 'Follow up with TPA',              channel: 'email', recipient: 'tpa',     hint: '' }, { label: 'Update patient on wait',       channel: 'sms',  recipient: 'patient', hint: '' }, { label: 'Call TPA', channel: 'phone', recipient: 'tpa', hint: '' }],
  CLARIFICATION_REQUIRED: [{ label: 'Send clarification docs to TPA',  channel: 'email', recipient: 'tpa',     hint: '' }, { label: 'Notify patient — TPA query',   channel: 'sms',  recipient: 'patient', hint: '' }],
  RESUBMITTED:            [{ label: 'Confirm resubmission to TPA',     channel: 'email', recipient: 'tpa',     hint: '' }, { label: 'Update patient',              channel: 'sms',  recipient: 'patient', hint: '' }],
  APPROVED:               [{ label: 'Notify patient of approval',      channel: 'sms',   recipient: 'patient', hint: '' }, { label: 'Acknowledge approval to TPA', channel: 'email', recipient: 'tpa',     hint: '' }],
  PARTIAL_APPROVAL:       [{ label: 'Query partial approval with TPA', channel: 'email', recipient: 'tpa',     hint: '' }, { label: 'Notify patient — partial',    channel: 'sms',  recipient: 'patient', hint: '' }],
  ADMISSION_READY:        [{ label: 'Confirm admission — patient',     channel: 'sms',   recipient: 'patient', hint: '' }],
  ADMITTED:               [{ label: 'Update TPA on admission',         channel: 'email', recipient: 'tpa',     hint: '' }, { label: 'Message patient',            channel: 'sms',  recipient: 'patient', hint: '' }],
  SURGERY_SCHEDULED:      [{ label: 'Confirm surgery schedule — TPA',  channel: 'email', recipient: 'tpa',     hint: '' }, { label: 'Remind patient of surgery',   channel: 'sms',  recipient: 'patient', hint: '' }],
  SURGERY_COMPLETED:      [{ label: 'Notify TPA — surgery done',       channel: 'email', recipient: 'tpa',     hint: '' }, { label: 'Post-op update to patient',  channel: 'sms',  recipient: 'patient', hint: '' }],
  BILL_PENDING:           [{ label: 'Notify patient — bill pending',   channel: 'sms',   recipient: 'patient', hint: '' }],
  BILL_FINALIZED:         [{ label: 'Submit claim to TPA',             channel: 'email', recipient: 'tpa',     hint: '' }, { label: 'Share bill details — patient', channel: 'sms', recipient: 'patient', hint: '' }],
  CLAIM_READY:            [{ label: 'Submit claim to insurer',         channel: 'email', recipient: 'tpa',     hint: '' }],
  CLAIM_SUBMITTED:        [{ label: 'Follow up on claim submission',   channel: 'email', recipient: 'tpa',     hint: '' }, { label: 'Update patient',             channel: 'sms',  recipient: 'patient', hint: '' }],
  CLAIM_IN_PROCESS:       [{ label: 'Chase claim processing status',   channel: 'email', recipient: 'tpa',     hint: '' }, { label: 'Update patient on status',   channel: 'sms',  recipient: 'patient', hint: '' }],
  SETTLEMENT_PENDING:     [{ label: 'Chase settlement from TPA',       channel: 'email', recipient: 'tpa',     hint: '' }, { label: 'Update patient',             channel: 'sms',  recipient: 'patient', hint: '' }],
  PARTIAL_SETTLEMENT:     [{ label: 'Request remaining settlement',    channel: 'email', recipient: 'tpa',     hint: '' }, { label: 'Notify patient — partial',   channel: 'sms',  recipient: 'patient', hint: '' }],
  FULL_SETTLEMENT:        [{ label: 'Acknowledge settlement to TPA',   channel: 'email', recipient: 'tpa',     hint: '' }, { label: 'Notify patient — settled',   channel: 'sms',  recipient: 'patient', hint: '' }],
  RECONCILED:             [{ label: 'Send reconciliation note to TPA', channel: 'email', recipient: 'tpa',     hint: '' }],
  CLOSED:                 [{ label: 'Send closure summary to patient', channel: 'email', recipient: 'patient', hint: '' }],
  REJECTED:               [{ label: 'Appeal rejection to TPA',         channel: 'email', recipient: 'tpa',     hint: '' }, { label: 'Notify patient — rejection',  channel: 'sms',  recipient: 'patient', hint: '' }],
  EXPIRED:                [{ label: 'Request pre-auth extension',      channel: 'email', recipient: 'tpa',     hint: '' }],
  CANCELLED: [],
  ABORTED:   [],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 2)  return 'yesterday';
  if (days  < 7)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function textToHtml(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.split('\n').map(l => `<div>${l || '<br>'}</div>`).join('');
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<div>/gi, '\n')
    .replace(/<\/div>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Rich-text editor ──────────────────────────────────────────────────────────

export interface RichTextEditorHandle {
  getHTML:   () => string;
  setHTML:   (html: string) => void;
  getText:   () => string;
  focus:     () => void;
}

interface RichTextEditorProps {
  placeholder?: string;
  minHeight?:   number;
  onChange?:    (html: string) => void;
}

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  function RichTextEditor({ placeholder = 'Write your message…', minHeight = 220, onChange }, ref) {
    const divRef    = useRef<HTMLDivElement>(null);
    const [empty,   setEmpty] = useState(true);
    const [active,  setActive] = useState<Record<string, boolean>>({});

    // Expose imperative API
    useImperativeHandle(ref, () => ({
      getHTML:  () => divRef.current?.innerHTML ?? '',
      getText:  () => divRef.current ? htmlToText(divRef.current.innerHTML) : '',
      focus:    () => { divRef.current?.focus(); },
      setHTML:  (html: string) => {
        if (!divRef.current) return;
        divRef.current.innerHTML = html;
        setEmpty(!html || html === '<br>' || html === '<div><br></div>');
        // Move cursor to end
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(divRef.current);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        onChange?.(html);
      },
    }), [onChange]);

    const exec = (cmd: string, value?: string) => {
      divRef.current?.focus();
      document.execCommand(cmd, false, value);
      updateActive();
      onChange?.(divRef.current?.innerHTML ?? '');
    };

    const updateActive = () => {
      setActive({
        bold:          document.queryCommandState('bold'),
        italic:        document.queryCommandState('italic'),
        underline:     document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
        insertOrderedList:   document.queryCommandState('insertOrderedList'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      });
    };

    const handleInput = () => {
      const html = divRef.current?.innerHTML ?? '';
      setEmpty(!html || html === '<br>' || html === '<div><br></div>');
      onChange?.(html);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey)) {
        if (e.key === 'b') { e.preventDefault(); exec('bold'); }
        if (e.key === 'i') { e.preventDefault(); exec('italic'); }
        if (e.key === 'u') { e.preventDefault(); exec('underline'); }
      }
    };

    const insertLink = () => {
      const url = window.prompt('Enter URL:', 'https://');
      if (url) exec('createLink', url);
    };

    const toolBtn = (
      cmd: string, Icon: React.ElementType, title: string,
      clickOverride?: () => void,
    ) => (
      <button
        type="button"
        title={title}
        onMouseDown={e => { e.preventDefault(); clickOverride ? clickOverride() : exec(cmd); }}
        className={`p-2 rounded-lg transition-colors ${
          active[cmd]
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
        }`}
      >
        <Icon className="w-4 h-4" />
      </button>
    );

    return (
      <div className="border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-400/60 focus-within:border-indigo-400 transition-shadow">
        {/* Formatting toolbar */}
        <div
          onMouseDown={e => e.preventDefault()}
          className="flex items-center gap-0.5 px-2 py-2 border-b border-gray-200 bg-gray-50 flex-wrap"
        >
          {toolBtn('bold',          Bold,              'Bold (Ctrl+B)')}
          {toolBtn('italic',        Italic,            'Italic (Ctrl+I)')}
          {toolBtn('underline',     Underline,         'Underline (Ctrl+U)')}
          {toolBtn('strikeThrough', Strikethrough,     'Strikethrough')}
          <span className="w-px h-5 bg-gray-200 mx-1.5" />
          {toolBtn('insertOrderedList',   ListOrdered, 'Ordered list')}
          {toolBtn('insertUnorderedList', List,        'Bullet list')}
          <span className="w-px h-5 bg-gray-200 mx-1.5" />
          {toolBtn('createLink', Link2, 'Insert link', insertLink)}
          <span className="w-px h-5 bg-gray-200 mx-1.5" />
          {toolBtn('indent',   IndentIncrease, 'Indent')}
          {toolBtn('outdent',  IndentDecrease, 'Outdent')}
          <span className="w-px h-5 bg-gray-200 mx-1.5" />
          {toolBtn('removeFormat', RemoveFormatting, 'Clear formatting')}
        </div>

        {/* Editable body */}
        <div className="relative">
          {empty && (
            <span className="absolute top-3 left-3 text-sm text-gray-400 pointer-events-none select-none">
              {placeholder}
            </span>
          )}
          <div
            ref={divRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onKeyUp={updateActive}
            onMouseUp={updateActive}
            onFocus={updateActive}
            style={{ minHeight }}
            className="px-3 py-3 text-sm text-gray-800 leading-relaxed focus:outline-none overflow-y-auto"
          />
        </div>
      </div>
    );
  },
);

// ── Chip email input ──────────────────────────────────────────────────────────

interface EmailChip { label: string; value: string }

function ChipEmailInput({
  chips, onChange, placeholder = 'Add email address…',
}: {
  chips: EmailChip[];
  onChange: (chips: EmailChip[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const val = input.trim().replace(/,$/, '');
    if (val) {
      onChange([...chips, { label: val, value: val }]);
    }
    setInput('');
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      e.preventDefault();
      commit();
    }
    if (e.key === 'Backspace' && !input && chips.length > 0) {
      onChange(chips.slice(0, -1));
    }
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1 min-h-[34px] cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {chips.map((c, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 text-xs bg-indigo-100 text-indigo-800 rounded-full pl-2.5 pr-1.5 py-0.5 font-medium"
        >
          {c.label}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onChange(chips.filter((_, j) => j !== i)); }}
            className="text-indigo-400 hover:text-indigo-700 rounded-full"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKey}
        onBlur={commit}
        placeholder={chips.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] text-sm outline-none bg-transparent placeholder:text-gray-400"
      />
    </div>
  );
}

// ── Gmail compose panel ───────────────────────────────────────────────────────

interface ComposeProps {
  caseId:        string;
  case_:         CoverageCase;
  currentState:  string;
  draft?:        CounsellorDraftSnapshot | null;
  comms:         CcmsCommunicationLog[];
  templates:     CommunicationTemplate[];
  initialSubject?: string;
  initialTo?:      string[];
  onSent:        () => Promise<void>;
  onDiscard:     () => void;
}

function EmailComposePanel({
  caseId, case_, currentState, draft, comms, templates,
  initialSubject = '', initialTo = [],
  onSent, onDiscard,
}: ComposeProps) {
  const editorRef = useRef<RichTextEditorHandle>(null);

  const toInitial = () =>
    initialTo.length > 0
      ? initialTo.map(v => ({ label: v, value: v }))
      : draft?.tpaContactEmail ? [{ label: draft.tpaContactEmail, value: draft.tpaContactEmail }] : [];

  const [toChips,  setToChips]   = useState<EmailChip[]>(toInitial);
  const [ccChips,  setCcChips]   = useState<EmailChip[]>([]);
  const [bccChips, setBccChips]  = useState<EmailChip[]>([]);
  const [showCc,   setShowCc]    = useState(false);
  const [showBcc,  setShowBcc]   = useState(false);
  const [subject,  setSubject]   = useState(initialSubject);
  const [isDraftAuto, setIsDraftAuto] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [busy,     setBusy]      = useState(false);
  const [selectedTpl, setSelectedTpl] = useState('');

  // Auto-generate draft on mount
  useEffect(() => {
    const ctx = buildCommsContext(case_, draft, comms, 'tpa');
    const { subject: s, body: b } = generateSmartDraft(currentState, 'email', 'tpa', ctx);
    if (!initialSubject) setSubject(s);
    setTimeout(() => {
      editorRef.current?.setHTML(textToHtml(b));
      setIsDraftAuto(true);
    }, 50);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const regenerate = () => {
    const ctx = buildCommsContext(case_, draft, comms, 'tpa');
    const { subject: s, body: b } = generateSmartDraft(currentState, 'email', 'tpa', ctx);
    setSubject(s);
    editorRef.current?.setHTML(textToHtml(b));
    setIsDraftAuto(true);
    setSelectedTpl('');
  };

  const clear = () => {
    setSubject('');
    editorRef.current?.setHTML('');
    setIsDraftAuto(false);
  };

  const applyTemplate = (code: string) => {
    const t = templates.find(x => x.templateCode === code);
    if (!t) return;
    if (t.subjectTemplate) setSubject(t.subjectTemplate);
    editorRef.current?.setHTML(textToHtml(t.bodyTemplate));
    setSelectedTpl(code);
    setIsDraftAuto(false);
  };

  const handleSend = async () => {
    const body = editorRef.current?.getText() ?? '';
    if (!body.trim()) { toast.error('Message body is required'); return; }
    if (toChips.length === 0) { toast.error('Add at least one recipient in To'); return; }
    setBusy(true);
    try {
      const result = await sendCommunication(caseId, {
        channel: 'email',
        recipientType: 'tpa',
        recipientRef: toChips.map(c => c.value).join(', '),
        subject: subject || undefined,
        body: editorRef.current?.getHTML() ?? body,
        direction: 'outbound',
        templateCode: selectedTpl || undefined,
      });
      if (result.success) {
        toast.success('Email sent and logged');
      } else {
        toast.error(result.error ?? 'Delivery failed — logged with error status');
      }
      await onSent();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not send email'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border border-indigo-200 rounded-2xl shadow-lg overflow-hidden">
      {/* Gmail-style header — indigo gradient */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-700 to-indigo-500 rounded-t-2xl">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white truncate">
            {subject ? subject : 'New Message'}
          </p>
          <p className="text-[11px] text-indigo-200 mt-0.5 truncate">
            {toChips.length > 0
              ? `To: ${toChips.map(c => c.label).join(', ')}`
              : 'Add recipients in the To field below'}
          </p>
        </div>
        <div className="flex items-center gap-1 ml-3 flex-shrink-0">
          <button
            type="button"
            onClick={() => setMinimised(v => !v)}
            title={minimised ? 'Expand' : 'Minimise'}
            className="p-1.5 rounded-lg text-indigo-200 hover:text-white hover:bg-indigo-600 transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDiscard}
            title="Discard draft"
            className="p-1.5 rounded-lg text-indigo-200 hover:text-white hover:bg-indigo-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!minimised && (
        <>
          {/* To / CC / BCC fields */}
          <div className="border-b border-gray-200">
            {/* To */}
            <div className="flex items-start px-3 py-2 border-b border-gray-200 focus-within:border-b-indigo-300 transition-colors group">
              <span className="text-xs font-bold text-gray-500 w-10 mt-1.5 shrink-0 group-focus-within:text-indigo-600">To</span>
              <div className="flex-1 min-w-0">
                <ChipEmailInput chips={toChips} onChange={setToChips} placeholder="Recipients…" />
              </div>
              <div className="flex gap-2 ml-2 mt-1.5 shrink-0">
                {!showCc  && <button type="button" onClick={() => setShowCc(true)}  className="text-xs font-semibold text-gray-400 hover:text-indigo-600 transition-colors">Cc</button>}
                {!showBcc && <button type="button" onClick={() => setShowBcc(true)} className="text-xs font-semibold text-gray-400 hover:text-indigo-600 transition-colors">Bcc</button>}
              </div>
            </div>
            {/* CC */}
            {showCc && (
              <div className="flex items-start px-3 py-2 border-b border-gray-200 focus-within:border-b-indigo-300 transition-colors group">
                <span className="text-xs font-bold text-gray-500 w-10 mt-1.5 shrink-0 group-focus-within:text-indigo-600">Cc</span>
                <div className="flex-1 min-w-0">
                  <ChipEmailInput chips={ccChips} onChange={setCcChips} placeholder="Cc recipients…" />
                </div>
                <button type="button" onClick={() => { setShowCc(false); setCcChips([]); }} className="text-gray-300 hover:text-gray-600 ml-2 mt-1.5 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {/* BCC */}
            {showBcc && (
              <div className="flex items-start px-3 py-2 border-b border-gray-200 focus-within:border-b-indigo-300 transition-colors group">
                <span className="text-xs font-bold text-gray-500 w-10 mt-1.5 shrink-0 group-focus-within:text-indigo-600">Bcc</span>
                <div className="flex-1 min-w-0">
                  <ChipEmailInput chips={bccChips} onChange={setBccChips} placeholder="Bcc recipients…" />
                </div>
                <button type="button" onClick={() => { setShowBcc(false); setBccChips([]); }} className="text-gray-300 hover:text-gray-600 ml-2 mt-1.5 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {/* Subject */}
            <div className="flex items-center px-3 py-2 focus-within:border-b-indigo-300 transition-colors group">
              <span className="text-xs font-bold text-gray-500 w-14 shrink-0 group-focus-within:text-indigo-600">Subject</span>
              <input
                value={subject}
                onChange={e => { setSubject(e.target.value); setIsDraftAuto(false); }}
                placeholder="Email subject…"
                className="flex-1 text-sm font-medium text-gray-800 bg-transparent outline-none placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Smart draft banner */}
          {isDraftAuto && (
            <div className="flex items-center justify-between gap-2 bg-amber-50 border-b border-amber-100 px-3 py-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <span className="text-[11px] text-amber-700 font-medium">
                  Auto-generated draft — review and edit before sending
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={regenerate}
                  className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 px-2 py-0.5 rounded-lg"
                >
                  <RotateCcw className="w-2.5 h-2.5" /> Regenerate
                </button>
                <button
                  type="button"
                  onClick={clear}
                  className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-red-600 bg-white border border-gray-200 px-2 py-0.5 rounded-lg"
                >
                  <Trash2 className="w-2.5 h-2.5" /> Clear
                </button>
              </div>
            </div>
          )}

          {/* DB Template selector */}
          {templates.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
              <span className="text-xs text-gray-500 shrink-0">Template:</span>
              <select
                value={selectedTpl}
                onChange={e => applyTemplate(e.target.value)}
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
              >
                <option value="">— Apply a DB template —</option>
                {templates.map(t => (
                  <option key={t.id} value={t.templateCode}>{t.templateName ?? t.templateCode}</option>
                ))}
              </select>
            </div>
          )}

          {/* Rich-text body */}
          <div className="px-3 pt-3 pb-0">
            <RichTextEditor
              ref={editorRef}
              placeholder="Write your message…"
              minHeight={220}
            />
          </div>

          {/* Attachment hint */}
          <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-400">
            <Paperclip className="w-3.5 h-3.5" />
            <span>Upload documents in the <span className="text-indigo-500 font-medium">Documents tab</span> and reference them above.</span>
          </div>

          {/* Gmail-style footer */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200 rounded-b-2xl gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Primary Send button */}
              <button
                type="button"
                onClick={handleSend}
                disabled={busy}
                className="flex items-center gap-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-5 py-2.5 rounded-xl shadow-md disabled:opacity-50 transition-all"
              >
                {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {busy ? 'Sending…' : 'Send email'}
              </button>
              {/* Regenerate text link */}
              <button
                type="button"
                onClick={regenerate}
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-500 hover:text-indigo-700 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Regenerate draft
              </button>
            </div>
            {/* Muted discard — far right */}
            <button
              type="button"
              onClick={onDiscard}
              title="Discard draft"
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Discard
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Gmail thread row ──────────────────────────────────────────────────────────

function EmailThreadRow({
  comm, onReply, onApplyToPreAuth, canRecordTpaResponse,
}: {
  comm: CcmsCommunicationLog;
  onReply: (comm: CcmsCommunicationLog) => void;
  onApplyToPreAuth?: (comm: CcmsCommunicationLog, prefill: TpaResponsePrefill) => void;
  canRecordTpaResponse?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isOut = comm.direction !== 'inbound';
  const meta = parseCommMetadata(comm.metadataJson);
  const draftReady = !isOut && hasParseDraftReady(meta);

  return (
    <div className={`border-b border-gray-100 last:border-0 ${expanded ? 'bg-indigo-50/30' : 'hover:bg-gray-50'} transition-colors`}>
      {/* Thread row (summary line) */}
      <button
        type="button"
        className="w-full text-left flex items-center gap-3 px-4 py-3"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Avatar / direction */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
          isOut ? 'bg-indigo-100 text-indigo-700' : 'bg-violet-100 text-violet-700'
        }`}>
          {isOut ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
        </div>
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm truncate ${isOut ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>
              {isOut ? `To: ${comm.recipientType?.toUpperCase()}` : `From: ${comm.recipientType?.toUpperCase()}`}
            </span>
            <span className="text-xs text-gray-400 flex-shrink-0">{relativeTime(comm.sentAt ?? comm.createdAt ?? '')}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-600 truncate font-medium">
              {comm.subject ?? '(no subject)'}
            </span>
            {comm.bodySummary && (
              <span className="text-xs text-gray-400 truncate hidden sm:block">
                — {comm.bodySummary.slice(0, 80)}
              </span>
            )}
          </div>
        </div>
        {/* Status + chevron */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {draftReady && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
              Draft ready
            </span>
          )}
          {comm.deliveryStatus && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
              comm.deliveryStatus === 'sent' || comm.deliveryStatus === 'delivered'
                ? 'bg-emerald-100 text-emerald-700'
                : comm.deliveryStatus === 'failed'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-amber-100 text-amber-700'
            }`}>
              {comm.deliveryStatus}
            </span>
          )}
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
        </div>
      </button>

      {/* Expanded message card */}
      {expanded && (
        <div className="px-4 pb-4">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {/* Message metadata */}
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 space-y-1">
              {[
                { label: 'From', val: isOut ? 'CCMS Team' : `${comm.recipientType?.toUpperCase()} / ${comm.recipientAddress ?? '—'}` },
                { label: 'To',   val: isOut ? `${comm.recipientType?.toUpperCase()} <${comm.recipientAddress ?? '—'}>` : 'CCMS Team' },
                { label: 'Date', val: comm.sentAt ? new Date(comm.sentAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—' },
                { label: 'Subject', val: comm.subject ?? '(no subject)' },
              ].map(row => (
                <div key={row.label} className="flex items-start gap-2">
                  <span className="text-[11px] font-semibold text-gray-400 w-12 shrink-0 mt-px">{row.label}</span>
                  <span className="text-xs text-gray-700">{row.val}</span>
                </div>
              ))}
            </div>
            {/* Body */}
            <div className="px-4 py-4">
              {comm.bodySummary ? (
                <div
                  className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: comm.bodySummary }}
                />
              ) : (
                <p className="text-sm text-gray-400 italic">No message body recorded.</p>
              )}
            </div>
            {/* Reply / Forward */}
            <div className="flex items-center flex-wrap gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50">
              {!isOut && canRecordTpaResponse && onApplyToPreAuth && (
                <button
                  type="button"
                  onClick={() => {
                    const draft = meta?.parseDraft;
                    const prefill = draft
                      ? prefillFromParseDraft(draft, comm.id)
                      : prefillFromParseDraft({ excerpt: comm.bodySummary ?? comm.subject ?? '' }, comm.id);
                    onApplyToPreAuth(comm, prefill);
                  }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 border border-indigo-600 px-3 py-1.5 rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  {draftReady ? 'Review & apply' : 'Apply to pre-auth'}
                </button>
              )}
              <button
                type="button"
                onClick={() => onReply(comm)}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-colors"
              >
                <Reply className="w-3.5 h-3.5" /> Reply
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <Forward className="w-3.5 h-3.5" /> Forward
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Gmail email thread panel ──────────────────────────────────────────────────

function EmailThreadPanel({
  comms, workflowHistory, approvalEvents, loading,
  onReply, onRefresh, onApplyToPreAuth, canRecordTpaResponse,
}: {
  comms:           CcmsCommunicationLog[];
  workflowHistory: WorkflowHistoryEntry[];
  approvalEvents:  ApprovalEvent[];
  loading:         boolean;
  onReply:         (comm: CcmsCommunicationLog) => void;
  onRefresh:       () => void;
  onApplyToPreAuth?: (comm: CcmsCommunicationLog, prefill: TpaResponsePrefill) => void;
  canRecordTpaResponse?: boolean;
}) {
  const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all');

  const emailComms = useMemo(
    () => comms.filter(c => c.communicationType?.toLowerCase() === 'email'),
    [comms],
  );

  const filtered = useMemo(() => {
    if (filter === 'sent')     return emailComms.filter(c => c.direction !== 'inbound');
    if (filter === 'received') return emailComms.filter(c => c.direction === 'inbound');
    return emailComms;
  }, [emailComms, filter]);

  // Interleave workflow events with messages for the "All" view
  type Row = { kind: 'email'; comm: CcmsCommunicationLog } | { kind: 'event'; label: string; at: string };

  const allRows = useMemo((): Row[] => {
    const rows: Row[] = filtered.map(c => ({ kind: 'email', comm: c }));
    if (filter === 'all') {
      workflowHistory.forEach((h, i) => {
        rows.push({ kind: 'event', label: `${getStateLabel(h.fromState)} → ${getStateLabel(h.toState)}`, at: h.performedAt });
      });
      approvalEvents.forEach(e => {
        rows.push({ kind: 'event', label: `TPA ${e.approvalStatus}`, at: e.recordedAt ?? e.occurredAt });
      });
    }
    return rows.sort((a, b) => {
      const ta = a.kind === 'email' ? (a.comm.sentAt ?? a.comm.createdAt ?? '') : a.at;
      const tb = b.kind === 'email' ? (b.comm.sentAt ?? b.comm.createdAt ?? '') : b.at;
      return new Date(tb).getTime() - new Date(ta).getTime();
    });
  }, [filtered, filter, workflowHistory, approvalEvents]);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Email History</span>
          <div className="flex items-center gap-1.5">
            {(['all', 'sent', 'received'] as const).map(f => {
              const count = f === 'all' ? emailComms.length : emailComms.filter(c => f === 'sent' ? c.direction !== 'inbound' : c.direction === 'inbound').length;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all capitalize ${
                    filter === f ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'sent' ? 'Outbound' : 'Received'}
                  {count > 0 && (
                    <span className={`ml-1.5 text-[10px] font-bold px-1 rounded-full ${filter === f ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <button onClick={onRefresh} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Refresh thread">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Thread list */}
      {loading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : allRows.length === 0 ? (
        <div className="text-center py-14 px-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 mb-4">
            <Mail className="w-8 h-8 text-indigo-300" />
          </div>
          <p className="text-sm font-bold text-gray-600 mb-1">No messages yet for this case</p>
          <p className="text-xs text-gray-400 leading-relaxed mb-4">
            Start the conversation — reach out to the TPA, insurer, or patient<br />directly from the compose panel above.
          </p>
          <button
            type="button"
            onClick={() => { /* parent already shows compose */ }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-4 py-2 rounded-xl transition-all"
          >
            <Mail className="w-3.5 h-3.5" /> Compose your first message
          </button>
        </div>
      ) : (
        <div>
          {allRows.map((row, i) => {
            if (row.kind === 'event') {
              return (
                <div key={`evt-${i}`} className="flex items-center gap-2 px-4 py-2 border-b border-gray-50 bg-gray-50/50">
                  <div className="w-px h-4 bg-gray-200 mx-3.5 flex-shrink-0" />
                  <span className="text-[11px] text-gray-500 font-medium">{row.label}</span>
                  <span className="text-[10px] text-gray-400 ml-auto">{relativeTime(row.at)}</span>
                </div>
              );
            }
            return (
              <EmailThreadRow
                key={row.comm.id}
                comm={row.comm}
                onReply={onReply}
                onApplyToPreAuth={onApplyToPreAuth}
                canRecordTpaResponse={canRecordTpaResponse}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── SMS / WhatsApp bubble view ────────────────────────────────────────────────

function SmsBubbleView({
  caseId, channel, comms, draft, loading,
  case_, currentState,
  onRefresh,
}: {
  caseId:       string;
  channel:      'sms' | 'whatsapp';
  comms:        CcmsCommunicationLog[];
  draft?:       CounsellorDraftSnapshot | null;
  loading:      boolean;
  case_:        CoverageCase;
  currentState: string;
  onRefresh:    () => void;
}) {
  const [message, setMessage] = useState('');
  const [busy,    setBusy]    = useState(false);
  const endRef                = useRef<HTMLDivElement>(null);

  const charLimit = channel === 'sms' ? 160 : 1024;
  const over      = message.length > charLimit;

  // Auto-generate SMS draft
  useEffect(() => {
    const ctx = buildCommsContext(case_, draft, comms, 'patient');
    const { body } = generateSmartDraft(currentState, channel, 'patient', ctx);
    setMessage(body.slice(0, charLimit));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  const filteredComms = useMemo(
    () => comms.filter(c => c.communicationType?.toLowerCase() === channel || c.communicationType?.toLowerCase() === 'sms'),
    [comms, channel],
  );

  const handleSend = async () => {
    if (!message.trim()) { toast.error('Message is required'); return; }
    setBusy(true);
    try {
      const result = await sendCommunication(caseId, {
        channel,
        recipientType: 'patient',
        recipientRef: draft?.tpaContactPhone ?? '',
        body: message,
        direction: 'outbound',
      });
      if (result.success) {
        toast.success(`${channel === 'sms' ? 'SMS' : 'WhatsApp'} sent`);
        setMessage('');
        onRefresh();
      } else {
        toast.error(result.error ?? 'Delivery failed');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not send'));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredComms]);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col" style={{ minHeight: 400 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
            {channel === 'sms' ? 'SMS Messages' : 'WhatsApp'}
          </span>
        </div>
        <button onClick={onRefresh} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50" title="Refresh">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Bubble thread */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-gray-50/30" style={{ maxHeight: 320 }}>
        {loading && <div className="text-center text-xs text-gray-400">Loading…</div>}
        {!loading && filteredComms.length === 0 && (
          <div className="text-center py-8">
            <MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-xs text-gray-400">No messages yet</p>
          </div>
        )}
        {filteredComms
          .slice()
          .sort((a, b) => new Date(a.sentAt ?? a.createdAt ?? 0).getTime() - new Date(b.sentAt ?? b.createdAt ?? 0).getTime())
          .map(c => {
            const isOut = c.direction !== 'inbound';
            return (
              <div key={c.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                  isOut
                    ? 'bg-indigo-600 text-white rounded-br-sm'
                    : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                }`}>
                  <p>{c.bodySummary ?? '(no body)'}</p>
                  <p className={`text-[10px] mt-1 text-right ${isOut ? 'text-indigo-200' : 'text-gray-400'}`}>
                    {relativeTime(c.sentAt ?? c.createdAt ?? '')}
                    {isOut && c.deliveryStatus && (
                      <span className="ml-1">
                        {c.deliveryStatus === 'delivered' ? '✓✓' : '✓'}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        <div ref={endRef} />
      </div>

      {/* Compose bar */}
      <div className="px-3 pt-3 pb-3 border-t border-gray-100">
        <div className={`flex flex-col gap-1.5 border rounded-xl overflow-hidden ${over ? 'border-red-300' : 'border-gray-200'} focus-within:ring-2 focus-within:ring-indigo-400/40`}>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={3}
            placeholder={`Type your ${channel === 'sms' ? 'SMS' : 'WhatsApp'} message…`}
            className="px-3 pt-3 text-sm text-gray-800 outline-none resize-none"
          />
          <div className="flex items-center justify-between px-3 pb-2">
            <span className={`text-[11px] ${over ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
              {message.length}/{charLimit}
            </span>
            <button
              type="button"
              onClick={handleSend}
              disabled={busy || over || !message.trim()}
              className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl shadow-sm disabled:opacity-50 transition-colors"
            >
              {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {busy ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Phone / In-person log view ────────────────────────────────────────────────

function PhoneLogView({
  caseId, channel, comms, loading, onRefresh,
}: {
  caseId:   string;
  channel:  'phone' | 'in_person';
  comms:    CcmsCommunicationLog[];
  loading:  boolean;
  onRefresh: () => void;
}) {
  const [recipient, setRecipient] = useState<'tpa' | 'insurance' | 'patient' | 'internal'>('tpa');
  const [notes,     setNotes]     = useState('');
  const [busy,      setBusy]      = useState(false);

  const label = channel === 'phone' ? 'Phone Call' : 'In-Person Meeting';

  const filtered = useMemo(
    () => comms.filter(c => c.communicationType?.toLowerCase() === channel || c.communicationType?.toLowerCase() === 'phone' || c.communicationType?.toLowerCase() === 'in_person'),
    [comms, channel],
  );

  const handleLog = async () => {
    if (!notes.trim()) { toast.error('Add interaction notes'); return; }
    setBusy(true);
    try {
      await sendCommunication(caseId, { channel, recipientType: recipient, body: notes, direction: 'inbound' });
      toast.success(`${label} logged`);
      setNotes('');
      onRefresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not log interaction'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-gray-500" />
          <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Log {label}</span>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-1.5">With</p>
          <div className="flex gap-1.5 flex-wrap">
            {(['tpa', 'insurance', 'patient', 'internal'] as const).map(r => (
              <button key={r} type="button" onClick={() => setRecipient(r)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${recipient === r ? 'bg-indigo-50 text-indigo-700 border-indigo-300' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {r === 'tpa' ? 'TPA / Insurer' : r === 'insurance' ? 'Insurance Co.' : r === 'patient' ? 'Patient' : 'Internal'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-1.5">Notes / Summary</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={4}
            placeholder="Summarise the discussion, decisions, and next steps…"
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 resize-y"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setNotes('')} className="text-xs font-semibold text-gray-500 hover:text-gray-700 px-3 py-2 rounded-xl border border-gray-200">
            Clear
          </button>
          <button type="button" onClick={handleLog} disabled={busy || !notes.trim()}
            className="flex items-center gap-1.5 text-xs font-semibold bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-xl disabled:opacity-50 transition-colors">
            {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {busy ? 'Saving…' : 'Log interaction'}
          </button>
        </div>
      </div>

      {/* Past interactions */}
      {filtered.length > 0 && (
        <div className="border-t border-gray-100">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Past {label}s</p>
            <button onClick={onRefresh} className="p-1 rounded text-gray-400 hover:text-indigo-600">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <ul className="divide-y divide-gray-100">
            {filtered.slice().sort((a, b) => new Date(b.sentAt ?? b.createdAt ?? 0).getTime() - new Date(a.sentAt ?? a.createdAt ?? 0).getTime()).map(c => (
              <li key={c.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-700">{c.recipientType?.toUpperCase()}</span>
                  <span className="text-[11px] text-gray-400">{relativeTime(c.sentAt ?? c.createdAt ?? '')}</span>
                </div>
                {c.bodySummary && <p className="text-xs text-gray-600 leading-relaxed">{c.bodySummary}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  caseId:          string;
  case_:           CoverageCase;
  currentState:    string;
  workflowHistory: WorkflowHistoryEntry[];
  approvalEvents:  ApprovalEvent[];
  historyLoading?: boolean;
  draft?:          CounsellorDraftSnapshot | null;
  initialComms?:   CcmsCommunicationLog[];
  /** When true, uses initialComms from parent cache instead of refetching on mount. */
  skipInitialFetch?: boolean;
  /** Keeps parent case page in sync when comms are loaded or sent. */
  onCommsChange?:  (comms: CcmsCommunicationLog[]) => void;
  canRecordTpaResponse?: boolean;
  onApplyInboundToPreAuth?: (comm: CcmsCommunicationLog, prefill: TpaResponsePrefill) => void;
}

// ── Main component ────────────────────────────────────────────────────────────

type Channel = 'email' | 'sms' | 'whatsapp' | 'phone' | 'in_person';

const CHANNEL_TABS: { id: Channel; label: string; icon: React.ElementType }[] = [
  { id: 'email',     label: 'Email',     icon: Mail },
  { id: 'sms',       label: 'SMS',       icon: MessageSquare },
  { id: 'whatsapp',  label: 'WhatsApp',  icon: MessageSquare },
  { id: 'phone',     label: 'Phone',     icon: Phone },
  { id: 'in_person', label: 'In Person', icon: Users },
];

export function CaseCommunicationsTab({
  caseId, case_, currentState, workflowHistory, approvalEvents,
  historyLoading, draft, initialComms, skipInitialFetch, onCommsChange,
  canRecordTpaResponse, onApplyInboundToPreAuth,
}: Props) {
  const queryClient = useQueryClient();
  const [activeChannel, setActiveChannel] = useState<Channel>('email');
  const [comms, setComms]                 = useState<CcmsCommunicationLog[]>(initialComms ?? []);
  const [commsLoading, setCommsLoading]   = useState(!skipInitialFetch || !initialComms);
  const [showCompose, setShowCompose]     = useState(true);
  const [templates, setTemplates]         = useState<CommunicationTemplate[]>([]);
  const [replyTo, setReplyTo]             = useState<CcmsCommunicationLog | null>(null);
  const composeRef                        = useRef<HTMLDivElement>(null);

  const loadComms = useCallback(async () => {
    setCommsLoading(true);
    try {
      const list = await listCommunications(caseId);
      setComms(list);
      onCommsChange?.(list);
      queryClient.setQueryData(ccmsKeys.communications(caseId), list);
    }
    catch { /* non-critical */ }
    finally { setCommsLoading(false); }
  }, [caseId, onCommsChange, queryClient]);

  useEffect(() => {
    if (initialComms) setComms(initialComms);
  }, [initialComms]);

  useEffect(() => {
    if (skipInitialFetch && initialComms) {
      setCommsLoading(false);
      return;
    }
    loadComms();
  }, [loadComms, skipInitialFetch, initialComms]);

  useEffect(() => {
    getCommunicationTemplates('email').then(setTemplates).catch(() => setTemplates([]));
  }, []);

  // Switch channel from suggestion chip
  const handleSuggestion = (s: { channel: string }) => {
    setActiveChannel(s.channel as Channel);
    setShowCompose(true);
  };

  // Handle Reply from thread view
  const handleReply = (comm: CcmsCommunicationLog) => {
    setReplyTo(comm);
    setShowCompose(true);
    setTimeout(() => composeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const handleSent = async () => {
    await loadComms();
    setShowCompose(false);
    setReplyTo(null);
  };

  const suggestions   = STATE_ACTIONS[currentState] ?? [];
  const stateLabel    = CCMS_STATE_LABELS[currentState] ?? currentState.replace(/_/g, ' ');

  const stateBadgeCls = (() => {
    if (['APPROVED', 'FULL_SETTLEMENT', 'RECONCILED', 'CLOSED'].includes(currentState)) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (['REJECTED', 'ABORTED', 'CANCELLED', 'EXPIRED'].includes(currentState))         return 'bg-red-100 text-red-700 border-red-200';
    if (['CLARIFICATION_REQUIRED', 'PARTIAL_APPROVAL', 'PARTIAL_SETTLEMENT'].includes(currentState)) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-indigo-100 text-indigo-700 border-indigo-200';
  })();

  const lastOutbound = useMemo(
    () => [...comms].sort((a, b) => new Date(b.sentAt ?? b.createdAt ?? 0).getTime() - new Date(a.sentAt ?? a.createdAt ?? 0).getTime())
            .find(c => c.direction === 'outbound'),
    [comms],
  );
  const daysSinceOutbound = lastOutbound?.sentAt
    ? Math.floor((Date.now() - new Date(lastOutbound.sentAt).getTime()) / 86_400_000)
    : null;

  return (
    <div className="space-y-4">
      {/* ── State context card ─────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-3 bg-gradient-to-r from-indigo-50/60 to-white border-b border-gray-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${stateBadgeCls}`}>{stateLabel}</span>
            {daysSinceOutbound !== null
              ? <span className="text-xs text-gray-500">Last outbound: <span className="font-semibold text-gray-700">{daysSinceOutbound === 0 ? 'today' : `${daysSinceOutbound}d ago`}</span></span>
              : <span className="text-xs text-gray-400 italic">No outbound messages yet</span>}
          </div>
          <button
            onClick={() => { setActiveChannel('email'); setShowCompose(v => !v); }}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-xl shadow-sm transition-colors"
          >
            <Mail className="w-3 h-3" />
            {showCompose && activeChannel === 'email' ? 'Hide compose' : 'Compose email'}
          </button>
        </div>
        {suggestions.length > 0 && (
          <div className="px-4 py-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Quick Actions</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s, i) => {
                const chipCls =
                  s.channel === 'email'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300'
                    : s.channel === 'sms' || s.channel === 'whatsapp'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
                    : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 hover:border-amber-300';
                const IconEl =
                  s.channel === 'email' ? <Mail          className="w-3.5 h-3.5 flex-shrink-0" /> :
                  s.channel === 'sms' || s.channel === 'whatsapp' ? <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" /> :
                                          <Phone         className="w-3.5 h-3.5 flex-shrink-0" />;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSuggestion(s)}
                    className={`flex items-center gap-2 text-xs font-semibold border px-3 py-2 rounded-xl transition-all shadow-sm ${chipCls}`}
                  >
                    {IconEl}
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Channel tabs ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-2xl px-2 py-2 shadow-sm overflow-x-auto">
        {CHANNEL_TABS.map(tab => {
          const Icon = tab.icon;
          const count = comms.filter(c => {
            const ct = c.communicationType?.toLowerCase() ?? '';
            if (tab.id === 'email')     return ct === 'email';
            if (tab.id === 'sms')       return ct === 'sms';
            if (tab.id === 'whatsapp')  return ct === 'whatsapp';
            if (tab.id === 'phone')     return ct === 'phone';
            if (tab.id === 'in_person') return ct === 'in_person';
            return false;
          }).length;
          const activeCls =
            tab.id === 'email'    ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-500' :
            tab.id === 'sms'      ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500' :
            tab.id === 'whatsapp' ? 'bg-teal-600 text-white shadow-sm ring-1 ring-teal-500' :
            tab.id === 'phone'    ? 'bg-amber-500 text-white shadow-sm ring-1 ring-amber-400' :
                                    'bg-gray-700 text-white shadow-sm ring-1 ring-gray-600';
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveChannel(tab.id); if (tab.id !== 'email') setShowCompose(true); }}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all flex-shrink-0 ${
                activeChannel === tab.id ? activeCls : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {count > 0 && (
                <span className={`text-[10px] px-1.5 rounded-full font-bold ${
                  activeChannel === tab.id ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Email channel ──────────────────────────────────────────────────── */}
      {activeChannel === 'email' && (
        <>
          {/* Compose panel */}
          {showCompose && (
            <div ref={composeRef}>
              <EmailComposePanel
                key={replyTo?.id ?? 'new'}
                caseId={caseId}
                case_={case_}
                currentState={currentState}
                draft={draft}
                comms={comms}
                templates={templates}
                initialSubject={replyTo?.subject ? `Re: ${replyTo.subject}` : ''}
                initialTo={replyTo?.recipientAddress ? [replyTo.recipientAddress] : []}
                onSent={handleSent}
                onDiscard={() => { setShowCompose(false); setReplyTo(null); }}
              />
            </div>
          )}

          {/* Show compose button when hidden */}
          {!showCompose && (
            <button
              type="button"
              onClick={() => setShowCompose(true)}
              className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-indigo-700 bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-2xl py-4 hover:bg-indigo-100 transition-colors"
            >
              <Mail className="w-4 h-4" /> Compose new email
            </button>
          )}

          {/* Thread history */}
          <EmailThreadPanel
            comms={comms}
            workflowHistory={workflowHistory}
            approvalEvents={approvalEvents}
            loading={commsLoading || (historyLoading ?? false)}
            onReply={handleReply}
            onRefresh={loadComms}
            onApplyToPreAuth={onApplyInboundToPreAuth}
            canRecordTpaResponse={canRecordTpaResponse}
          />
        </>
      )}

      {/* ── SMS / WhatsApp channel ─────────────────────────────────────────── */}
      {(activeChannel === 'sms' || activeChannel === 'whatsapp') && (
        <SmsBubbleView
          caseId={caseId}
          channel={activeChannel}
          comms={comms}
          draft={draft}
          loading={commsLoading}
          case_={case_}
          currentState={currentState}
          onRefresh={loadComms}
        />
      )}

      {/* ── Phone / In-person channel ──────────────────────────────────────── */}
      {(activeChannel === 'phone' || activeChannel === 'in_person') && (
        <PhoneLogView
          caseId={caseId}
          channel={activeChannel}
          comms={comms}
          loading={commsLoading}
          onRefresh={loadComms}
        />
      )}
    </div>
  );
}
