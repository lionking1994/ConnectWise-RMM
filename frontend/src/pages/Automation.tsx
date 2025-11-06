import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Switch,
  Chip,
  IconButton,
  Tooltip,
  Button,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Edit as EditIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import axios from 'axios';
import { getApiUrl } from '../config/api';

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: string;
  actions: string[];
  lastTriggered: string;
  executionCount: number;
  successRate: number;
}

export const Automation: React.FC = () => {
  const navigate = useNavigate();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRule, setSelectedRule] = useState<AutomationRule | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | 'test'>('create');

  const fetchRules = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${getApiUrl()}/api/automation/rules`);
      setRules(response.data.data || []);
    } catch (error) {
      console.error('Error fetching automation rules:', error);
      setRules([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleToggleRule = async (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;
    
    try {
      // In production, this would make an API call
      setRules(prev => prev.map(r =>
        r.id === ruleId ? { ...r, enabled: !r.enabled } : r
      ));
      
      console.log(`Rule ${rule.name} ${!rule.enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error toggling rule:', error);
    }
  };

  const handleCreateRule = () => {
    navigate('/automation/rules/new');
  };

  const handleEditRule = (rule: AutomationRule) => {
    navigate(`/automation/rules/${rule.id}`);
  };

  const handleTestRule = async (rule: AutomationRule) => {
    console.log('Testing rule:', rule.name);
    alert(`Testing Rule: ${rule.name}\n\nIn production, this would:\n1. Execute the rule in test mode\n2. Show execution results\n3. Not affect actual tickets`);
    
    // Simulate test execution
    setTimeout(() => {
      alert(`Test Result for ${rule.name}:\n\n✅ Test successful!\nExecution time: 2.3s\nActions performed: ${rule.actions.join(', ')}`);
    }, 1000);
  };

  const handleStopRule = async (rule: AutomationRule) => {
    if (window.confirm(`Are you sure you want to stop the rule "${rule.name}"?`)) {
      console.log('Stopping rule:', rule.name);
      handleToggleRule(rule.id);
      alert(`Rule "${rule.name}" has been stopped`);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Less than 1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 95) return 'success';
    if (rate >= 80) return 'warning';
    return 'error';
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Automation Rules
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchRules}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={handleCreateRule}
          >
            Create Rule
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4">{rules.length}</Typography>
            <Typography color="textSecondary">Total Rules</Typography>
          </Paper>
        </Grid>
        <Grid item xs={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="success.main">
              {rules.filter(r => r.enabled).length}
            </Typography>
            <Typography color="textSecondary">Active Rules</Typography>
          </Paper>
        </Grid>
        <Grid item xs={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="info.main">
              {rules.reduce((sum, r) => sum + r.executionCount, 0)}
            </Typography>
            <Typography color="textSecondary">Total Executions</Typography>
          </Paper>
        </Grid>
        <Grid item xs={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="primary.main">
              {rules.length ? 
                Math.round(rules.reduce((sum, r) => sum + r.successRate, 0) / rules.length) : 0}%
            </Typography>
            <Typography color="textSecondary">Avg Success Rate</Typography>
          </Paper>
        </Grid>
      </Grid>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Status</TableCell>
              <TableCell>Rule Name</TableCell>
              <TableCell>Trigger</TableCell>
              <TableCell>Actions</TableCell>
              <TableCell>Last Triggered</TableCell>
              <TableCell>Executions</TableCell>
              <TableCell>Success Rate</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center">Loading automation rules...</TableCell>
              </TableRow>
            ) : rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">No automation rules found</TableCell>
              </TableRow>
            ) : (
              rules.map((rule) => (
                <TableRow key={rule.id} hover>
                  <TableCell>
                    <Switch
                      checked={rule.enabled}
                      onChange={() => handleToggleRule(rule.id)}
                      color="primary"
                    />
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight="bold">
                        {rule.name}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {rule.description}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={rule.trigger}
                      size="small"
                      variant="outlined"
                      icon={<ScheduleIcon />}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ maxWidth: 200 }}>
                      {rule.actions.slice(0, 2).map((action, index) => (
                        <Chip
                          key={index}
                          label={action}
                          size="small"
                          sx={{ m: 0.5 }}
                        />
                      ))}
                      {rule.actions.length > 2 && (
                        <Typography variant="caption" color="textSecondary">
                          +{rule.actions.length - 2} more
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {formatDate(rule.lastTriggered)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2" fontWeight="bold">
                      {rule.executionCount}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={rule.successRate}
                        sx={{ width: 60, height: 6, borderRadius: 3 }}
                        color={getSuccessRateColor(rule.successRate) as any}
                      />
                      <Typography variant="body2" fontWeight="bold">
                        {rule.successRate}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="Edit Rule">
                        <IconButton size="small" color="primary" onClick={() => handleEditRule(rule)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Test Rule">
                        <IconButton size="small" color="success" onClick={() => handleTestRule(rule)}>
                          <PlayArrowIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {rule.enabled && (
                        <Tooltip title="Stop Rule">
                          <IconButton size="small" color="error" onClick={() => handleStopRule(rule)}>
                            <StopIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Grid container spacing={3} sx={{ mt: 3 }}>
        <Grid item xs={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Recent Executions
            </Typography>
            <List>
              <ListItem>
                <CheckCircleIcon color="success" sx={{ mr: 2 }} />
                <ListItemText
                  primary="Disk Space Cleanup - Server-01"
                  secondary="Completed 15 minutes ago"
                />
              </ListItem>
              <ListItem>
                <CheckCircleIcon color="success" sx={{ mr: 2 }} />
                <ListItemText
                  primary="Service Restart - IIS Application Pool"
                  secondary="Completed 1 hour ago"
                />
              </ListItem>
              <ListItem>
                <ErrorIcon color="error" sx={{ mr: 2 }} />
                <ListItemText
                  primary="Database Backup - SQL Server"
                  secondary="Failed 2 hours ago"
                />
              </ListItem>
            </List>
          </Paper>
        </Grid>
        <Grid item xs={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Upcoming Scheduled Actions
            </Typography>
            <List>
              <ListItem>
                <ScheduleIcon color="info" sx={{ mr: 2 }} />
                <ListItemText
                  primary="Security Patch Installation"
                  secondary="Scheduled for 2:00 AM tomorrow"
                />
              </ListItem>
              <ListItem>
                <ScheduleIcon color="info" sx={{ mr: 2 }} />
                <ListItemText
                  primary="System Health Check"
                  secondary="Runs every 6 hours"
                />
              </ListItem>
              <ListItem>
                <ScheduleIcon color="info" sx={{ mr: 2 }} />
                <ListItemText
                  primary="Log File Rotation"
                  secondary="Daily at midnight"
                />
              </ListItem>
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};