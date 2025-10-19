import React from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Error,
  Warning,
  Schedule,
  Refresh,
  Speed,
  BugReport,
  AutoFixHigh,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import { api } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import { StatCard } from '../components/dashboard/StatCard';
import { RecentTickets } from '../components/dashboard/RecentTickets';
import { AutomationActivity } from '../components/dashboard/AutomationActivity';
import { SystemHealth } from '../components/dashboard/SystemHealth';

const COLORS = ['#4caf50', '#ff9800', '#f44336', '#2196f3'];

export const Dashboard: React.FC = () => {
  const socket = useSocket();

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/api/analytics/dashboard-stats').then(res => res.data),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: ticketTrends } = useQuery({
    queryKey: ['ticket-trends'],
    queryFn: () => api.get('/api/analytics/ticket-trends').then(res => res.data),
  });

  const { data: automationMetrics } = useQuery({
    queryKey: ['automation-metrics'],
    queryFn: () => api.get('/api/analytics/automation-metrics').then(res => res.data),
  });

  React.useEffect(() => {
    if (socket) {
      socket.on('ticket:created', () => refetchStats());
      socket.on('ticket:updated', () => refetchStats());
      socket.on('automation:completed', () => refetchStats());
    }
    return () => {
      if (socket) {
        socket.off('ticket:created');
        socket.off('ticket:updated');
        socket.off('automation:completed');
      }
    };
  }, [socket, refetchStats]);

  if (statsLoading) {
    return <LinearProgress />;
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Dashboard
        </Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={() => refetchStats()}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Open Tickets"
            value={stats?.openTickets || 0}
            change={stats?.openTicketsChange || 0}
            icon={<BugReport />}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Automation Success Rate"
            value={`${stats?.automationSuccessRate || 0}%`}
            change={stats?.automationSuccessChange || 0}
            icon={<AutoFixHigh />}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Avg Resolution Time"
            value={`${stats?.avgResolutionTime || 0}h`}
            change={stats?.resolutionTimeChange || 0}
            icon={<Schedule />}
            color="warning"
            inverse
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Devices"
            value={stats?.activeDevices || 0}
            change={stats?.devicesChange || 0}
            icon={<Speed />}
            color="info"
          />
        </Grid>
      </Grid>

      {/* Charts Row */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Ticket Trends (Last 7 Days)
            </Typography>
            <ResponsiveContainer width="100%" height="90%">
              <AreaChart data={ticketTrends?.daily || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="created"
                  stackId="1"
                  stroke="#8884d8"
                  fill="#8884d8"
                  name="Created"
                />
                <Area
                  type="monotone"
                  dataKey="resolved"
                  stackId="1"
                  stroke="#82ca9d"
                  fill="#82ca9d"
                  name="Resolved"
                />
                <Area
                  type="monotone"
                  dataKey="automated"
                  stackId="1"
                  stroke="#ffc658"
                  fill="#ffc658"
                  name="Automated"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Ticket Distribution
            </Typography>
            <ResponsiveContainer width="100%" height="90%">
              <PieChart>
                <Pie
                  data={stats?.ticketsByPriority || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {(stats?.ticketsByPriority || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Automation Performance */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Automation Performance (Last 24 Hours)
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={automationMetrics?.hourly || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <ChartTooltip />
                <Legend />
                <Bar dataKey="successful" fill="#4caf50" name="Successful" />
                <Bar dataKey="failed" fill="#f44336" name="Failed" />
                <Bar dataKey="pending" fill="#ff9800" name="Pending" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Bottom Row */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <RecentTickets />
        </Grid>
        <Grid item xs={12} md={4}>
          <AutomationActivity />
        </Grid>
        <Grid item xs={12} md={4}>
          <SystemHealth />
        </Grid>
      </Grid>
    </Box>
  );
};


