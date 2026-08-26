'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Siren, User, Clock, AlertCircle, Send, Calendar as CalendarIcon } from 'lucide-react';
import { toast } from '@/lib/toast';
import { getApi } from '@/lib/api';

interface Surgeon {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  specialization?: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
  surgeonName?: string;
  procedureType?: string;
}

export default function SurgeryAvailabilityPage() {
  const [surgeons, setSurgeons] = useState<Surgeon[]>([]);
  const [selectedSurgeon, setSelectedSurgeon] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [isQuickNoteOpen, setIsQuickNoteOpen] = useState(false);
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [quickNoteData, setQuickNoteData] = useState({
    patientName: '',
    mobileNumber: '',
    procedureType: '',
    message: ''
  });
  const [requestData, setRequestData] = useState({
    patientName: '',
    mobileNumber: '',
    procedureType: '',
    urgency: 'routine',
    preferredDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const branchId = typeof window !== 'undefined' ? localStorage.getItem('currentBranchId') : '';

  useEffect(() => {
    fetchSurgeons();
  }, []);

  useEffect(() => {
    if (selectedSurgeon && branchId) {
      fetchOTAvailability();
    }
  }, [selectedSurgeon, selectedDate, branchId]);

  const fetchSurgeons = async () => {
    try {
      const api = getApi();
      const response = await api.get('/users/surgeons');
      setSurgeons(response.data || []);
    } catch (error) {
      console.error('Error fetching surgeons:', error);
      toast.error('Failed to load surgeons');
    }
  };

  const fetchOTAvailability = async () => {
    if (!branchId || !selectedSurgeon) return;

    try {
      setLoading(true);
      const api = getApi();
      const dateStr = selectedDate.toISOString().split('T')[0];
      const response = await api.get(
        `/ot/availability?branchId=${branchId}&surgeonId=${selectedSurgeon}&date=${dateStr}`
      );
      setTimeSlots(response.data || []);
    } catch (error) {
      console.error('Error fetching availability:', error);
      toast.error('Failed to load availability');
      setTimeSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) {
      toast.error('No branch selected');
      return;
    }

    try {
      const api = getApi();
      await api.post('/surgery/quick-note', {
        branchId,
        ...quickNoteData
      });
      
      toast.success('Quick note sent to counselor successfully');
      setIsQuickNoteOpen(false);
      setQuickNoteData({
        patientName: '',
        mobileNumber: '',
        procedureType: '',
        message: ''
      });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send quick note');
    }
  };

  const handleDirectRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) {
      toast.error('No branch selected');
      return;
    }

    try {
      const api = getApi();
      await api.post('/surgery/direct-request', {
        branchId,
        surgeonId: selectedSurgeon,
        ...requestData
      });
      
      toast.success('Surgery request sent to surgeon successfully');
      setIsRequestOpen(false);
      setRequestData({
        patientName: '',
        mobileNumber: '',
        procedureType: '',
        urgency: 'routine',
        preferredDate: new Date().toISOString().split('T')[0],
        notes: ''
      });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send request');
    }
  };

  const availableSlots = timeSlots.filter(slot => slot.available).length;
  const totalSlots = timeSlots.length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Surgery & OT Availability</h1>
          <p className="text-gray-600 mt-1">Check OT availability and send surgery requests</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isQuickNoteOpen} onOpenChange={setIsQuickNoteOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Send className="h-4 w-4" />
                Quick Note to Counselor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Quick Note to Counselor</DialogTitle>
                <DialogDescription>Forward patient details to surgery counselor</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleQuickNote} className="space-y-4">
                <div>
                  <Label>Patient Name *</Label>
                  <Input
                    required
                    value={quickNoteData.patientName}
                    onChange={(e) => setQuickNoteData({ ...quickNoteData, patientName: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Mobile Number *</Label>
                  <Input
                    required
                    type="tel"
                    value={quickNoteData.mobileNumber}
                    onChange={(e) => setQuickNoteData({ ...quickNoteData, mobileNumber: e.target.value })}
                    maxLength={10}
                  />
                </div>
                <div>
                  <Label>Procedure Type *</Label>
                  <Input
                    required
                    value={quickNoteData.procedureType}
                    onChange={(e) => setQuickNoteData({ ...quickNoteData, procedureType: e.target.value })}
                    placeholder="Cataract Surgery"
                  />
                </div>
                <div>
                  <Label>Message</Label>
                  <Textarea
                    value={quickNoteData.message}
                    onChange={(e) => setQuickNoteData({ ...quickNoteData, message: e.target.value })}
                    placeholder="Additional notes..."
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsQuickNoteOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Send to Counselor</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isRequestOpen} onOpenChange={setIsRequestOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Siren className="h-4 w-4" />
                Direct Surgeon Request
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Send Request to Surgeon</DialogTitle>
                <DialogDescription>Submit surgery request directly to surgeon</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleDirectRequest} className="space-y-4">
                <div>
                  <Label>Patient Name *</Label>
                  <Input
                    required
                    value={requestData.patientName}
                    onChange={(e) => setRequestData({ ...requestData, patientName: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Mobile Number *</Label>
                  <Input
                    required
                    type="tel"
                    value={requestData.mobileNumber}
                    onChange={(e) => setRequestData({ ...requestData, mobileNumber: e.target.value })}
                    maxLength={10}
                  />
                </div>
                <div>
                  <Label>Procedure Type *</Label>
                  <Input
                    required
                    value={requestData.procedureType}
                    onChange={(e) => setRequestData({ ...requestData, procedureType: e.target.value })}
                    placeholder="Cataract Surgery"
                  />
                </div>
                <div>
                  <Label>Urgency *</Label>
                  <Select
                    value={requestData.urgency}
                    onValueChange={(value) => setRequestData({ ...requestData, urgency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="emergency">Emergency</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="routine">Routine</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Preferred Date *</Label>
                  <Input
                    required
                    type="date"
                    value={requestData.preferredDate}
                    onChange={(e) => setRequestData({ ...requestData, preferredDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={requestData.notes}
                    onChange={(e) => setRequestData({ ...requestData, notes: e.target.value })}
                    placeholder="Additional information..."
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsRequestOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Send Request</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Surgeon and Date Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Check OT Availability</CardTitle>
          <CardDescription>Select surgeon and date to view available time slots</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Select Surgeon</Label>
              <Select value={selectedSurgeon} onValueChange={setSelectedSurgeon}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a surgeon" />
                </SelectTrigger>
                <SelectContent>
                  {surgeons.map((surgeon) => (
                    <SelectItem key={surgeon.id} value={surgeon.id}>
                      Dr. {surgeon.firstName} {surgeon.lastName}
                      {surgeon.specialization && ` - ${surgeon.specialization}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Select Date</Label>
              <div className="border rounded-md p-2">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  disabled={(date) => date < new Date()}
                  className="rounded-md"
                />
              </div>
            </div>
          </div>

          {selectedSurgeon && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  Available Slots - {selectedDate.toLocaleDateString()}
                </h3>
                <Badge variant="outline">
                  {availableSlots} / {totalSlots} available
                </Badge>
              </div>

              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading slots...</div>
              ) : timeSlots.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No slots available</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {timeSlots.map((slot, index) => (
                    <Card
                      key={index}
                      className={`cursor-pointer transition-all ${
                        slot.available
                          ? 'bg-green-50 border-green-300 hover:bg-green-100'
                          : 'bg-gray-100 border-gray-300 opacity-60'
                      }`}
                    >
                      <CardContent className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <Clock className="h-4 w-4" />
                          <span className="font-semibold">{slot.time}</span>
                        </div>
                        <Badge
                          variant={slot.available ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {slot.available ? 'Available' : 'Booked'}
                        </Badge>
                        {!slot.available && slot.procedureType && (
                          <p className="text-xs text-gray-600 mt-2">{slot.procedureType}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-gray-700">
              <p className="font-semibold mb-1">How to book OT slots:</p>
              <ul className="list-disc list-inside space-y-1 text-gray-600">
                <li>Check availability by selecting surgeon and date</li>
                <li>Use "Quick Note" for counselor to handle booking</li>
                <li>Use "Direct Request" for urgent cases requiring surgeon approval</li>
                <li>OT slots are 8:00 AM - 6:00 PM (subject to surgeon availability)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
