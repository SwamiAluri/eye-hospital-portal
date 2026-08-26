'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BarChart, TrendingUp, Users, Clock, Download, Calendar } from 'lucide-react';
import { toast } from '@/lib/toast';
import { getApi } from '@/lib/api';

interface DepartmentStat {
  department: string;
  count: number;
  percentage: number;
}

interface HourlyData {
  hour: number;
  count: number;
}

interface DailyReport {
  date: string;
  totalRegistrations: number;
  totalCheckedIn: number;
  totalCompleted: number;
  totalAbsent: number;
  averageWaitTime: number;
  checkInRate: number;
  departmentDistribution: DepartmentStat[];
  peakHours: HourlyData[];
}

interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  totalRegistrations: number;
  averageDaily: number;
  departmentDistribution: DepartmentStat[];
  dailyBreakdown: Array<{
    date: string;
    dayName: string;
    count: number;
  }>;
}

interface MonthlyReport {
  month: string;
  year: number;
  totalRegistrations: number;
  averageDaily: number;
  departmentDistribution: DepartmentStat[];
  weeklyBreakdown: Array<{
    weekNumber: number;
    weekStart: string;
    weekEnd: string;
    count: number;
  }>;
}

export default function OPDReportsPage() {
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(false);

  const branchId = typeof window !== 'undefined' ? localStorage.getItem('currentBranchId') : '';

  useEffect(() => {
    if (branchId) {
      fetchReport();
    }
  }, [reportType, selectedDate, branchId]);

  const fetchReport = async () => {
    if (!branchId) return;

    try {
      setLoading(true);
      const api = getApi();
      let endpoint = '';

      switch (reportType) {
        case 'daily':
          endpoint = `/reports/opd/daily?branchId=${branchId}&date=${selectedDate}`;
          break;
        case 'weekly':
          endpoint = `/reports/opd/weekly?branchId=${branchId}&date=${selectedDate}`;
          break;
        case 'monthly':
          endpoint = `/reports/opd/monthly?branchId=${branchId}&date=${selectedDate}`;
          break;
      }

      const response = await api.get(endpoint);
      
      if (reportType === 'daily') {
        setDailyReport(response.data);
      } else if (reportType === 'weekly') {
        setWeeklyReport(response.data);
      } else {
        setMonthlyReport(response.data);
      }
    } catch (error) {
      console.error('Error fetching report:', error);
      toast.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    toast.info('Export functionality coming soon');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">OPD Reports</h1>
          <p className="text-gray-600 mt-1">View comprehensive OPD statistics and analytics</p>
        </div>
        <Button onClick={exportReport} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Report Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Report Type</label>
              <Select value={reportType} onValueChange={(value: any) => setReportType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily Report</SelectItem>
                  <SelectItem value="weekly">Weekly Report</SelectItem>
                  <SelectItem value="monthly">Monthly Report</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Select Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading report...</div>
      ) : (
        <>
          {/* Daily Report */}
          {reportType === 'daily' && dailyReport && (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Total Registrations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{dailyReport.totalRegistrations}</div>
                    <p className="text-xs text-gray-500 mt-1">Patients registered</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Checked In</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">{dailyReport.totalCheckedIn}</div>
                    <p className="text-xs text-gray-500 mt-1">
                      {dailyReport.checkInRate.toFixed(1)}% check-in rate
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Completed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600">{dailyReport.totalCompleted}</div>
                    <p className="text-xs text-gray-500 mt-1">Consultations done</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Avg Wait Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-orange-600">
                      {dailyReport.averageWaitTime} min
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Average waiting</p>
                  </CardContent>
                </Card>
              </div>

              {/* Department Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Department-wise Distribution</CardTitle>
                  <CardDescription>Patient distribution across departments</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Department</TableHead>
                        <TableHead>Count</TableHead>
                        <TableHead>Percentage</TableHead>
                        <TableHead>Visual</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyReport.departmentDistribution.map((dept, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{dept.department}</TableCell>
                          <TableCell>{dept.count}</TableCell>
                          <TableCell>{dept.percentage}%</TableCell>
                          <TableCell>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${dept.percentage}%` }}
                              ></div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Peak Hours */}
              <Card>
                <CardHeader>
                  <CardTitle>Peak Hours Analysis</CardTitle>
                  <CardDescription>Patient flow throughout the day</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {dailyReport.peakHours.map((hour) => (
                      <div key={hour.hour} className="text-center">
                        <div className="text-2xl font-bold text-gray-700">{hour.count}</div>
                        <div className="text-xs text-gray-500">
                          {hour.hour}:00 - {hour.hour + 1}:00
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Weekly Report */}
          {reportType === 'weekly' && weeklyReport && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Week Overview</CardTitle>
                    <CardDescription>
                      {new Date(weeklyReport.weekStart).toLocaleDateString()} -{' '}
                      {new Date(weeklyReport.weekEnd).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm text-gray-600">Total Registrations</div>
                        <div className="text-3xl font-bold">{weeklyReport.totalRegistrations}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Average Daily</div>
                        <div className="text-2xl font-semibold text-blue-600">
                          {weeklyReport.averageDaily}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Daily Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {weeklyReport.dailyBreakdown.map((day, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-sm font-medium">{day.dayName}</span>
                          <Badge variant="outline">{day.count} patients</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Department Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Department</TableHead>
                        <TableHead>Count</TableHead>
                        <TableHead>Percentage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {weeklyReport.departmentDistribution.map((dept, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{dept.department}</TableCell>
                          <TableCell>{dept.count}</TableCell>
                          <TableCell>{dept.percentage}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}

          {/* Monthly Report */}
          {reportType === 'monthly' && monthlyReport && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Monthly Overview</CardTitle>
                    <CardDescription>
                      {monthlyReport.month} {monthlyReport.year}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm text-gray-600">Total Registrations</div>
                        <div className="text-3xl font-bold">{monthlyReport.totalRegistrations}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Average Daily</div>
                        <div className="text-2xl font-semibold text-blue-600">
                          {monthlyReport.averageDaily}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Weekly Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {monthlyReport.weeklyBreakdown.map((week, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-sm font-medium">Week {week.weekNumber}</span>
                          <Badge variant="outline">{week.count} patients</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Department Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Department</TableHead>
                        <TableHead>Count</TableHead>
                        <TableHead>Percentage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyReport.departmentDistribution.map((dept, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{dept.department}</TableCell>
                          <TableCell>{dept.count}</TableCell>
                          <TableCell>{dept.percentage}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
