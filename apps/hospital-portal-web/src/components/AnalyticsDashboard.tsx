'use client';

import * as React from 'react';
import { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  DollarSign,
  Activity,
  UserPlus,
  Clock,
  Stethoscope,
  Building2,
  Download,
  Filter,
  ChevronDown
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

// Types
type TimePeriod = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

interface MetricCard {
  title: string;
  value: string;
  change: number;
  trend: 'up' | 'down';
  icon: any;
  color: string;
}

interface ChartDataPoint {
  name: string;
  value: number;
  patients?: number;
  revenue?: number;
  appointments?: number;
  [key: string]: any;
}

// Mock Data
const generatePatientRegistrationData = (): ChartDataPoint[] => [
  { name: 'Jan', patients: 245, revenue: 48500 },
  { name: 'Feb', patients: 289, revenue: 52300 },
  { name: 'Mar', patients: 312, revenue: 58900 },
  { name: 'Apr', patients: 278, revenue: 51200 },
  { name: 'May', patients: 334, revenue: 63400 },
  { name: 'Jun', patients: 367, revenue: 71800 },
  { name: 'Jul', patients: 398, revenue: 78200 },
  { name: 'Aug', patients: 423, revenue: 84500 },
  { name: 'Sep', patients: 445, revenue: 89300 },
  { name: 'Oct', patients: 456, revenue: 92600 },
  { name: 'Nov', patients: 478, revenue: 97800 },
  { name: 'Dec', patients: 502, revenue: 105200 }
];

const appointmentsByDepartment = (): ChartDataPoint[] => [
  { name: 'Ophthalmology', appointments: 456, revenue: 91200 },
  { name: 'Optometry', appointments: 389, revenue: 58350 },
  { name: 'Retina', appointments: 267, revenue: 80100 },
  { name: 'Glaucoma', appointments: 234, revenue: 70200 },
  { name: 'Pediatric Eye', appointments: 198, revenue: 39600 },
  { name: 'Cornea', appointments: 176, revenue: 52800 },
  { name: 'Emergency', appointments: 145, revenue: 29000 }
];

const patientDemographics = (): ChartDataPoint[] => [
  { name: 'Children (0-17)', value: 234, percentage: 12 },
  { name: 'Adults (18-44)', value: 789, percentage: 41 },
  { name: 'Middle Age (45-64)', value: 567, percentage: 29 },
  { name: 'Seniors (65+)', value: 345, percentage: 18 }
];

const genderDistribution = (): ChartDataPoint[] => [
  { name: 'Male', value: 912, percentage: 47 },
  { name: 'Female', value: 1023, percentage: 53 }
];

const revenueByMonth = (): ChartDataPoint[] => [
  { name: 'Jan', revenue: 48500, expenses: 32100 },
  { name: 'Feb', revenue: 52300, expenses: 34200 },
  { name: 'Mar', revenue: 58900, expenses: 36800 },
  { name: 'Apr', revenue: 51200, expenses: 33500 },
  { name: 'May', revenue: 63400, expenses: 38900 },
  { name: 'Jun', revenue: 71800, expenses: 42300 },
  { name: 'Jul', revenue: 78200, expenses: 45600 },
  { name: 'Aug', revenue: 84500, expenses: 48200 },
  { name: 'Sep', revenue: 89300, expenses: 51400 },
  { name: 'Oct', revenue: 92600, expenses: 53200 },
  { name: 'Nov', revenue: 97800, expenses: 56100 },
  { name: 'Dec', revenue: 105200, expenses: 59800 }
];

const appointmentStatusData = (): ChartDataPoint[] => [
  { name: 'Completed', value: 1456, percentage: 68 },
  { name: 'Scheduled', value: 423, percentage: 20 },
  { name: 'Cancelled', value: 156, percentage: 7 },
  { name: 'No Show', value: 98, percentage: 5 }
];

const topDoctors = () => [
  { name: 'Dr. Sarah Johnson', appointments: 234, revenue: 46800, rating: 4.9 },
  { name: 'Dr. Michael Chen', appointments: 218, revenue: 43600, rating: 4.8 },
  { name: 'Dr. Emily Davis', appointments: 203, revenue: 40600, rating: 4.9 },
  { name: 'Dr. Robert Wilson', appointments: 189, revenue: 37800, rating: 4.7 },
  { name: 'Dr. Lisa Anderson', appointments: 176, revenue: 35200, rating: 4.8 }
];

const hourlyAppointments = (): ChartDataPoint[] => [
  { name: '8 AM', appointments: 12 },
  { name: '9 AM', appointments: 24 },
  { name: '10 AM', appointments: 36 },
  { name: '11 AM', appointments: 42 },
  { name: '12 PM', appointments: 28 },
  { name: '1 PM', appointments: 18 },
  { name: '2 PM', appointments: 38 },
  { name: '3 PM', appointments: 45 },
  { name: '4 PM', appointments: 39 },
  { name: '5 PM', appointments: 32 },
  { name: '6 PM', appointments: 22 },
  { name: '7 PM', appointments: 14 }
];

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

const PATIENT_REGISTRATION_DATA = generatePatientRegistrationData();
const APPOINTMENTS_BY_DEPARTMENT_DATA = appointmentsByDepartment();
const PATIENT_DEMOGRAPHICS_DATA = patientDemographics();
const REVENUE_BY_MONTH_DATA = revenueByMonth();
const APPOINTMENT_STATUS_DATA = appointmentStatusData();
const HOURLY_APPOINTMENTS_DATA = hourlyAppointments();

export function AnalyticsDashboard() {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');
  const [showFilters, setShowFilters] = useState(false);

  // Overview Metrics
  const metrics: MetricCard[] = [
    {
      title: 'Total Revenue',
      value: '$856,400',
      change: 12.5,
      trend: 'up',
      icon: DollarSign,
      color: 'text-emerald-600 bg-emerald-100'
    },
    {
      title: 'Total Patients',
      value: '1,935',
      change: 8.2,
      trend: 'up',
      icon: Users,
      color: 'text-blue-600 bg-blue-100'
    },
    {
      title: 'Appointments',
      value: '2,133',
      change: 15.3,
      trend: 'up',
      icon: Calendar,
      color: 'text-purple-600 bg-purple-100'
    },
    {
      title: 'New Patients',
      value: '234',
      change: -3.1,
      trend: 'down',
      icon: UserPlus,
      color: 'text-amber-600 bg-amber-100'
    },
    {
      title: 'Avg Wait Time',
      value: '18 min',
      change: -12.4,
      trend: 'up',
      icon: Clock,
      color: 'text-red-600 bg-red-100'
    },
    {
      title: 'Patient Satisfaction',
      value: '94.2%',
      change: 2.8,
      trend: 'up',
      icon: Activity,
      color: 'text-green-600 bg-green-100'
    }
  ];

  const handleExport = () => {
    console.log('Exporting analytics data...');
    // Implement export functionality
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {typeof entry.value === 'number' && entry.name.toLowerCase().includes('revenue')
                ? `$${entry.value.toLocaleString()}`
                : entry.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-500">Comprehensive insights and data visualization</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="outline"
          >
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
          <Button onClick={handleExport} className="bg-emerald-600 hover:bg-emerald-700">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Time Period Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Time Period:</Label>
            <div className="flex gap-2">
              {(['today', 'week', 'month', 'quarter', 'year'] as TimePeriod[]).map((period) => (
                <button
                  key={period}
                  onClick={() => setTimePeriod(period)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    timePeriod === period
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          const TrendIcon = metric.trend === 'up' ? TrendingUp : TrendingDown;
          const trendColor = metric.trend === 'up' ? 'text-green-600' : 'text-red-600';

          return (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-2 rounded-lg ${metric.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className={`flex items-center text-sm font-medium ${trendColor}`}>
                    <TrendIcon className="h-4 w-4 mr-1" />
                    {Math.abs(metric.change)}%
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row 1: Patient Trends & Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Patient Registration Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Patient Registration Trend</CardTitle>
            <CardDescription>Monthly new patient registrations over the year</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={PATIENT_REGISTRATION_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="patients"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: '#10b981', r: 4 }}
                  activeDot={{ r: 6 }}
                  name="New Patients"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue & Expenses</CardTitle>
            <CardDescription>Monthly revenue and expenses comparison</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={REVENUE_BY_MONTH_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stackId="1"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.6}
                  name="Revenue"
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  stackId="2"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.6}
                  name="Expenses"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Appointments by Department & Demographics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appointments by Department */}
        <Card>
          <CardHeader>
            <CardTitle>Appointments by Department</CardTitle>
            <CardDescription>Total appointments per department this month</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={APPOINTMENTS_BY_DEPARTMENT_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#6b7280" angle={-45} textAnchor="end" height={100} />
                <YAxis stroke="#6b7280" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="appointments" fill="#10b981" name="Appointments" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Patient Demographics */}
        <Card>
          <CardHeader>
            <CardTitle>Patient Demographics</CardTitle>
            <CardDescription>Patient distribution by age group</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={PATIENT_DEMOGRAPHICS_DATA}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {PATIENT_DEMOGRAPHICS_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3: Appointment Status & Gender Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appointment Status */}
        <Card>
          <CardHeader>
            <CardTitle>Appointment Status Distribution</CardTitle>
            <CardDescription>Breakdown of appointment statuses</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={APPOINTMENT_STATUS_DATA}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {APPOINTMENT_STATUS_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Hourly Appointments */}
        <Card>
          <CardHeader>
            <CardTitle>Appointments by Hour</CardTitle>
            <CardDescription>Average appointments per hour of the day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={HOURLY_APPOINTMENTS_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="appointments" fill="#3b82f6" name="Appointments" radius={[8, 8, 0, 0]}>
                  {HOURLY_APPOINTMENTS_DATA.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.appointments > 40 ? '#10b981' : entry.appointments > 30 ? '#3b82f6' : '#f59e0b'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Department Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Building2 className="mr-2 h-5 w-5" />
            Department Performance
          </CardTitle>
          <CardDescription>Revenue and appointment metrics by department</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Department</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900">Appointments</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900">Revenue</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900">Avg per Appt</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900">Growth</th>
                </tr>
              </thead>
              <tbody>
                {APPOINTMENTS_BY_DEPARTMENT_DATA.map((dept, index) => {
                  const avgRevenue = dept.revenue / dept.appointments;
                  const growth = Math.random() * 20 - 5; // Mock growth data

                  return (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{dept.name}</td>
                      <td className="text-right py-3 px-4">{dept.appointments.toLocaleString()}</td>
                      <td className="text-right py-3 px-4 text-emerald-600 font-medium">
                        ${dept.revenue.toLocaleString()}
                      </td>
                      <td className="text-right py-3 px-4">${avgRevenue.toFixed(2)}</td>
                      <td className="text-right py-3 px-4">
                        <span className={`flex items-center justify-end ${growth > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {growth > 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                          {Math.abs(growth).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Top Performing Doctors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Stethoscope className="mr-2 h-5 w-5" />
            Top Performing Doctors
          </CardTitle>
          <CardDescription>Doctors with highest appointments and revenue this month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topDoctors().map((doctor, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 bg-emerald-100 text-emerald-600 font-bold rounded-full">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{doctor.name}</p>
                    <p className="text-sm text-gray-500">Rating: {doctor.rating} ⭐</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">{doctor.appointments} appointments</p>
                  <p className="text-sm text-emerald-600 font-medium">${doctor.revenue.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">Today's Appointments</p>
              <p className="text-3xl font-bold text-gray-900">42</p>
              <p className="text-sm text-green-600 mt-2">↑ 12% from yesterday</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">Waiting Patients</p>
              <p className="text-3xl font-bold text-gray-900">8</p>
              <p className="text-sm text-amber-600 mt-2">Avg wait: 15 min</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">Bed Occupancy</p>
              <p className="text-3xl font-bold text-gray-900">87%</p>
              <p className="text-sm text-blue-600 mt-2">12 of 92 available</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">Staff on Duty</p>
              <p className="text-3xl font-bold text-gray-900">34</p>
              <p className="text-sm text-purple-600 mt-2">28 doctors, 6 nurses</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
