/**
 * Surgeon Availability Tracker
 * Real-time surgeon schedule view with availability checking and conflict detection
 */

'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle }from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Clock, User, Calendar, AlertCircle, CheckCircle, Search } from 'lucide-react';
import { toast } from '@/lib/toast';
import { useSchedulesByDateRange, useSurgeonAvailability } from '@/hooks/use-surgery-scheduling';
import type { OTScheduleDto } from '@/types/surgery-scheduling';

interface SurgeonAvailabilityTrackerProps {
  selectedDate?: Date;
  branchId?: string;
}

interface SurgeonSummary {
  surgeonId: string;
  surgeonName: string;
  schedules: OTScheduleDto[];
  totalSurgeries: number;
  totalDurationMinutes: number;
  busySlots: Array<{ start: string; end: string }>;
  availableSlots: Array<{ start: string; end: string }>;
  conflicts: Array<{ schedule1: OTScheduleDto; schedule2: OTScheduleDto }>;
}

export function SurgeonAvailabilityTracker({ selectedDate = new Date(), branchId }: SurgeonAvailabilityTrackerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSurgeon, setSelectedSurgeon] = useState<string | undefined>();

  // Fetch schedules for selected date
  const startDate = useMemo(() => {
    const date = new Date(selectedDate);
    date.setHours(0, 0, 0, 0);
    return date;
  }, [selectedDate]);

  const endDate = useMemo(() => {
    const date = new Date(selectedDate);
    date.setHours(23, 59, 59, 999);
    return date;
  }, [selectedDate]);

  const { data: schedules = [], isLoading: loadingSchedules } = useSchedulesByDateRange(startDate, endDate, {});

  // Group schedules by surgeon
  const surgeonSummaries = useMemo((): SurgeonSummary[] => {
    const surgeonMap = new Map<string, SurgeonSummary>();

    schedules
      .filter((s) => s.status !== 'Cancelled' && s.status !== 'NoShow')
      .forEach((schedule) => {
        if (!surgeonMap.has(schedule.surgeonId)) {
          surgeonMap.set(schedule.surgeonId, {
            surgeonId: schedule.surgeonId,
            surgeonName: getSurgeonName(schedule), // Extract from schedule metadata
            schedules: [],
            totalSurgeries: 0,
            totalDurationMinutes: 0,
            busySlots: [],
            availableSlots: [],
            conflicts: [],
          });
        }

        const summary = surgeonMap.get(schedule.surgeonId)!;
        summary.schedules.push(schedule);
        summary.totalSurgeries++;
        summary.totalDurationMinutes += schedule.durationMinutes;

        summary.busySlots.push({
          start: schedule.startTime,
          end: schedule.endTime,
        });
      });

    // Detect conflicts (overlapping schedules for same surgeon)
    surgeonMap.forEach((summary) => {
      const sorted = summary.schedules.sort((a, b) => parseTimeSpan(a.startTime) - parseTimeSpan(b.startTime));

      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const s1 = sorted[i];
          const s2 = sorted[j];

          // Check time overlap
          const start1 = parseTimeSpan(s1.startTime);
          const end1 = parseTimeSpan(s1.endTime);
          const start2 = parseTimeSpan(s2.startTime);
          const end2 = parseTimeSpan(s2.endTime);

          if (start1 < end2 && start2 < end1) {
            summary.conflicts.push({ schedule1: s1, schedule2: s2 });
          }
        }
      }

      // Calculate available slots (gaps between surgeries)
      summary.availableSlots = calculateAvailableSlots(summary.busySlots);
    });

    return Array.from(surgeonMap.values());
  }, [schedules]);

  // Filter surgeons by search term
  const filteredSurgeons = useMemo(() => {
    if (!searchTerm) return surgeonSummaries;
    const term = searchTerm.toLowerCase();
    return surgeonSummaries.filter((s) => s.surgeonName.toLowerCase().includes(term));
  }, [surgeonSummaries, searchTerm]);

  // Sort by workload (most busy first)
  const sortedSurgeons = useMemo(() => {
    return [...filteredSurgeons].sort((a, b) => b.totalDurationMinutes - a.totalDurationMinutes);
  }, [filteredSurgeons]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Surgeon Availability - {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </CardTitle>

          <div className="flex items-center gap-2">
            {/* Search Filter */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search surgeon..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Active Surgeons</div>
            <div className="text-2xl font-bold text-blue-600">{sortedSurgeons.length}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Total Surgeries</div>
            <div className="text-2xl font-bold text-green-600">
              {sortedSurgeons.reduce((sum, s) => sum + s.totalSurgeries, 0)}
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Total Hours</div>
            <div className="text-2xl font-bold text-purple-600">
              {Math.round(sortedSurgeons.reduce((sum, s) => sum + s.totalDurationMinutes, 0) / 60)}h
            </div>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Conflicts</div>
            <div className="text-2xl font-bold text-red-600">
              {sortedSurgeons.reduce((sum, s) => sum + s.conflicts.length, 0)}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loadingSchedules ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading surgeon schedules...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedSurgeons.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No surgeons scheduled for this date.</p>
              </div>
            ) : (
              sortedSurgeons.map((surgeon) => (
                <SurgeonCard
                  key={surgeon.surgeonId}
                  surgeon={surgeon}
                  selectedDate={selectedDate}
                  isExpanded={selectedSurgeon === surgeon.surgeonId}
                  onToggleExpand={() =>
                    setSelectedSurgeon(selectedSurgeon === surgeon.surgeonId ? undefined : surgeon.surgeonId)
                  }
                />
              ))
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

interface SurgeonCardProps {
  surgeon: SurgeonSummary;
  selectedDate: Date;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function SurgeonCard({ surgeon, selectedDate, isExpanded, onToggleExpand }: SurgeonCardProps) {
  const utilizationPercentage = Math.round((surgeon.totalDurationMinutes / (8 * 60)) * 100); // Assuming 8-hour workday
  const hasConflicts = surgeon.conflicts.length > 0;

  return (
    <div className={`border rounded-lg p-4 ${hasConflicts ? 'border-red-500 bg-red-50' : 'bg-white'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <div className="font-semibold text-lg">{surgeon.surgeonName}</div>
            <div className="text-sm text-gray-600">
              {surgeon.totalSurgeries} {surgeon.totalSurgeries === 1 ? 'surgery' : 'surgeries'} •{' '}
              {Math.round(surgeon.totalDurationMinutes / 60)}h {surgeon.totalDurationMinutes % 60}m
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Utilization Badge */}
          <Badge
            className={
              utilizationPercentage > 80
                ? 'bg-red-100 text-red-700'
                : utilizationPercentage > 50
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-green-100 text-green-700'
            }
          >
            {utilizationPercentage}% Utilized
          </Badge>

          {/* Conflict Badge */}
          {hasConflicts && (
            <Badge variant="destructive">
              <AlertCircle className="h-3 w-3 mr-1" />
              {surgeon.conflicts.length} {surgeon.conflicts.length === 1 ? 'Conflict' : 'Conflicts'}
            </Badge>
          )}

          {/* Expand/Collapse Button */}
          <Button variant="ghost" size="sm" onClick={onToggleExpand}>
            {isExpanded ? 'Collapse' : 'Expand'}
          </Button>
        </div>
      </div>

      {/* Utilization Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
          <span>Workload</span>
          <span>{Math.round(surgeon.totalDurationMinutes / 60)}h / 8h</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              utilizationPercentage > 80 ? 'bg-red-500' : utilizationPercentage > 50 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(utilizationPercentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="space-y-4 mt-4 border-t pt-4">
          {/* Schedule Timeline */}
          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Surgery Schedule
            </h4>
            <div className="space-y-2">
              {surgeon.schedules
                .sort((a, b) => parseTimeSpan(a.startTime) - parseTimeSpan(b.startTime))
                .map((schedule) => (
                  <div key={schedule.id} className="bg-gray-50 rounded-lg p-3 border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">{schedule.surgeryType}</div>
                      <Badge className={getStatusBadgeClass(schedule.status)}>{schedule.status}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {schedule.startTime.slice(0, 5)} - {schedule.endTime.slice(0, 5)} ({schedule.durationMinutes} min)
                      </div>
                      <div>Theater: {schedule.theaterName}</div>
                      <div>Patient ID: {schedule.patientId?.slice(0, 8)}...</div>
                      <div>Eye: {schedule.eyeOperated || 'N/A'}</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Available Slots */}
          {surgeon.availableSlots.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Available Slots
              </h4>
              <div className="flex flex-wrap gap-2">
                {surgeon.availableSlots.map((slot, idx) => (
                  <div key={idx} className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm">
                    <Clock className="inline h-3 w-3 mr-1" />
                    {slot.start} - {slot.end}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conflicts */}
          {surgeon.conflicts.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2 text-red-600">
                <AlertCircle className="h-4 w-4" />
                Scheduling Conflicts
              </h4>
              {surgeon.conflicts.map(({ schedule1, schedule2 }, idx) => (
                <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2">
                  <div className="text-sm text-red-700 font-medium mb-2">
                    ⚠️ Overlapping surgeries detected
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-white rounded p-2">
                      <div className="font-medium">{schedule1.surgeryType}</div>
                      <div className="text-gray-600">
                        {schedule1.startTime.slice(0, 5)} - {schedule1.endTime.slice(0, 5)}
                      </div>
                      <div className="text-gray-600">{schedule1.theaterName}</div>
                    </div>
                    <div className="bg-white rounded p-2">
                      <div className="font-medium">{schedule2.surgeryType}</div>
                      <div className="text-gray-600">
                        {schedule2.startTime.slice(0, 5)} - {schedule2.endTime.slice(0, 5)}
                      </div>
                      <div className="text-gray-600">{schedule2.theaterName}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function getSurgeonName(schedule: OTScheduleDto): string {
  // In production, this would map surgeonId to user name via API
  // For now, extract from schedule metadata or use ID
  return `Dr. Surgeon ${schedule.surgeonId.slice(0, 8)}`;
}

function parseTimeSpan(timeStr: string): number {
  // Parse "HH:mm:ss" to minutes since midnight
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTimeSpan(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:00`;
}

function calculateAvailableSlots(busySlots: Array<{ start: string; end: string }>): Array<{ start: string; end: string }> {
  if (busySlots.length === 0) return [];

  // Sort busy slots by start time
  const sorted = [...busySlots].sort((a, b) => parseTimeSpan(a.start) - parseTimeSpan(b.start));
  const available: Array<{ start: string; end: string }> = [];

  // Find gaps between surgeries
  for (let i = 0; i < sorted.length - 1; i++) {
    const currentEnd = parseTimeSpan(sorted[i].end);
    const nextStart = parseTimeSpan(sorted[i + 1].start);

    // If there's a gap of at least 15 minutes
    if (nextStart - currentEnd >= 15) {
      available.push({
        start: formatTimeSpan(currentEnd).slice(0, 5),
        end: formatTimeSpan(nextStart).slice(0, 5),
      });
    }
  }

  return available;
}

function getStatusBadgeClass(status: string): string {
  const statusColors: Record<string, string> = {
    Tentative: 'bg-gray-100 text-gray-700',
    Booked: 'bg-blue-100 text-blue-700',
    Confirmed: 'bg-green-100 text-green-700',
    InProgress: 'bg-purple-100 text-purple-700',
    Completed: 'bg-green-200 text-green-800',
    Cancelled: 'bg-red-100 text-red-700',
    NoShow: 'bg-orange-100 text-orange-700',
  };
  return statusColors[status] || 'bg-gray-100 text-gray-700';
}
