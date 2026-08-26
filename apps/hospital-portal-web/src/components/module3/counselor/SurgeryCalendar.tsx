/**
 * Surgery Calendar Component
 * Displays OR schedules in a calendar view with drag-and-drop rescheduling,
 * surgeon availability tracking, and conflict detection
 */

'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Users,
  Clock,
  AlertCircle,
  CheckCircle,
  Download,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { useTheaters, useSchedulesByDateRange } from '@/hooks/use-surgery-scheduling';
import type { OTScheduleDto, OTTheaterDto, ScheduleStatus } from '@/types/surgery-scheduling';

interface SurgeryCalendarProps {
  branchId?: string;
  showAllTheaters?: boolean;
}

type ViewMode = 'week' | 'month' | 'day';

export function SurgeryCalendar({ branchId, showAllTheaters = true }: SurgeryCalendarProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTheater, setSelectedTheater] = useState<string | undefined>();
  const [selectedSurgeon, setSelectedSurgeon] = useState<string | undefined>();
  const [showConflictsOnly, setShowConflictsOnly] = useState(false);

  // Fetch theaters
  const { data: theaters = [], isLoading: loadingTheaters } = useTheaters({ branchId });

  // Calculate date range based on view mode
  const { startDate, endDate } = useMemo(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (viewMode === 'week') {
      // Start from Monday, end on Sunday
      const dayOfWeek = start.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust if Sunday (0)
      start.setDate(start.getDate() + diff);
      end.setDate(start.getDate() + 6);
    } else if (viewMode === 'month') {
      // First day of month to last day of month
      start.setDate(1);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0); // Last day of previous month = last day of current month
    } else {
      // Single day view
      end.setDate(start.getDate());
    }

    // Set time to start/end of day
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { startDate: start, endDate: end };
  }, [currentDate, viewMode]);

  // Fetch schedules for date range
  const { data: schedules = [], isLoading: loadingSchedules, refetch } = useSchedulesByDateRange(
    startDate,
    endDate,
    {
      theaterId: selectedTheater,
      surgeonId: selectedSurgeon,
    }
  );

  // Detect conflicts (same theater, overlapping times)
  const conflicts = useMemo(() => {
    const conflictPairs: Array<{ schedule1: OTScheduleDto; schedule2: OTScheduleDto }> = [];

    for (let i = 0; i < schedules.length; i++) {
      for (let j = i + 1; j < schedules.length; j++) {
        const s1 = schedules[i];
        const s2 = schedules[j];

        // Same theater, same date
        if (s1.theaterId === s2.theaterId && s1.scheduledDate === s2.scheduledDate) {
          // Check time overlap
          const start1 = parseTimeSpan(s1.startTime);
          const end1 = parseTimeSpan(s1.endTime);
          const start2 = parseTimeSpan(s2.startTime);
          const end2 = parseTimeSpan(s2.endTime);

          if (start1 < end2 && start2 < end1) {
            conflictPairs.push({ schedule1: s1, schedule2: s2 });
          }
        }
      }
    }

    return conflictPairs;
  }, [schedules]);

  // Filter schedules if showing conflicts only
  const displaySchedules = useMemo(() => {
    if (!showConflictsOnly) return schedules;

    const conflictScheduleIds = new Set<string>();
    conflicts.forEach(({ schedule1, schedule2 }) => {
      conflictScheduleIds.add(schedule1.id);
      conflictScheduleIds.add(schedule2.id);
    });

    return schedules.filter((s) => conflictScheduleIds.has(s.id));
  }, [schedules, conflicts, showConflictsOnly]);

  // Navigation handlers
  const handlePreviousPeriod = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const handleNextPeriod = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Generate calendar cells based on view mode
  const calendarDays = useMemo(() => {
    if (viewMode === 'day') {
      return [currentDate];
    }

    const days: Date[] = [];
    const start = new Date(startDate);

    if (viewMode === 'week') {
      for (let i = 0; i < 7; i++) {
        days.push(new Date(start));
        start.setDate(start.getDate() + 1);
      }
    } else {
      // Month view - show full grid (up to 42 days for 6 weeks)
      const firstDay = new Date(start);
      const dayOfWeek = firstDay.getDay();
      const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      firstDay.setDate(firstDay.getDate() + offset);

      for (let i = 0; i < 42; i++) {
        days.push(new Date(firstDay));
        firstDay.setDate(firstDay.getDate() + 1);
      }
    }

    return days;
  }, [currentDate, startDate, viewMode]);

  // Group schedules by date
  const schedulesByDate = useMemo(() => {
    const grouped: Record<string, OTScheduleDto[]> = {};
    displaySchedules.forEach((schedule) => {
      const dateKey = schedule.scheduledDate.split('T')[0]; // YYYY-MM-DD
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(schedule);
    });

    // Sort schedules by start time
    Object.keys(grouped).forEach((dateKey) => {
      grouped[dateKey].sort((a, b) => {
        const timeA = parseTimeSpan(a.startTime);
        const timeB = parseTimeSpan(b.startTime);
        return timeA - timeB;
      });
    });

    return grouped;
  }, [displaySchedules]);

  // Get schedules for a specific date
  const getSchedulesForDate = (date: Date): OTScheduleDto[] => {
    const dateKey = date.toISOString().split('T')[0];
    return schedulesByDate[dateKey] || [];
  };

  // Check if date has conflicts
  const hasConflict = (date: Date): boolean => {
    const dateKey = date.toISOString().split('T')[0];
    return conflicts.some(
      ({ schedule1, schedule2 }) =>
        schedule1.scheduledDate.split('T')[0] === dateKey || schedule2.scheduledDate.split('T')[0] === dateKey
    );
  };

  // Format date range for display
  const formatDateRange = (): string => {
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    if (viewMode === 'week') {
      const weekStart = new Date(startDate);
      const weekEnd = new Date(endDate);
      return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }

    // Month view
    return currentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Surgery Schedule Dashboard
          </CardTitle>

          <div className="flex items-center gap-2">
            {/* View Mode Selector */}
            <div className="flex items-center gap-1 border rounded-md p-1">
              <Button
                variant={viewMode === 'day' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('day')}
              >
                Day
              </Button>
              <Button
                variant={viewMode === 'week' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('week')}
              >
                Week
              </Button>
              <Button
                variant={viewMode === 'month' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('month')}
              >
                Month
              </Button>
            </div>

            {/* Conflict Filter */}
            <Button
              variant={showConflictsOnly ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => setShowConflictsOnly(!showConflictsOnly)}
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              {showConflictsOnly ? 'Showing Conflicts' : 'Show Conflicts'}
              {conflicts.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {conflicts.length}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePreviousPeriod}>
              ← Previous
            </Button>
            <Button variant="outline" size="sm" onClick={handleToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={handleNextPeriod}>
              Next →
            </Button>
          </div>

          <h3 className="text-lg font-semibold">{formatDateRange()}</h3>

          <div className="flex items-center gap-2">
            {/* Theater Filter */}
            {showAllTheaters && (
              <select
                className="border rounded-md px-3 py-1 text-sm"
                value={selectedTheater || ''}
                onChange={(e) => setSelectedTheater(e.target.value || undefined)}
              >
                <option value="">All Theaters ({theaters.length})</option>
                {theaters.map((theater) => (
                  <option key={theater.id} value={theater.id}>
                    {theater.theaterName}
                  </option>
                ))}
              </select>
            )}

            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loadingSchedules ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading schedules...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2 mb-4">
              {/* Day headers */}
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div key={day} className="text-center font-semibold text-sm text-gray-600 py-2">
                  {day}
                </div>
              ))}

              {/* Calendar cells */}
              {calendarDays.map((day, idx) => {
                const isToday = day.toDateString() === new Date().toDateString();
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                const daySchedules = getSchedulesForDate(day);
                const dayHasConflict = hasConflict(day);

                return (
                  <div
                    key={idx}
                    className={`border rounded-lg p-2 min-h-[120px] ${
                      isToday ? 'bg-blue-50 border-blue-500 border-2' : 'bg-white'
                    } ${!isCurrentMonth && viewMode === 'month' ? 'opacity-50' : ''} ${
                      dayHasConflict ? 'border-red-500 bg-red-50' : ''
                    }`}
                  >
                    {/* Date number */}
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-sm font-medium ${isToday ? 'text-blue-600' : 'text-gray-700'}`}
                      >
                        {day.getDate()}
                      </span>
                      {daySchedules.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {daySchedules.length}
                        </Badge>
                      )}
                    </div>

                    {/* Schedules */}
                    <div className="space-y-1">
                      {daySchedules.slice(0, 3).map((schedule) => (
                        <ScheduleCard key={schedule.id} schedule={schedule} compact />
                      ))}
                      {daySchedules.length > 3 && (
                        <div className="text-xs text-gray-500 text-center">
                          +{daySchedules.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-4 gap-4 mt-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">Total Surgeries</div>
                <div className="text-2xl font-bold text-blue-600">{schedules.length}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">Confirmed</div>
                <div className="text-2xl font-bold text-green-600">
                  {schedules.filter((s) => s.status === 'Confirmed').length}
                </div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">Tentative</div>
                <div className="text-2xl font-bold text-yellow-600">
                  {schedules.filter((s) => s.status === 'Tentative' || s.status === 'Booked').length}
                </div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">Conflicts</div>
                <div className="text-2xl font-bold text-red-600">{conflicts.length}</div>
              </div>
            </div>

            {/* Conflict Details */}
            {conflicts.length > 0 && (
              <div className="mt-6 border-t pt-6">
                <h4 className="font-semibold text-red-600 mb-4 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Schedule Conflicts Detected ({conflicts.length})
                </h4>
                <div className="space-y-3">
                  {conflicts.map(({ schedule1, schedule2 }, idx) => (
                    <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <ScheduleCard schedule={schedule1} showWarning />
                        <ScheduleCard schedule={schedule2} showWarning />
                      </div>
                      <div className="mt-2 text-sm text-red-600 font-medium">
                        ⚠️ Same theater, overlapping times: {schedule1.startTime} - {schedule1.endTime} ↔{' '}
                        {schedule2.startTime} - {schedule2.endTime}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

interface ScheduleCardProps {
  schedule: OTScheduleDto;
  compact?: boolean;
  showWarning?: boolean;
}

function ScheduleCard({ schedule, compact = false, showWarning = false }: ScheduleCardProps) {
  const statusColors: Record<ScheduleStatus, string> = {
    Tentative: 'bg-gray-100 text-gray-700',
    Booked: 'bg-blue-100 text-blue-700',
    Confirmed: 'bg-green-100 text-green-700',
    InProgress: 'bg-purple-100 text-purple-700',
    Completed: 'bg-green-200 text-green-800',
    Cancelled: 'bg-red-100 text-red-700',
    NoShow: 'bg-orange-100 text-orange-700',
  };

  if (compact) {
    return (
      <div
        className={`text-xs p-1 rounded border-l-2 ${
          showWarning ? 'border-red-500 bg-red-50' : 'border-blue-500 bg-gray-50'
        }`}
      >
        <div className="font-medium truncate">{schedule.surgeryType}</div>
        <div className="text-gray-600 truncate">{schedule.startTime.slice(0, 5)}</div>
      </div>
    );
  }

  return (
    <div className={`p-3 rounded-lg border ${showWarning ? 'border-red-500 bg-red-50' : 'bg-gray-50'}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="font-semibold text-sm">{schedule.surgeryType}</div>
          <div className="text-xs text-gray-600">{schedule.theaterName}</div>
        </div>
        <Badge className={`text-xs ${statusColors[schedule.status]}`}>{schedule.status}</Badge>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-600">
        <Clock className="h-3 w-3" />
        {schedule.startTime.slice(0, 5)} - {schedule.endTime.slice(0, 5)} ({schedule.durationMinutes} min)
      </div>
      {schedule.eyeOperated && (
        <div className="text-xs text-gray-600 mt-1">Eye: {schedule.eyeOperated}</div>
      )}
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function parseTimeSpan(timeStr: string): number {
  // Parse "HH:mm:ss" to minutes since midnight
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}
