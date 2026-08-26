'use client';

import { useEffect, useMemo, useState, type DragEvent, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { getOtTheaters, type OtTheater } from '@/lib/api/widgets.api';
import { ipManagementApi, type JourneySlotRowDto, type SlotBoardDto, type UnassignedSlotCandidateDto } from '@/lib/api/ip-management.api';
import { useAuthStore } from '@/lib/auth-store';
import { useSlotsQuery } from '@/hooks/use-slots-query';
import { IpOverlayDialog } from '@/components/ip-management/IpOverlayDialog';
import { IpTargetFrame } from '@/components/ip-management/IpTargetFrame';
import { ReasonConfirmDialog } from '@/components/ip-management/ReasonConfirmDialog';
import { resolveIpRoleActions } from '@/lib/ip-management/ip-role-actions';
import {
  formatArriveLabel,
  formatBoardScopeDate,
  formatDurationMinutes,
  formatSlotLabel,
  SLOT_SESSIONS,
  slotCardBadges,
  type IpSlotSession,
} from '@/lib/ip-management/ip-slot-display';
import { IP_SLOT_TEST_IDS } from '@/lib/ip-management/ip-slot-test-ids';
import { ipRealtimeQueryKeys } from '@/lib/ip-management/ip-realtime-events';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const SESSION_WINDOW: Record<IpSlotSession, string> = {
  Morning: '07:30–12:30',
  Afternoon: '13:30–17:00',
  Evening: '17:30–20:00',
};

const SESSION_PREFIX: Record<IpSlotSession, string> = {
  Morning: 'AM',
  Afternoon: 'PM',
  Evening: 'EV',
};

const UNASSIGNED_MIME = 'application/x-hp-unassigned';
const SLOT_MIME = 'application/x-hp-slot';

function canMoveRow(row: JourneySlotRowDto): boolean {
  const clinical = row.clinicalState ?? '';
  const ot = row.otState ?? '';
  return clinical !== 'SentToOT' && clinical !== 'InOT' && ot !== 'SentToOT' && ot !== 'Accepted' && ot !== 'InProgress';
}

function badgeClass(tone: string): string {
  if (tone === 'ok') return 'ok';
  if (tone === 'ot') return 'ot';
  if (tone === 'efc') return 'efc';
  if (tone === 'inhouse') return 'inhouse';
  return 'danger';
}

export function IpSlotBoard({ compact = false }: { compact?: boolean }) {
  const { user, permissions } = useAuthStore();
  const branchId = user?.branchId;
  const canMutate = resolveIpRoleActions(permissions).canSendToOt;
  const queryClient = useQueryClient();

  const [date, setDate] = useState(todayIso);
  const [theatres, setTheatres] = useState<OtTheater[]>([]);
  const [theatreId, setTheatreId] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignSession, setAssignSession] = useState<IpSlotSession>('Morning');
  const [assignJourneyId, setAssignJourneyId] = useState('');
  const [busy, setBusy] = useState(false);
  const [dropOver, setDropOver] = useState<IpSlotSession | null>(null);
  const [releaseRow, setReleaseRow] = useState<JourneySlotRowDto | null>(null);

  useEffect(() => {
    if (!branchId) return;
    void getOtTheaters(branchId).then(list => {
      setTheatres(list);
      setTheatreId(prev => prev || list[0]?.id || '');
    });
  }, [branchId]);

  const theatreName = theatres.find(t => t.id === theatreId)?.name;
  const slotsQuery = useSlotsQuery(branchId, date, theatreId || undefined, Boolean(branchId));
  const board: SlotBoardDto = slotsQuery.data ?? {
    date,
    theatreId: theatreId || null,
    morning: [],
    afternoon: [],
    evening: [],
    unassigned: [],
  };

  const [metrics, setMetrics] = useState<{
    assignedCount: number;
    readyCount: number;
    avgArrivalToDischargeMinutes: number | null;
    avgTurnoverMinutes: number | null;
  } | null>(null);
  useEffect(() => {
    if (!branchId || !date) return;
    void ipManagementApi.getSlotMetrics({ branchId, date, theatreId: theatreId || undefined }).then(setMetrics);
  }, [branchId, date, theatreId, slotsQuery.dataUpdatedAt]);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ipRealtimeQueryKeys.slotsAll });
    await queryClient.invalidateQueries({ queryKey: ipRealtimeQueryKeys.journeysAll });
  }

  async function onAssign(journeyId = assignJourneyId, session = assignSession) {
    if (!branchId || !theatreId || !journeyId) return;
    setBusy(true);
    try {
      await ipManagementApi.assignSlot({
        journeyId,
        branchId,
        theatreId,
        slotDate: date,
        session,
        theatreName,
      });
      toast.success('Slot assigned');
      setAssignOpen(false);
      setAssignJourneyId('');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not assign slot.');
    } finally {
      setBusy(false);
    }
  }

  async function move(session: IpSlotSession, index: number, delta: number) {
    const list = session === 'Morning' ? board.morning : session === 'Afternoon' ? board.afternoon : board.evening;
    const next = index + delta;
    if (next < 0 || next >= list.length || !branchId || !theatreId) return;
    if (!canMoveRow(list[index]) || !canMoveRow(list[next])) {
      toast.error('Patients already sent to OT cannot move.');
      return;
    }
    const ids = list.map(s => s.journeyId);
    const swap = ids[index];
    ids[index] = ids[next];
    ids[next] = swap;
    setBusy(true);
    try {
      await ipManagementApi.reorderSlots({
        branchId,
        theatreId,
        slotDate: date,
        session,
        journeyIds: ids,
        theatreName,
      });
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not reorder slots.');
    } finally {
      setBusy(false);
    }
  }

  async function release(slotId: string, reason: string) {
    setBusy(true);
    try {
      await ipManagementApi.releaseSlot(slotId, reason);
      toast.success('Slot released. The ward has been notified.');
      setReleaseRow(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not release slot.');
    } finally {
      setBusy(false);
    }
  }

  const sessions = useMemo(() => {
    const all: IpSlotSession[] = [...SLOT_SESSIONS];
    if (compact) return all.filter(s => s !== 'Evening' || board.evening.length > 0);
    return all.filter(s => s !== 'Evening' || board.evening.length > 0);
  }, [compact, board.evening.length]);

  const assigned = metrics?.assignedCount ?? (board.morning.length + board.afternoon.length + board.evening.length);
  const ready = metrics?.readyCount ?? 0;
  const blocked = Math.max(0, assigned - ready);
  const emptyBoard = assigned === 0;

  function openAssign(session: IpSlotSession, journeyId?: string) {
    setAssignSession(session);
    setAssignJourneyId(journeyId ?? '');
    setAssignOpen(true);
  }

  function onUnassignedKey(e: KeyboardEvent, u: UnassignedSlotCandidateDto) {
    if (e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      openAssign('Morning', u.journeyId);
    }
  }

  function handleDrop(session: IpSlotSession, e: DragEvent) {
    e.preventDefault();
    setDropOver(null);
    if (!canMutate) return;
    const unassignedId = e.dataTransfer.getData(UNASSIGNED_MIME);
    if (unassignedId) {
      void onAssign(unassignedId, session);
      return;
    }
    const slotPayload = e.dataTransfer.getData(SLOT_MIME);
    if (!slotPayload) return;
    try {
      const parsed = JSON.parse(slotPayload) as { journeyId: string; session: IpSlotSession };
      if (parsed.session !== session) return;
      const list = session === 'Morning' ? board.morning : session === 'Afternoon' ? board.afternoon : board.evening;
      const from = list.findIndex(r => r.journeyId === parsed.journeyId);
      if (from < 0) return;
      const to = list.length - 1;
      if (from === to) return;
      void move(session, from, to - from);
    } catch {
      /* ignore malformed drag payload */
    }
  }

  const assignPreview = formatSlotLabel(assignSession, (
    assignSession === 'Morning' ? board.morning : assignSession === 'Afternoon' ? board.afternoon : board.evening
  ).length + 1);

  return (
    <IpTargetFrame testId={IP_SLOT_TEST_IDS.board} className={compact ? 'ip-target--compact' : undefined}>
      <div className="app-header">
        <h1>{compact ? 'Today’s slots' : 'Slot board'}</h1>
        <span className="scope">{formatBoardScopeDate(date)} · {theatreName || 'Theatre'}</span>
        <span className="spacer" />
        <label className="filter-field">
          <span>Date</span>
          <input
            id={IP_SLOT_TEST_IDS.date}
            data-testid={IP_SLOT_TEST_IDS.date}
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="input"
            style={{ width: 148 }}
          />
        </label>
        <label className="filter-field">
          <span>Theatre</span>
          <select
            data-testid={IP_SLOT_TEST_IDS.theatre}
            value={theatreId}
            onChange={e => setTheatreId(e.target.value)}
            className="input"
            style={{ width: 160 }}
            aria-label="Theatre"
          >
          {theatres.length === 0 && <option value="">No theatres</option>}
          {theatres.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
          </select>
        </label>
        <button type="button" className="btn sm" onClick={() => void refresh()}>↻ Refresh</button>
        {!compact && (
          <Link className="btn sm" href="/dashboard/ip-management/operation-theatre">OT board</Link>
        )}
        {compact && (
          <Link className="btn sm" href="/dashboard/ip-management/slots">Open full board</Link>
        )}
        {!compact && (
          <Link className="btn sm ghost" href="/dashboard/ip-management/throughput">Period throughput</Link>
        )}
      </div>

      {!compact && (
        <div className="kpis">
          <div className="kpi">
            <div className="label">Scheduled</div>
            <div className="value num">{assigned}</div>
          </div>
          <div className="kpi is-inhouse">
            <div className="label">Ready</div>
            <div className="value num">{ready}</div>
          </div>
          <div className={`kpi ${blocked > 0 ? 'is-alert' : ''}`}>
            <div className="label">Blocked</div>
            <div className="value num">{blocked}</div>
          </div>
          <div className="kpi">
            <div className="label">Arrival → discharge</div>
            <div className="value num">{formatDurationMinutes(metrics?.avgArrivalToDischargeMinutes)}</div>
            <div className="src">median today</div>
          </div>
          <div className="kpi">
            <div className="label">Turnover</div>
            <div className="value num">{formatDurationMinutes(metrics?.avgTurnoverMinutes)}</div>
            <div className="src">median today</div>
          </div>
        </div>
      )}

      {emptyBoard && !slotsQuery.isLoading ? (
        <div className="empty">
          <div className="big">Nothing is scheduled for {formatBoardScopeDate(date)}.</div>
          Build a list from patients ready for theatre.
          {canMutate && board.unassigned.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <button type="button" className="btn sm primary" onClick={() => openAssign('Morning')}>
                Assign from unassigned
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className={`board ${sessions.length > 2 ? 'cols-3' : ''}`}>
          {sessions.map(session => {
            const rows = session === 'Morning' ? board.morning : session === 'Afternoon' ? board.afternoon : board.evening;
            return (
              <div key={session} className="board-col">
                <div className="h">
                  {session} session · {SESSION_WINDOW[session]}
                  {theatreName ? ` · ${theatreName}` : ''}
                </div>
                <div
                  className="body"
                  onDragOver={e => { e.preventDefault(); setDropOver(session); }}
                  onDragLeave={() => setDropOver(current => current === session ? null : current)}
                  onDrop={e => handleDrop(session, e)}
                >
                  {rows.map((row, index) => {
                    const locked = !canMoveRow(row);
                    const badges = slotCardBadges(row);
                    const label = row.slotLabel || formatSlotLabel(session, row.sequenceNo) || `${SESSION_PREFIX[session]}-${row.sequenceNo}`;
                    return (
                      <div
                        key={row.id}
                        data-testid={IP_SLOT_TEST_IDS.row(row.journeyId)}
                        className={`slot-card ${locked ? 'is-locked' : ''}`}
                        draggable={canMutate && !locked}
                        onDragStart={e => {
                          e.dataTransfer.setData(SLOT_MIME, JSON.stringify({ journeyId: row.journeyId, session }));
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                      >
                        <div className="top">
                          <span className="seq">{label}</span>
                          <span className="who">{row.patientName ?? row.uhid ?? '—'}</span>
                          <span className="when">{formatArriveLabel(row.plannedArrivalAt)}</span>
                        </div>
                        <div className="sub">
                          {[row.procedureName, row.eyeOperated, row.uhid].filter(Boolean).join(' · ') || '—'}
                        </div>
                        <div className="row" style={{ marginTop: 6 }}>
                          {badges.map(b => (
                            <span key={b.label} className={`badge ${badgeClass(b.tone)}`}>{b.label}</span>
                          ))}
                          {canMutate && (
                            <span className="spacer" style={{ flex: 1 }} />
                          )}
                          {canMutate && !locked && (
                            <>
                              <button type="button" className="btn sm" aria-label="Move earlier" disabled={busy || index === 0} onClick={() => void move(session, index, -1)}>↑</button>
                              <button type="button" className="btn sm" aria-label="Move later" disabled={busy || index === rows.length - 1} onClick={() => void move(session, index, 1)}>↓</button>
                              <button type="button" className="btn sm danger" aria-label="Release slot" disabled={busy} onClick={() => setReleaseRow(row)}>Release</button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    data-testid={IP_SLOT_TEST_IDS.assign(session)}
                    className={`dropzone ${dropOver === session ? 'is-over' : ''}`}
                    disabled={!canMutate}
                    onClick={() => canMutate && openAssign(session)}
                  >
                    Drop a patient here to add to the {session.toLowerCase()} session
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ padding: '0 16px 14px' }}>
        <div className="panel">
          <p className="panel-h">Unassigned today ({board.unassigned.length})</p>
          <div className="row">
            {board.unassigned.length === 0 && <span className="muted">No unassigned patients.</span>}
            {board.unassigned.map(u => (
              <button
                key={u.journeyId}
                type="button"
                className="btn sm"
                draggable={canMutate}
                tabIndex={0}
                onKeyDown={e => onUnassignedKey(e, u)}
                onDragStart={e => {
                  e.dataTransfer.setData(UNASSIGNED_MIME, u.journeyId);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => canMutate && openAssign('Morning', u.journeyId)}
              >
                {u.patientName ?? u.uhid ?? 'Patient'} · {[u.procedureName, u.eyeOperated].filter(Boolean).join(' ') || '—'}
              </button>
            ))}
          </div>
          <p className="hint">
            Drag onto a session, or use the keyboard: focus a patient, press <kbd>A</kbd>, choose a session and sequence.
          </p>
        </div>
      </div>

      <IpOverlayDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title={`Assign slot${assignJourneyId ? '' : ''}`}
        size="sm"
        testId={IP_SLOT_TEST_IDS.assignDialog}
      >
        <div className="ip-target" style={{ padding: 16 }}>
          <div className="cols-2">
            <div className="field">
              <label>Date</label>
              <input className="input" value={formatBoardScopeDate(date)} readOnly />
            </div>
            <div className="field">
              <label>Theatre</label>
              <input className="input" value={theatreName || '—'} readOnly />
            </div>
            <div className="field">
              <label>Slot</label>
              <input className="input" value={`${assignPreview ?? `${SESSION_PREFIX[assignSession]}-1`} · ${SESSION_WINDOW[assignSession]}`} readOnly />
            </div>
            <div className="field">
              <label>Session</label>
              <select className="input" value={assignSession} onChange={e => setAssignSession(e.target.value as IpSlotSession)}>
                {SLOT_SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Patient</label>
            <select
              data-testid={IP_SLOT_TEST_IDS.assignPatient}
              value={assignJourneyId}
              onChange={e => setAssignJourneyId(e.target.value)}
              className="input"
            >
              <option value="">Select unassigned patient</option>
              {board.unassigned.map(u => (
                <option key={u.journeyId} value={u.journeyId}>
                  {u.patientName ?? u.uhid ?? u.journeyId} · {u.procedureName ?? '—'}
                </option>
              ))}
            </select>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn sm" onClick={() => setAssignOpen(false)}>Cancel</button>
            <button
              type="button"
              data-testid={IP_SLOT_TEST_IDS.assignSubmit}
              className="btn sm primary"
              disabled={busy || !assignJourneyId}
              onClick={() => void onAssign()}
            >
              Assign slot
            </button>
          </div>
        </div>
      </IpOverlayDialog>

      <ReasonConfirmDialog
        open={Boolean(releaseRow)}
        onOpenChange={open => { if (!open) setReleaseRow(null); }}
        title={releaseRow ? `Release ${releaseRow.slotLabel || 'slot'}` : 'Release slot'}
        patientName={releaseRow?.patientName ?? undefined}
        patientMeta={releaseRow ? [releaseRow.uhid, releaseRow.procedureName].filter(Boolean).join(' · ') : undefined}
        consequence={
          <>
            The patient will have no scheduled slot. They remain admitted and keep their bed.
          </>
        }
        confirmLabel="Release"
        destructive
        busy={busy}
        minReasonLength={3}
        onConfirm={reason => releaseRow && void release(releaseRow.id, reason)}
      />
    </IpTargetFrame>
  );
}
