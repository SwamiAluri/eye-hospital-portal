'use client'

import { useState } from 'react'
import { useLeaveTypes } from '@/hooks/use-hr-masters'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Download, Calendar, Clock, CheckCircle, XCircle } from 'lucide-react'

export default function LeavePage() {
  const { types: leaveTypes } = useLeaveTypes()
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('all')

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb items={[
          { label: 'Admin', href: '/dashboard/admin' },
          { label: 'Leave Management' }
        ]} />

        {/* Page Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-heading font-bold text-primary-800">Leave Management</h1>
            <p className="text-gray-600 mt-2">Manage employee leave requests and balances</p>
          </div>
          <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
            New Leave Request
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card hover>
            <CardHeader>
              <CardTitle className="text-sm">Pending Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-heading font-bold text-status-warning">12</p>
                  <p className="text-xs text-gray-500 mt-1">Awaiting approval</p>
                </div>
                <Clock className="h-10 w-10 text-status-warning opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card hover>
            <CardHeader>
              <CardTitle className="text-sm">Approved This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-heading font-bold text-status-success">28</p>
                  <p className="text-xs text-gray-500 mt-1">Leave days approved</p>
                </div>
                <CheckCircle className="h-10 w-10 text-status-success opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card hover>
            <CardHeader>
              <CardTitle className="text-sm">Rejected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-heading font-bold text-status-critical">3</p>
                  <p className="text-xs text-gray-500 mt-1">This month</p>
                </div>
                <XCircle className="h-10 w-10 text-status-critical opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card hover>
            <CardHeader>
              <CardTitle className="text-sm">On Leave Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-heading font-bold text-status-info">18</p>
                  <p className="text-xs text-gray-500 mt-1">Employees</p>
                </div>
                <Calendar className="h-10 w-10 text-status-info opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <Input
                placeholder="Search employees..."
                className="md:w-64"
              />
              <Select value={leaveTypeFilter} onValueChange={setLeaveTypeFilter}>
                <SelectTrigger className="md:w-48">
                  <SelectValue placeholder="Leave type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {leaveTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select>
                <SelectTrigger className="md:w-48">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" leftIcon={<Download className="h-4 w-4" />} className="ml-auto">
                Export
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Leave Requests Table */}
        <Card>
          <CardHeader>
            <CardTitle>Leave Requests</CardTitle>
            <CardDescription>Recent leave applications and their status</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader sticky>
                <TableRow>
                  <TableHead sortable>Employee</TableHead>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>From Date</TableHead>
                  <TableHead>To Date</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { name: 'Dr. Rajesh Kumar', type: 'Annual Leave', from: '2026-02-10', to: '2026-02-14', days: 5, reason: 'Family vacation', status: 'Pending' },
                  { name: 'Ms. Priya Sharma', type: 'Sick Leave', from: '2026-01-26', to: '2026-01-27', days: 2, reason: 'Medical appointment', status: 'Approved' },
                  { name: 'Mr. Amit Patel', type: 'Casual Leave', from: '2026-02-01', to: '2026-02-01', days: 1, reason: 'Personal work', status: 'Pending' },
                  { name: 'Mrs. Sunita Reddy', type: 'Annual Leave', from: '2026-01-20', to: '2026-01-24', days: 5, reason: 'Wedding ceremony', status: 'Approved' },
                  { name: 'Mr. Vikram Singh', type: 'Sick Leave', from: '2026-01-28', to: '2026-01-29', days: 2, reason: 'Flu symptoms', status: 'Pending' },
                  { name: 'Dr. Anjali Desai', type: 'Casual Leave', from: '2026-01-15', to: '2026-01-15', days: 1, reason: 'Bank visit', status: 'Rejected' },
                  { name: 'Mr. Karan Mehta', type: 'Annual Leave', from: '2026-03-05', to: '2026-03-09', days: 5, reason: 'Holiday trip', status: 'Pending' },
                ].map((leave, index) => (
                  <TableRow key={index} zebra>
                    <TableCell className="font-medium">{leave.name}</TableCell>
                    <TableCell>{leave.type}</TableCell>
                    <TableCell className="font-mono text-sm">{leave.from}</TableCell>
                    <TableCell className="font-mono text-sm">{leave.to}</TableCell>
                    <TableCell className="font-semibold">{leave.days}</TableCell>
                    <TableCell className="max-w-xs truncate">{leave.reason}</TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        leave.status === 'Approved' 
                          ? 'bg-green-100 text-green-800' 
                          : leave.status === 'Pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {leave.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {leave.status === 'Pending' ? (
                        <div className="flex gap-2">
                          <Button variant="success" size="sm">Approve</Button>
                          <Button variant="danger" size="sm">Reject</Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="sm">View</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
