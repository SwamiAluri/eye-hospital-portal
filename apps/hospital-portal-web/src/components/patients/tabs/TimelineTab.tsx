'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, Activity, FileText, Pill, Stethoscope, TestTube, Image, DollarSign, Shield, MessageSquare, Users, Phone, Star, Search, Filter, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { appointmentsApi, visitsApi, examinationApi, prescriptionsApi, opdBillsApi } from '@/lib/api';
import { patientConsentsApi } from '@/lib/api/patient-consents.api';
import { patientCommunicationsApi } from '@/lib/api/patient-communications.api';
import { labReportsApi } from '@/lib/api/lab-reports.api';
import { surgeryRequestsApi } from '@/lib/api/surgery-requests.api';
import { format, parseISO } from 'date-fns';
import { toast } from '@/lib/toast';

interface TimelineEvent {
  id: string;
  type: 'appointment' | 'visit' | 'examination' | 'diagnosis' | 'prescription' | 'surgery' | 'procedure' | 'lab' | 'imaging' | 'vitals' | 'admission' | 'billing' | 'insurance' | 'consent' | 'document' | 'message' | 'call' | 'referral' | 'feedback' | 'portal';
  title: string;
  description: string;
  timestamp: Date;
  category: 'clinical' | 'diagnostic' | 'administrative' | 'communication' | 'engagement';
  status?: string;
  metadata?: Record<string, any>;
}

interface TimelineTabProps {
  patientId: string;
}

const EVENT_TYPE_CONFIG = {
  appointment: { icon: Calendar, label: 'Appointment', color: 'blue', category: 'clinical' as const },
  visit: { icon: Activity, label: 'Visit', color: 'blue', category: 'clinical' as const },
  examination: { icon: Stethoscope, label: 'Examination', color: 'blue', category: 'clinical' as const },
  diagnosis: { icon: FileText, label: 'Diagnosis', color: 'blue', category: 'clinical' as const },
  prescription: { icon: Pill, label: 'Prescription', color: 'blue', category: 'clinical' as const },
  surgery: { icon: Activity, label: 'Surgery', color: 'purple', category: 'clinical' as const },
  procedure: { icon: Stethoscope, label: 'Procedure', color: 'purple', category: 'clinical' as const },
  lab: { icon: TestTube, label: 'Lab Test', color: 'green', category: 'diagnostic' as const },
  imaging: { icon: Image, label: 'Imaging', color: 'green', category: 'diagnostic' as const },
  vitals: { icon: Activity, label: 'Vitals', color: 'green', category: 'diagnostic' as const },
  admission: { icon: Users, label: 'Admission', color: 'orange', category: 'clinical' as const },
  billing: { icon: DollarSign, label: 'Billing', color: 'emerald', category: 'administrative' as const },
  insurance: { icon: Shield, label: 'Insurance', color: 'gray', category: 'administrative' as const },
  consent: { icon: FileText, label: 'Consent', color: 'gray', category: 'administrative' as const },
  document: { icon: FileText, label: 'Document', color: 'gray', category: 'administrative' as const },
  message: { icon: MessageSquare, label: 'Message', color: 'indigo', category: 'communication' as const },
  call: { icon: Phone, label: 'Call', color: 'indigo', category: 'communication' as const },
  referral: { icon: Users, label: 'Referral', color: 'indigo', category: 'communication' as const },
  feedback: { icon: Star, label: 'Feedback', color: 'yellow', category: 'engagement' as const },
  portal: { icon: Activity, label: 'Portal Activity', color: 'yellow', category: 'engagement' as const },
};

const CATEGORY_COLORS = {
  clinical: 'bg-blue-100 text-blue-800 border-blue-200',
  diagnostic: 'bg-green-100 text-green-800 border-green-200',
  administrative: 'bg-gray-100 text-gray-800 border-gray-200',
  communication: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  engagement: 'bg-yellow-100 text-yellow-800 border-yellow-200',
};

export const TimelineTab: React.FC<TimelineTabProps> = ({ patientId }) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  
  // Filter states
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['clinical', 'diagnostic', 'administrative', 'communication', 'engagement']);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(Object.keys(EVENT_TYPE_CONFIG));
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch all timeline data from multiple endpoints
  useEffect(() => {
    const fetchTimelineData = async () => {
      if (!patientId) return;
      
      setLoading(true);
      try {
        // Parallel fetch from all available endpoints
        const [
          appointmentsRes,
          visitsRes,
          examinationsRes,
          prescriptionsRes,
          billsRes,
          consentsRes,
          communicationsRes,
          labReportsRes,
          surgeriesRes,
        ] = await Promise.allSettled([
          appointmentsApi.getByPatient(patientId),
          visitsApi.getByPatient(patientId),
          examinationApi.getByPatient(patientId),
          prescriptionsApi.getByPatient(patientId),
          opdBillsApi.getByPatient(patientId),
          patientConsentsApi.getByPatient(patientId),
          patientCommunicationsApi.getByPatient(patientId),
          labReportsApi.getByPatient(patientId),
          surgeryRequestsApi.getByPatient(patientId),
        ]);

        const timelineEvents: TimelineEvent[] = [];

        // Process appointments
        if (appointmentsRes.status === 'fulfilled' && appointmentsRes.value.data) {
          appointmentsRes.value.data.forEach((apt: any) => {
            timelineEvents.push({
              id: `apt-${apt.id}`,
              type: 'appointment',
              title: `Appointment - ${apt.appointmentType || 'General'}`,
              description: `Doctor: ${apt.doctorName || 'Unknown'} | Status: ${apt.status || 'Scheduled'}`,
              timestamp: new Date(apt.appointmentDateTime || apt.createdAt),
              category: 'clinical',
              status: apt.status,
              metadata: apt,
            });
          });
        }

        // Process visits
        if (visitsRes.status === 'fulfilled' && visitsRes.value.data) {
          visitsRes.value.data.forEach((visit: any) => {
            timelineEvents.push({
              id: `visit-${visit.id}`,
              type: 'visit',
              title: `OPD Visit - Token: ${visit.tokenNumber || 'N/A'}`,
              description: `Department: ${visit.departmentName || 'General'} | Status: ${visit.status || 'Completed'}`,
              timestamp: new Date(visit.checkInTime || visit.createdAt),
              category: 'clinical',
              status: visit.status,
              metadata: visit,
            });
          });
        }

        // Process examinations
        if (examinationsRes.status === 'fulfilled' && examinationsRes.value.data) {
          examinationsRes.value.data.forEach((exam: any) => {
            timelineEvents.push({
              id: `exam-${exam.id}`,
              type: 'examination',
              title: `${exam.examinationType || 'Clinical'} Examination`,
              description: `Doctor: ${exam.doctorName || 'Unknown'} | ${exam.diagnosis ? `Diagnosis: ${exam.diagnosis}` : 'No diagnosis'}`,
              timestamp: new Date(exam.examinationDate || exam.createdAt),
              category: 'clinical',
              status: exam.status,
              metadata: exam,
            });
          });
        }

        // Process prescriptions
        if (prescriptionsRes.status === 'fulfilled' && prescriptionsRes.value.data) {
          prescriptionsRes.value.data.forEach((rx: any) => {
            timelineEvents.push({
              id: `rx-${rx.id}`,
              type: 'prescription',
              title: `Prescription - ${rx.medications?.length || 0} medication(s)`,
              description: `Prescribed by: ${rx.prescribedByName || 'Unknown'} | Status: ${rx.status || 'Active'}`,
              timestamp: new Date(rx.prescribedDate || rx.createdAt),
              category: 'clinical',
              status: rx.status,
              metadata: rx,
            });
          });
        }

        // Process billing
        if (billsRes.status === 'fulfilled' && billsRes.value.data) {
          billsRes.value.data.forEach((bill: any) => {
            timelineEvents.push({
              id: `bill-${bill.id}`,
              type: 'billing',
              title: `Bill #${bill.billNumber || bill.id.substring(0, 8)}`,
              description: `Amount: ₹${bill.totalAmount || 0} | Status: ${bill.paymentStatus || 'Pending'}`,
              timestamp: new Date(bill.billDate || bill.createdAt),
              category: 'administrative',
              status: bill.paymentStatus,
              metadata: bill,
            });
          });
        }

        // Process consents
        if (consentsRes.status === 'fulfilled' && consentsRes.value.data) {
          consentsRes.value.data.forEach((consent: any) => {
            timelineEvents.push({
              id: `consent-${consent.id}`,
              type: 'consent',
              title: `${consent.consentType || 'Medical'} Consent`,
              description: `Status: ${consent.status || 'Pending'} | ${consent.revokedAt ? 'Revoked' : 'Active'}`,
              timestamp: new Date(consent.consentDate || consent.createdAt),
              category: 'administrative',
              status: consent.status,
              metadata: consent,
            });
          });
        }

        // Process communications
        if (communicationsRes.status === 'fulfilled' && communicationsRes.value.data) {
          communicationsRes.value.data.forEach((comm: any) => {
            timelineEvents.push({
              id: `comm-${comm.id}`,
              type: 'message',
              title: `${comm.communicationType || 'Message'} - ${comm.direction || 'Outbound'}`,
              description: comm.subject || comm.message?.substring(0, 100) || 'No content',
              timestamp: new Date(comm.sentAt || comm.createdAt),
              category: 'communication',
              status: comm.status,
              metadata: comm,
            });
          });
        }

        // Process lab reports
        if (labReportsRes.status === 'fulfilled' && labReportsRes.value.data) {
          labReportsRes.value.data.forEach((lab: any) => {
            timelineEvents.push({
              id: `lab-${lab.id}`,
              type: 'lab',
              title: `${lab.testName || 'Lab Test'} - ${lab.testCategory || 'General'}`,
              description: `Ordered by: ${lab.orderedBy || 'Unknown'} | Status: ${lab.status || 'Pending'}`,
              timestamp: new Date(lab.orderedDate || lab.createdAt),
              category: 'diagnostic',
              status: lab.status,
              metadata: lab,
            });
          });
        }

        // Process surgeries
        if (surgeriesRes.status === 'fulfilled' && surgeriesRes.value.data) {
          surgeriesRes.value.data.forEach((surgery: any) => {
            timelineEvents.push({
              id: `surgery-${surgery.id}`,
              type: 'surgery',
              title: `${surgery.surgeryType || 'Surgical'} Procedure`,
              description: `Surgeon: ${surgery.surgeonName || 'Unknown'} | Status: ${surgery.status || 'Scheduled'}`,
              timestamp: new Date(surgery.scheduledDate || surgery.createdAt),
              category: 'clinical',
              status: surgery.status,
              metadata: surgery,
            });
          });
        }

        // Sort events by timestamp (newest first)
        timelineEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        
        setEvents(timelineEvents);
        setFilteredEvents(timelineEvents);
      } catch (error) {
        console.error('Error fetching timeline data:', error);
        toast.error('Failed to load timeline data');
      } finally {
        setLoading(false);
      }
    };

    fetchTimelineData();
  }, [patientId]);

  const availableYears = useMemo(() => {
    const years = new Set(events.map((e) => e.timestamp.getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [events]);

  // Apply filters
  useEffect(() => {
    let filtered = [...events];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(query) ||
        event.description.toLowerCase().includes(query)
      );
    }

    // Filter by selected categories
    filtered = filtered.filter(event => selectedCategories.includes(event.category));

    // Filter by selected types
    filtered = filtered.filter(event => selectedTypes.includes(event.type));

    // Filter by year
    if (selectedYear !== 'all') {
      const year = Number(selectedYear);
      filtered = filtered.filter((event) => event.timestamp.getFullYear() === year);
    }

    // Filter by date range
    if (dateRange.start) {
      const startDate = new Date(dateRange.start);
      filtered = filtered.filter(event => event.timestamp >= startDate);
    }
    if (dateRange.end) {
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(event => event.timestamp <= endDate);
    }

    setFilteredEvents(filtered);
  }, [events, searchQuery, selectedCategories, selectedTypes, selectedYear, dateRange]);

  const toggleEventExpansion = (eventId: string) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedEvents(newExpanded);
  };

  const toggleCategory = (category: string) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter(c => c !== category));
    } else {
      setSelectedCategories([...selectedCategories, category]);
    }
  };

  const exportTimeline = () => {
    const csvContent = [
      ['Date', 'Type', 'Title', 'Description', 'Category', 'Status'].join(','),
      ...filteredEvents.map(event => [
        format(event.timestamp, 'yyyy-MM-dd HH:mm:ss'),
        event.type,
        `"${event.title}"`,
        `"${event.description}"`,
        event.category,
        event.status || 'N/A'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patient-timeline-${patientId}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Timeline exported successfully');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading timeline...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with search and filters */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search timeline events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm shrink-0"
          aria-label="Filter by year"
        >
          <option value="all">All years</option>
          {availableYears.map((year) => (
            <option key={year} value={String(year)}>
              {year}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="w-4 h-4 mr-2" />
          Filters
          {showFilters ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={exportTimeline}
        >
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Category filters */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Categories</h4>
              <div className="flex flex-wrap gap-2">
                {(['clinical', 'diagnostic', 'administrative', 'communication', 'engagement'] as const).map(category => (
                  <label key={category} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedCategories.includes(category)}
                      onCheckedChange={() => toggleCategory(category)}
                    />
                    <span className="text-sm capitalize">{category}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Date range filters */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Start Date</label>
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">End Date</label>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                />
              </div>
            </div>

            {/* Clear filters button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategories(['clinical', 'diagnostic', 'administrative', 'communication', 'engagement']);
                setSelectedTypes(Object.keys(EVENT_TYPE_CONFIG));
                setDateRange({ start: '', end: '' });
                setSelectedYear('all');
              }}
            >
              Clear All Filters
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Timeline events */}
      <div className="space-y-4">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No timeline events found</p>
            <p className="text-sm text-gray-500 mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

            {/* Events */}
            <div className="space-y-6">
              {filteredEvents.map((event, index) => {
                const config = EVENT_TYPE_CONFIG[event.type];
                const Icon = config.icon;
                const isExpanded = expandedEvents.has(event.id);

                return (
                  <div key={event.id} className="relative pl-14">
                    {/* Timeline dot */}
                    <div className={`absolute left-4 -translate-x-1/2 w-4 h-4 rounded-full bg-${config.color}-500 border-2 border-white shadow`} />

                    {/* Event card */}
                    <Card className={`${CATEGORY_COLORS[event.category]} border-l-4`}>
                      <CardContent className="p-4">
                        <div
                          className="cursor-pointer"
                          onClick={() => toggleEventExpansion(event.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <Icon className={`w-5 h-5 text-${config.color}-600 mt-0.5`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold text-gray-900">{event.title}</h4>
                                  {event.status && (
                                    <Badge variant="secondary" className="text-xs">
                                      {event.status}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-700 mb-2">{event.description}</p>
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {format(event.timestamp, 'MMM dd, yyyy HH:mm')}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {config.label}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                          </div>

                          {/* Expanded details */}
                          {isExpanded && event.metadata && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto">
                                {JSON.stringify(event.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Summary footer */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">
          Showing <span className="font-semibold">{filteredEvents.length}</span> of <span className="font-semibold">{events.length}</span> events
        </p>
      </div>
    </div>
  );
};
