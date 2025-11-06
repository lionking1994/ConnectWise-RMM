import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  LinearProgress
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccessTime as AccessTimeIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Speed as SpeedIcon,
  Build as BuildIcon,
  Assignment as AssignmentIcon
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import axios from 'axios';
import { getApiUrl } from '../config/api';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

interface AnalyticsMetrics {
  overview: {
    totalTickets: number;
    openTickets: number;
    resolvedTickets: number;
    pendingTickets: number;
    avgResolutionTime: number;
    automationRate: number;
  };
  performance: {
    avgResponseTime: number;
    slaCompliance: number;
    firstCallResolution: number;
    customerSatisfaction: number;
  };
  trends: {
    ticketGrowth: number;
    resolutionImprovement: number;
    automationAdoption: number;
  };
}

export const Analytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState('7days');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [ticketTrends, setTicketTrends] = useState<any[]>([]);
  const [automationMetrics, setAutomationMetrics] = useState<any>(null);

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const [metricsRes, trendsRes, automationRes] = await Promise.all([
        axios.get(`${getApiUrl()}/api/analytics/metrics`, { headers }).catch(() => null),
        axios.get(`${getApiUrl()}/api/analytics/ticket-trends`, { headers }).catch(() => null),
        axios.get(`${getApiUrl()}/api/analytics/automation-metrics`, { headers }).catch(() => null)
      ]);

      // Use mock data if API fails
      const defaultMetrics: AnalyticsMetrics = {
        overview: {
          totalTickets: 342,
          openTickets: 45,
          resolvedTickets: 278,
          pendingTickets: 19,
          avgResolutionTime: 4.2,
          automationRate: 68
        },
        performance: {
          avgResponseTime: 1.5,
          slaCompliance: 94,
          firstCallResolution: 72,
          customerSatisfaction: 4.3
        },
        trends: {
          ticketGrowth: 12.5,
          resolutionImprovement: 8.3,
          automationAdoption: 15.7
        }
      };

      const defaultTrends = [
        { date: 'Mon', created: 45, resolved: 38, escalated: 5 },
        { date: 'Tue', created: 52, resolved: 48, escalated: 3 },
        { date: 'Wed', created: 48, resolved: 42, escalated: 6 },
        { date: 'Thu', created: 58, resolved: 53, escalated: 4 },
        { date: 'Fri', created: 62, resolved: 55, escalated: 7 },
        { date: 'Sat', created: 35, resolved: 33, escalated: 2 },
        { date: 'Sun', created: 28, resolved: 26, escalated: 1 }
      ];

      const defaultAutomationMetrics = {
        successRate: 87,
        totalExecutions: 1247,
        failedExecutions: 162
      };

      setMetrics(metricsRes?.data || defaultMetrics);
      setTicketTrends(trendsRes?.data?.trends || defaultTrends);
      setAutomationMetrics(automationRes?.data || defaultAutomationMetrics);
      
      if (!metricsRes && !trendsRes && !automationRes) {
        setError('Using demo data. Configure API credentials in Settings to see real data.');
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setError('Failed to load analytics data. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const getChangeIcon = (value: number) => {
    return value >= 0 ? <TrendingUpIcon fontSize="small" /> : <TrendingDownIcon fontSize="small" />;
  };

  const getChangeColor = (value: number, inverse: boolean = false) => {
    if (inverse) {
      return value <= 0 ? 'success.main' : 'error.main';
    }
    return value >= 0 ? 'success.main' : 'error.main';
  };

  // Prepare data for priority distribution chart
  const priorityData = [
    { name: 'Critical', value: 12, percentage: 10 },
    { name: 'High', value: 28, percentage: 23 },
    { name: 'Medium', value: 45, percentage: 37 },
    { name: 'Low', value: 36, percentage: 30 }
  ];

  // Prepare data for automation effectiveness
  const automationEffectiveness = [
    { name: 'Mon', automated: 65, manual: 35 },
    { name: 'Tue', automated: 72, manual: 28 },
    { name: 'Wed', automated: 68, manual: 32 },
    { name: 'Thu', automated: 80, manual: 20 },
    { name: 'Fri', automated: 75, manual: 25 },
    { name: 'Sat', automated: 82, manual: 18 },
    { name: 'Sun', automated: 78, manual: 22 }
  ];

  // Prepare data for resolution time by category
  const resolutionTimeData = [
    { category: 'Network', avgTime: 2.5, tickets: 45 },
    { category: 'Hardware', avgTime: 4.2, tickets: 32 },
    { category: 'Software', avgTime: 3.1, tickets: 67 },
    { category: 'Security', avgTime: 1.8, tickets: 23 },
    { category: 'Database', avgTime: 3.7, tickets: 18 }
  ];

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Box sx={{ textAlign: 'center' }}>
          <LinearProgress sx={{ width: 200, mb: 2 }} />
          <Typography>Loading analytics...</Typography>
        </Box>
      </Box>
    );
  }

  if (!metrics) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Failed to load analytics data</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Box sx={{ mb: 2, p: 2, bgcolor: 'info.main', color: 'white', borderRadius: 1 }}>
          <Typography variant="body2">{error}</Typography>
        </Box>
      )}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Analytics Dashboard
        </Typography>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Time Range</InputLabel>
          <Select
            value={timeRange}
            label="Time Range"
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <MenuItem value="24hours">Last 24 Hours</MenuItem>
            <MenuItem value="7days">Last 7 Days</MenuItem>
            <MenuItem value="30days">Last 30 Days</MenuItem>
            <MenuItem value="90days">Last 90 Days</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Key Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Tickets
                  </Typography>
                  <Typography variant="h4">
                    {metrics.overview.totalTickets}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                    {getChangeIcon(metrics.trends.ticketGrowth)}
                    <Typography 
                      variant="body2" 
                      color={getChangeColor(metrics.trends.ticketGrowth)}
                      sx={{ ml: 0.5 }}
                    >
                      {Math.abs(metrics.trends.ticketGrowth)}%
                    </Typography>
                  </Box>
                </Box>
                <AssignmentIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Avg Resolution Time
                  </Typography>
                  <Typography variant="h4">
                    {metrics.overview.avgResolutionTime}h
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                    {getChangeIcon(-metrics.trends.resolutionImprovement)}
                    <Typography 
                      variant="body2" 
                      color={getChangeColor(metrics.trends.resolutionImprovement, true)}
                      sx={{ ml: 0.5 }}
                    >
                      {Math.abs(metrics.trends.resolutionImprovement)}%
                    </Typography>
                  </Box>
                </Box>
                <AccessTimeIcon color="warning" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Automation Rate
                  </Typography>
                  <Typography variant="h4">
                    {metrics.overview.automationRate}%
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                    {getChangeIcon(metrics.trends.automationAdoption)}
                    <Typography 
                      variant="body2" 
                      color={getChangeColor(metrics.trends.automationAdoption)}
                      sx={{ ml: 0.5 }}
                    >
                      {Math.abs(metrics.trends.automationAdoption)}%
                    </Typography>
                  </Box>
                </Box>
                <BuildIcon color="success" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    SLA Compliance
                  </Typography>
                  <Typography variant="h4">
                    {metrics.performance.slaCompliance}%
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={metrics.performance.slaCompliance} 
                    sx={{ mt: 1 }}
                    color={metrics.performance.slaCompliance >= 90 ? 'success' : 'warning'}
                  />
                </Box>
                <CheckCircleIcon color="info" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Row 1 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Ticket Trends
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={ticketTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
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
                  dataKey="escalated" 
                  stackId="1"
                  stroke="#ffc658" 
                  fill="#ffc658" 
                  name="Escalated"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Ticket Priority Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={priorityData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {priorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Charts Row 2 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Automation vs Manual Resolution
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={automationEffectiveness}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="automated" stackId="a" fill="#82ca9d" name="Automated" />
                <Bar dataKey="manual" stackId="a" fill="#8884d8" name="Manual" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Resolution Time by Category
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={resolutionTimeData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="category" type="category" />
                <Tooltip />
                <Bar dataKey="avgTime" fill="#00C49F" name="Avg Time (hours)" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Performance Metrics */}
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Performance Metrics
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <SpeedIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                  <Typography variant="h5" sx={{ mt: 1 }}>
                    {metrics.performance.avgResponseTime}h
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Average Response Time
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={100 - (metrics.performance.avgResponseTime * 10)} 
                    sx={{ mt: 1 }}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <CheckCircleIcon sx={{ fontSize: 40, color: 'success.main' }} />
                  <Typography variant="h5" sx={{ mt: 1 }}>
                    {metrics.performance.firstCallResolution}%
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    First Call Resolution
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={metrics.performance.firstCallResolution} 
                    sx={{ mt: 1 }}
                    color="success"
                  />
                </Box>
              </Grid>

              <Grid item xs={12} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <BuildIcon sx={{ fontSize: 40, color: 'info.main' }} />
                  <Typography variant="h5" sx={{ mt: 1 }}>
                    {automationMetrics?.successRate || 0}%
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Automation Success Rate
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={automationMetrics?.successRate || 0} 
                    sx={{ mt: 1 }}
                    color="info"
                  />
                </Box>
              </Grid>

              <Grid item xs={12} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <TrendingUpIcon sx={{ fontSize: 40, color: 'warning.main' }} />
                  <Typography variant="h5" sx={{ mt: 1 }}>
                    {metrics.performance.customerSatisfaction}/5
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Customer Satisfaction
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={metrics.performance.customerSatisfaction * 20} 
                    sx={{ mt: 1 }}
                    color="warning"
                  />
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Analytics; 
