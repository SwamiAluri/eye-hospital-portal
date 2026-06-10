'use client'

import { useState } from 'react'
import { useShiftTypes } from '@/hooks/use-hr-masters'
import { useDepartmentMaster } from '@/hooks/use-system-masters'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Download, Upload, Calendar, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

export default function AttendancePage() {
  const { types: shiftTypes } = useShiftTypes()
  const { departments } = useDepartmentMaster()
  const [shiftFilter, setShiftFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb items={[
          { label: 'Admin', href: '/dashboard/admin' },
          { label: 'Attendance' }
        ]} />

        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-heading font-bold text-primary-800">Attendance Management</h1>
          <p className="text-gray-600 mt-2">Track employee attendance, leaves, and working hours</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card hover>
            <CardHeader>
              <CardTitle className="text-sm">Present Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-heading font-bold text-status-success">142</p>
                  <p className="text-xs text-gray-500 mt-1">Out of 165 employees</p>
                </div>
                <CheckCircle className="h-10 w-10 text-status-success opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card hover>
            <CardHeader>
              <CardTitle className="text-sm">On Leave</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-heading font-bold text-status-warning">18</p>
                  <p className="text-xs text-gray-500 mt-1">Approved leaves</p>
                </div>
                <Calendar className="h-10 w-10 text-status-warning opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card hover>
            <CardHeader>
              <CardTitle className="text-sm">Absent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-heading font-bold text-status-critical">5</p>
                  <p className="text-xs text-gray-500 mt-1">Unexcused absences</p>
                </div>
                <XCircle className="h-10 w-10 text-status-critical opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card hover>
            <CardHeader>
              <CardTitle className="text-sm">Late Arrivals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-heading font-bold text-status-info">12</p>
                  <p className="text-xs text-gray-500 mt-1">This week</p>
                </div>
                <Clock className="h-10 w-10 text-status-info opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Actions */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <Input
                placeholder="Search employees..."
                className="md:w-64"
              />
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="md:w-48">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={shiftFilter} onValueChange={setShiftFilter}>
                <SelectTrigger className="md:w-48">
                  <SelectValue placeholder="Shift type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Shifts</SelectItem>
                  {shiftTypes.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select>
                <SelectTrigger className="md:w-48">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="leave">On Leave</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" leftIcon={<Download className="h-4 w-4" />}>
                  Export
                </Button>
                <Button variant="primary" leftIcon={<Upload className="h-4 w-4" />}>
                  Import Attendance
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Table */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Attendance</CardTitle>
            <CardDescription>Real-time attendance tracking for January 25, 2026</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader sticky>
                <TableRow>
                  <TableHead sortable>Employee ID</TableHead>
                  <TableHead sortable>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Working Hours</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { id: 'EMP001', name: 'Dr. Rajesh Kumar', dept: 'Ophthalmology', checkIn: '08:45 AM', checkOut: '05:30 PM', hours: '8h 45m', status: 'Present' },
                  { id: 'EMP002', name: 'Ms. Priya Sharma', dept: 'Optometry', checkIn: '09:00 AM', checkOut: '06:00 PM', hours: '9h 00m', status: 'Present' },
                  { id: 'EMP003', name: 'Mr. Amit Patel', dept: 'Administration', checkIn: '09:15 AM', checkOut: '-', hours: '6h 30m', status: 'Late' },
                  { id: 'EMP004', name: 'Mrs. Sunita Reddy', dept: 'Nursing', checkIn: '-', checkOut: '-', hours: '-', status: 'On Leave' },
                  { id: 'EMP005', name: 'Mr. Vikram Singh', dept: 'Ophthalmology', checkIn: '-', checkOut: '-', hours: '-', status: 'Absent' },
                  { id: 'EMP006', name: 'Dr. Anjali Desai', dept: 'Optometry', checkIn: '08:30 AM', checkOut: '05:00 PM', hours: '8h 30m', status: 'Present' },
                  { id: 'EMP007', name: 'Mr. Karan Mehta', dept: 'Administration', checkIn: '08:55 AM', checkOut: '05:45 PM', hours: '8h 50m', status: 'Present' },
                ].map((attendance, index) => (
                  <TableRow key={index} zebra>
                    <TableCell className="font-mono text-sm">{attendance.id}</TableCell>
                    <TableCell className="font-medium">{attendance.name}</TableCell>
                    <TableCell>{attendance.dept}</TableCell>
                    <TableCell className="font-mono text-sm">{attendance.checkIn}</TableCell>
                    <TableCell className="font-mono text-sm">{attendance.checkOut}</TableCell>
                    <TableCell className="font-mono text-sm">{attendance.hours}</TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        attendance.status === 'Present' 
                          ? 'bg-green-100 text-green-800' 
                          : attendance.status === 'Late'
                          ? 'bg-blue-100 text-blue-800'
                          : attendance.status === 'On Leave'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {attendance.status}
                      </span>
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
