'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserPlus, UserCheck, Clock, Search, Download, QrCode } from 'lucide-react';
import { toast } from '@/lib/toast';
import { getApi } from '@/lib/api';

interface Visitor {
  id: string;
  visitorName: string;
  mobileNumber: string;
  patientName: string;
  patientRoomNumber?: string;
  purpose: string;
  passNumber: string;
  checkInTime: string;
  checkOutTime?: string;
  status: string;
  duration?: number;
}

export default function VisitorManagementPage() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    visitorName: '',
    mobileNumber: '',
    patientName: '',
    patientRoomNumber: '',
    purpose: 'Patient Visit'
  });

  const branchId = typeof window !== 'undefined' ? localStorage.getItem('currentBranchId') : '';

  useEffect(() => {
    if (branchId) {
      fetchActiveVisitors();
    }
  }, [branchId]);

  const fetchActiveVisitors = async () => {
    if (!branchId) return;
    
    try {
      setLoading(true);
      const api = getApi();
      const response = await api.get(`/visitors/active?branchId=${branchId}`);
      setVisitors(response.data || []);
    } catch (error) {
      console.error('Error fetching visitors:', error);
      toast.error('Failed to load visitors');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) {
      toast.error('No branch selected');
      return;
    }

    try {
      const api = getApi();
      const response = await api.post('/visitors/check-in', {
        branchId,
        ...formData
      });
      
      toast.success(`Visitor checked in - Pass: ${response.data.passNumber}`);
      setIsCheckInOpen(false);
      setFormData({
        visitorName: '',
        mobileNumber: '',
        patientName: '',
        patientRoomNumber: '',
        purpose: 'Patient Visit'
      });
      fetchActiveVisitors();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to check in visitor');
    }
  };

  const handleCheckOut = async (visitorId: string) => {
    try {
      const api = getApi();
      await api.post(`/visitors/${visitorId}/check-out`);
      toast.success('Visitor checked out successfully');
      fetchActiveVisitors();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to check out visitor');
    }
  };

  const filteredVisitors = visitors.filter(v =>
    v.visitorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.passNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.patientName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = visitors.filter(v => v.status === 'active').length;
  const totalToday = visitors.length;
  const avgDuration = visitors.length > 0
    ? Math.round(visitors.reduce((sum, v) => sum + (v.duration || 0), 0) / visitors.length)
    : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Visitor Management</h1>
          <p className="text-gray-600 mt-1">Track and manage hospital visitors</p>
        </div>
        <Dialog open={isCheckInOpen} onOpenChange={setIsCheckInOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Check In Visitor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Visitor Check-In</DialogTitle>
              <DialogDescription>Register a new visitor to the hospital</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCheckIn} className="space-y-4">
              <div>
                <Label>Visitor Name *</Label>
                <Input
                  required
                  value={formData.visitorName}
                  onChange={(e) => setFormData({ ...formData, visitorName: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <Label>Mobile Number *</Label>
                <Input
                  required
                  type="tel"
                  value={formData.mobileNumber}
                  onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                  placeholder="9876543210"
                  maxLength={10}
                />
              </div>
              <div>
                <Label>Patient Name *</Label>
                <Input
                  required
                  value={formData.patientName}
                  onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <Label>Room Number (Optional)</Label>
                <Input
                  value={formData.patientRoomNumber}
                  onChange={(e) => setFormData({ ...formData, patientRoomNumber: e.target.value })}
                  placeholder="ICU-101"
                />
              </div>
              <div>
                <Label>Purpose</Label>
                <Input
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  placeholder="Patient Visit"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsCheckInOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Check In</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Visitors</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeCount}</div>
            <p className="text-xs text-gray-600 mt-1">Currently in hospital</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Today</CardTitle>
            <UserPlus className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalToday}</div>
            <p className="text-xs text-gray-600 mt-1">Check-ins today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgDuration} min</div>
            <p className="text-xs text-gray-600 mt-1">Average visit time</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Active Visitors</CardTitle>
            <div className="flex gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search visitors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading visitors...</div>
          ) : filteredVisitors.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No visitors found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pass Number</TableHead>
                  <TableHead>Visitor Name</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Patient Name</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Check-In Time</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVisitors.map((visitor) => (
                  <TableRow key={visitor.id}>
                    <TableCell className="font-mono font-semibold">{visitor.passNumber}</TableCell>
                    <TableCell>{visitor.visitorName}</TableCell>
                    <TableCell>{visitor.mobileNumber}</TableCell>
                    <TableCell>{visitor.patientName}</TableCell>
                    <TableCell>{visitor.patientRoomNumber || '-'}</TableCell>
                    <TableCell>{new Date(visitor.checkInTime).toLocaleTimeString()}</TableCell>
                    <TableCell>{visitor.duration ? `${visitor.duration} min` : '-'}</TableCell>
                    <TableCell>
                      <Badge variant={visitor.status === 'active' ? 'default' : 'secondary'}>
                        {visitor.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {visitor.status === 'active' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCheckOut(visitor.id)}
                        >
                          Check Out
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
