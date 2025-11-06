import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Stack,
  Divider,
  Alert,
  CircularProgress,
  IconButton,
  Switch,
  FormControlLabel,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  PlayArrow as TestIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { getApiUrl } from '../config/api';

interface RuleCondition {
  field: string;
  operator: string;
  value: string;
}

interface RuleAction {
  type: string;
  parameters: Record<string, any>;
}

interface AutomationRule {
  id?: string;
  name: string;
  description: string;
  isActive: boolean;
  priority: number;
  trigger: {
    type: string;
    conditions: RuleCondition[];
    logicalOperator: 'AND' | 'OR';
  };
  actions: RuleAction[];
  schedule?: {
    frequency: string;
    time?: string;
    dayOfWeek?: string;
    dayOfMonth?: number;
  };
}

export const RuleEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const isNewRule = id === 'new' || !id;

  const [rule, setRule] = useState<AutomationRule>({
    name: '',
    description: '',
    isActive: true,
    priority: 1,
    trigger: {
      type: 'alert',
      conditions: [],
      logicalOperator: 'AND'
    },
    actions: []
  });

  const [loading, setLoading] = useState(!isNewRule);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triggerTypes = [
    { value: 'alert', label: 'N-able Alert' },
    { value: 'ticket_created', label: 'Ticket Created' },
    { value: 'ticket_updated', label: 'Ticket Updated' },
    { value: 'ticket_status_changed', label: 'Ticket Status Changed' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'manual', label: 'Manual Trigger' }
  ];

  const conditionFields = [
    { value: 'alertType', label: 'Alert Type' },
    { value: 'severity', label: 'Severity' },
    { value: 'deviceId', label: 'Device ID' },
    { value: 'deviceName', label: 'Device Name' },
    { value: 'serviceName', label: 'Service Name' },
    { value: 'cpuPercent', label: 'CPU Percentage' },
    { value: 'memoryPercent', label: 'Memory Percentage' },
    { value: 'diskPercent', label: 'Disk Usage %' },
    { value: 'status', label: 'Ticket Status' },
    { value: 'priority', label: 'Priority' },
    { value: 'source', label: 'Source' },
    { value: 'client', label: 'Client' }
  ];

  const conditionOperators = [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does Not Contain' },
    { value: 'in', label: 'In (comma-separated)' },
    { value: 'greater_than', label: 'Greater Than' },
    { value: 'less_than', label: 'Less Than' },
    { value: 'starts_with', label: 'Starts With' },
    { value: 'ends_with', label: 'Ends With' },
    { value: 'is_empty', label: 'Is Empty' },
    { value: 'is_not_empty', label: 'Is Not Empty' }
  ];

  const actionTypes = [
    { value: 'execute_script', label: 'Execute N-able Script' },
    { value: 'update_ticket', label: 'Update ConnectWise Ticket' },
    { value: 'close_ticket', label: 'Close Ticket' },
    { value: 'add_note', label: 'Add Ticket Note' },
    { value: 'escalate', label: 'Escalate to Technician' },
    { value: 'send_teams_message', label: 'Send Teams Notification' },
    { value: 'assign_ticket', label: 'Assign Ticket' },
    { value: 'set_priority', label: 'Set Priority' },
    { value: 'webhook', label: 'Call Webhook' }
  ];

  // Predefined alert types from N-able
  const alertTypes = [
    { value: 'DISK_SPACE_LOW', label: 'Disk Space Low' },
    { value: 'SERVICE_STOPPED', label: 'Service Stopped' },
    { value: 'CPU_HIGH', label: 'High CPU Usage' },
    { value: 'MEMORY_HIGH', label: 'High Memory Usage' },
    { value: 'BACKUP_FAILED', label: 'Backup Failed' },
    { value: 'SERVER_DOWN', label: 'Server Down' },
    { value: 'NETWORK_ISSUE', label: 'Network Issue' },
    { value: 'SECURITY_ALERT', label: 'Security Alert' },
    { value: 'UPDATE_AVAILABLE', label: 'Update Available' },
    { value: 'CERTIFICATE_EXPIRING', label: 'Certificate Expiring' }
  ];

  // Predefined scripts
  const availableScripts = [
    { value: 'Clean-TempFiles', label: 'Clean Temporary Files' },
    { value: 'Restart-Service', label: 'Restart Service' },
    { value: 'Analyze-HighCPU', label: 'Analyze High CPU' },
    { value: 'Clear-Memory', label: 'Clear Memory' },
    { value: 'Retry-Backup', label: 'Retry Backup Job' },
    { value: 'Check-DiskSpace', label: 'Check Disk Space' },
    { value: 'Update-Windows', label: 'Install Windows Updates' },
    { value: 'Reset-NetworkAdapter', label: 'Reset Network Adapter' },
    { value: 'Clear-DNSCache', label: 'Clear DNS Cache' },
    { value: 'Restart-Computer', label: 'Restart Computer' }
  ];

  // Severity levels
  const severityLevels = [
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGH', label: 'High' },
    { value: 'CRITICAL', label: 'Critical' }
  ];

  useEffect(() => {
    if (!isNewRule && id) {
      fetchRule();
    }
  }, [id]);

  const fetchRule = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${getApiUrl()}/api/automation/rules/${id}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined
        }
      });

      setRule(response.data);
    } catch (error: any) {
      console.error('Error fetching rule:', error);
      if (error.response?.status === 404) {
        setError('Rule not found');
      } else {
        setError('Failed to load rule. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      if (!rule.name || !rule.description) {
        setError('Please fill in all required fields');
        setSaving(false);
        return;
      }

      const url = isNewRule
        ? `${getApiUrl()}/api/automation/rules`
        : `${getApiUrl()}/api/automation/rules/${id}`;

      const method = isNewRule ? 'post' : 'put';

      const response = await axios[method](url, rule, {
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined
        }
      });

      if (isNewRule) {
        navigate(`/automation/rules/${response.data.id}`);
      } else {
        setRule(response.data);
      }
      
      // Show success message
      alert('Rule saved successfully!');
    } catch (error: any) {
      console.error('Error saving rule:', error);
      setError('Failed to save rule. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setError(null);

      const response = await axios.post(
        `${getApiUrl()}/api/automation/rules/test`,
        rule,
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : undefined
          }
        }
      );

      alert(`Test Results:\n${JSON.stringify(response.data, null, 2)}`);
    } catch (error: any) {
      console.error('Error testing rule:', error);
      setError('Failed to test rule. Please try again.');
    } finally {
      setTesting(false);
    }
  };

  const handleAddCondition = () => {
    setRule({
      ...rule,
      trigger: {
        ...rule.trigger,
        conditions: [
          ...rule.trigger.conditions,
          { field: 'status', operator: 'equals', value: '' }
        ]
      }
    });
  };

  const handleRemoveCondition = (index: number) => {
    setRule({
      ...rule,
      trigger: {
        ...rule.trigger,
        conditions: rule.trigger.conditions.filter((_, i) => i !== index)
      }
    });
  };

  const handleUpdateCondition = (index: number, field: keyof RuleCondition, value: string) => {
    const newConditions = [...rule.trigger.conditions];
    newConditions[index] = { ...newConditions[index], [field]: value };
    setRule({
      ...rule,
      trigger: {
        ...rule.trigger,
        conditions: newConditions
      }
    });
  };

  const handleAddAction = () => {
    setRule({
      ...rule,
      actions: [
        ...rule.actions,
        { type: 'execute_script', parameters: {} }
      ]
    });
  };

  const handleRemoveAction = (index: number) => {
    setRule({
      ...rule,
      actions: rule.actions.filter((_, i) => i !== index)
    });
  };

  const handleUpdateAction = (index: number, field: keyof RuleAction, value: any) => {
    const newActions = [...rule.actions];
    newActions[index] = { ...newActions[index], [field]: value };
    setRule({
      ...rule,
      actions: newActions
    });
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error && !isNewRule) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ p: 3 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button variant="contained" onClick={() => navigate('/automation')}>
            Back to Automation
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => navigate('/automation')}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4">
              {isNewRule ? 'New Automation Rule' : 'Edit Automation Rule'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<TestIcon />}
              onClick={handleTest}
              disabled={saving || testing}
            >
              {testing ? 'Testing...' : 'Test'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<CancelIcon />}
              onClick={() => navigate('/automation')}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </Stack>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Quick Start Guide */}
        {isNewRule && (
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Quick Start: Creating an Automation Rule
            </Typography>
            <Typography variant="body2" component="div">
              <ol style={{ margin: '8px 0', paddingLeft: '20px' }}>
                <li>Set trigger to "N-able Alert" for webhook-based automation</li>
                <li>Add condition: alertType = DISK_SPACE_LOW (or other alert type)</li>
                <li>Add action: Execute N-able Script → Select script → Set parameters</li>
                <li>Configure success/failure behavior (close ticket, escalate, etc.)</li>
                <li>Save and enable the rule</li>
              </ol>
            </Typography>
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Basic Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Rule Name"
                    value={rule.name}
                    onChange={(e) => setRule({ ...rule, name: e.target.value })}
                    required
                    error={!rule.name}
                    helperText={!rule.name ? 'Name is required' : ''}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Priority"
                    type="number"
                    value={rule.priority}
                    onChange={(e) => setRule({ ...rule, priority: parseInt(e.target.value) || 0 })}
                    helperText="Higher priority rules run first"
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={rule.isActive}
                        onChange={(e) => setRule({ ...rule, isActive: e.target.checked })}
                      />
                    }
                    label="Active"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Description"
                    value={rule.description}
                    onChange={(e) => setRule({ ...rule, description: e.target.value })}
                    required
                    error={!rule.description}
                    helperText={!rule.description ? 'Description is required' : ''}
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Trigger Configuration */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Trigger Configuration
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Trigger Type</InputLabel>
                    <Select
                      value={rule.trigger.type}
                      label="Trigger Type"
                      onChange={(e) => setRule({
                        ...rule,
                        trigger: { ...rule.trigger, type: e.target.value }
                      })}
                    >
                      {triggerTypes.map(type => (
                        <MenuItem key={type.value} value={type.value}>
                          {type.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Show alert configuration help when alert trigger is selected */}
                {rule.trigger.type === 'alert' && (
                  <Grid item xs={12}>
                    <Alert severity="info" sx={{ mt: 1 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Alert-based rules trigger when N-able sends webhook notifications.
                      </Typography>
                      <Typography variant="body2">
                        Common conditions: alertType = DISK_SPACE_LOW, severity = HIGH/CRITICAL
                      </Typography>
                    </Alert>
                  </Grid>
                )}

                {/* Conditions */}
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle1">
                      Conditions
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <FormControl size="small">
                        <Select
                          value={rule.trigger.logicalOperator}
                          onChange={(e) => setRule({
                            ...rule,
                            trigger: { ...rule.trigger, logicalOperator: e.target.value as 'AND' | 'OR' }
                          })}
                        >
                          <MenuItem value="AND">Match ALL conditions</MenuItem>
                          <MenuItem value="OR">Match ANY condition</MenuItem>
                        </Select>
                      </FormControl>
                      <Button
                        startIcon={<AddIcon />}
                        onClick={handleAddCondition}
                        size="small"
                      >
                        Add Condition
                      </Button>
                    </Box>
                  </Box>
                  <List>
                    {rule.trigger.conditions.map((condition, index) => (
                      <ListItem key={index} sx={{ px: 0 }}>
                        <Grid container spacing={2} alignItems="center">
                          <Grid item xs={3}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Field</InputLabel>
                              <Select
                                value={condition.field}
                                label="Field"
                                onChange={(e) => handleUpdateCondition(index, 'field', e.target.value)}
                              >
                                {conditionFields.map(field => (
                                  <MenuItem key={field.value} value={field.value}>
                                    {field.label}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={3}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Operator</InputLabel>
                              <Select
                                value={condition.operator}
                                label="Operator"
                                onChange={(e) => handleUpdateCondition(index, 'operator', e.target.value)}
                              >
                                {conditionOperators.map(op => (
                                  <MenuItem key={op.value} value={op.value}>
                                    {op.label}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={5}>
                            {/* Special handling for alertType field */}
                            {condition.field === 'alertType' ? (
                              <FormControl fullWidth size="small">
                                <InputLabel>Value</InputLabel>
                                <Select
                                  value={condition.value}
                                  label="Value"
                                  onChange={(e) => handleUpdateCondition(index, 'value', e.target.value)}
                                >
                                  {alertTypes.map(type => (
                                    <MenuItem key={type.value} value={type.value}>
                                      {type.label}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            ) : condition.field === 'severity' ? (
                              <FormControl fullWidth size="small">
                                <InputLabel>Value</InputLabel>
                                <Select
                                  value={condition.value}
                                  label="Value"
                                  onChange={(e) => handleUpdateCondition(index, 'value', e.target.value)}
                                  multiple={condition.operator === 'in'}
                                >
                                  {severityLevels.map(level => (
                                    <MenuItem key={level.value} value={level.value}>
                                      {level.label}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            ) : (
                            <TextField
                              fullWidth
                              size="small"
                              label="Value"
                              value={condition.value}
                              onChange={(e) => handleUpdateCondition(index, 'value', e.target.value)}
                              disabled={condition.operator === 'is_empty' || condition.operator === 'is_not_empty'}
                                helperText={
                                  condition.operator === 'in' ? 'Comma-separated values' : 
                                  (condition.field === 'cpuPercent' || condition.field === 'memoryPercent' || condition.field === 'diskPercent') ? 'Number (0-100)' : ''
                                }
                            />
                            )}
                          </Grid>
                          <Grid item xs={1}>
                            <IconButton
                              onClick={() => handleRemoveCondition(index)}
                              size="small"
                              color="error"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Grid>
                        </Grid>
                      </ListItem>
                    ))}
                    {rule.trigger.conditions.length === 0 && (
                      <Typography variant="body2" color="textSecondary" sx={{ py: 2, textAlign: 'center' }}>
                        No conditions defined. Rule will trigger on every event.
                      </Typography>
                    )}
                  </List>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Actions */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Actions
                </Typography>
                <Button
                  startIcon={<AddIcon />}
                  onClick={handleAddAction}
                >
                  Add Action
                </Button>
              </Box>
              <List>
                {rule.actions.map((action, index) => (
                  <Card key={index} sx={{ mb: 2 }}>
                    <CardContent>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={11}>
                          <FormControl fullWidth>
                            <InputLabel>Action Type</InputLabel>
                            <Select
                              value={action.type}
                              label="Action Type"
                              onChange={(e) => handleUpdateAction(index, 'type', e.target.value)}
                            >
                              {actionTypes.map(type => (
                                <MenuItem key={type.value} value={type.value}>
                                  {type.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          {/* Additional parameters based on action type */}
                          {action.type === 'execute_script' && (
                            <Grid container spacing={2} sx={{ mt: 1 }}>
                              <Grid item xs={12}>
                                <FormControl fullWidth>
                                  <InputLabel>Script Name</InputLabel>
                                  <Select
                                    value={action.parameters.scriptName || ''}
                                    label="Script Name"
                                    onChange={(e) => handleUpdateAction(index, 'parameters', {
                                      ...action.parameters,
                                      scriptName: e.target.value
                                    })}
                                  >
                                    {availableScripts.map(script => (
                                      <MenuItem key={script.value} value={script.value}>
                                        {script.label}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </Grid>
                              <Grid item xs={12}>
                                <TextField
                                  fullWidth
                                  multiline
                                  rows={3}
                                  label="Script Parameters (JSON)"
                                  placeholder='{"targetDrive": "C:", "threshold": "10"}'
                                  value={action.parameters.scriptParams || ''}
                                  onChange={(e) => handleUpdateAction(index, 'parameters', {
                                    ...action.parameters,
                                    scriptParams: e.target.value
                                  })}
                                  helperText="Enter parameters as JSON object"
                                />
                              </Grid>
                              <Grid item xs={6}>
                                <TextField
                                  fullWidth
                                  type="number"
                                  label="Timeout (seconds)"
                                  value={action.parameters.timeout || 300}
                                  onChange={(e) => handleUpdateAction(index, 'parameters', {
                                    ...action.parameters,
                                    timeout: parseInt(e.target.value) || 300
                                  })}
                                />
                              </Grid>
                              <Grid item xs={6}>
                                <TextField
                                  fullWidth
                                  type="number"
                                  label="Max Retries"
                                  value={action.parameters.maxRetries || 2}
                                  onChange={(e) => handleUpdateAction(index, 'parameters', {
                                    ...action.parameters,
                                    maxRetries: parseInt(e.target.value) || 2
                                  })}
                                />
                              </Grid>
                              <Grid item xs={12}>
                                <FormControl fullWidth>
                                  <InputLabel>On Success</InputLabel>
                                  <Select
                                    value={action.parameters.onSuccess || 'update_ticket'}
                                    label="On Success"
                                    onChange={(e) => handleUpdateAction(index, 'parameters', {
                                      ...action.parameters,
                                      onSuccess: e.target.value
                                    })}
                                  >
                                    <MenuItem value="close_ticket">Close Ticket</MenuItem>
                                    <MenuItem value="update_ticket">Update Ticket</MenuItem>
                                    <MenuItem value="nothing">Do Nothing</MenuItem>
                                  </Select>
                                </FormControl>
                              </Grid>
                              <Grid item xs={12}>
                                <FormControl fullWidth>
                                  <InputLabel>On Failure</InputLabel>
                                  <Select
                                    value={action.parameters.onFailure || 'escalate'}
                                    label="On Failure"
                                    onChange={(e) => handleUpdateAction(index, 'parameters', {
                                      ...action.parameters,
                                      onFailure: e.target.value
                                    })}
                                  >
                                    <MenuItem value="escalate">Escalate to Technician</MenuItem>
                                    <MenuItem value="notify_teams">Send Teams Alert</MenuItem>
                                    <MenuItem value="update_ticket">Update Ticket Only</MenuItem>
                                    <MenuItem value="retry">Retry Script</MenuItem>
                                  </Select>
                                </FormControl>
                              </Grid>
                            </Grid>
                          )}
                          {action.type === 'update_ticket' && (
                            <Grid container spacing={2} sx={{ mt: 1 }}>
                              <Grid item xs={6}>
                                <TextField
                                  fullWidth
                                  label="New Status"
                                  value={action.parameters.status || ''}
                                  onChange={(e) => handleUpdateAction(index, 'parameters', {
                                    ...action.parameters,
                                    status: e.target.value
                                  })}
                                />
                              </Grid>
                              <Grid item xs={6}>
                                <TextField
                                  fullWidth
                                  label="New Priority"
                                  value={action.parameters.priority || ''}
                                  onChange={(e) => handleUpdateAction(index, 'parameters', {
                                    ...action.parameters,
                                    priority: e.target.value
                                  })}
                                />
                              </Grid>
                            </Grid>
                          )}
                          {action.type === 'close_ticket' && (
                            <Grid container spacing={2} sx={{ mt: 1 }}>
                              <Grid item xs={12}>
                                <TextField
                                  fullWidth
                                  multiline
                                  rows={2}
                                  label="Close Note"
                                  value={action.parameters.closeNote || 'Ticket resolved via automation'}
                                  onChange={(e) => handleUpdateAction(index, 'parameters', {
                                    ...action.parameters,
                                    closeNote: e.target.value
                                  })}
                                />
                              </Grid>
                            </Grid>
                          )}
                          {action.type === 'add_note' && (
                            <Grid container spacing={2} sx={{ mt: 1 }}>
                              <Grid item xs={12}>
                                <TextField
                                  fullWidth
                                  multiline
                                  rows={3}
                                  label="Note Text"
                                  value={action.parameters.noteText || ''}
                                  onChange={(e) => handleUpdateAction(index, 'parameters', {
                                    ...action.parameters,
                                    noteText: e.target.value
                                  })}
                                  helperText="Use {{variables}} for dynamic content: {{deviceName}}, {{alertType}}, {{timestamp}}"
                                />
                              </Grid>
                            </Grid>
                          )}
                          {action.type === 'escalate' && (
                            <Grid container spacing={2} sx={{ mt: 1 }}>
                              <Grid item xs={12}>
                                <TextField
                                  fullWidth
                                  label="Escalate To"
                                  value={action.parameters.escalateTo || 'Level 2 Support'}
                                  onChange={(e) => handleUpdateAction(index, 'parameters', {
                                    ...action.parameters,
                                    escalateTo: e.target.value
                                  })}
                                  helperText="Enter technician name or support level"
                                />
                              </Grid>
                              <Grid item xs={12}>
                                <FormControl fullWidth>
                                  <InputLabel>Priority</InputLabel>
                                  <Select
                                    value={action.parameters.priority || 'high'}
                                    label="Priority"
                                    onChange={(e) => handleUpdateAction(index, 'parameters', {
                                      ...action.parameters,
                                      priority: e.target.value
                                    })}
                                  >
                                    <MenuItem value="low">Low</MenuItem>
                                    <MenuItem value="medium">Medium</MenuItem>
                                    <MenuItem value="high">High</MenuItem>
                                    <MenuItem value="critical">Critical</MenuItem>
                                  </Select>
                                </FormControl>
                              </Grid>
                            </Grid>
                          )}
                          {action.type === 'send_teams_message' && (
                            <Grid container spacing={2} sx={{ mt: 1 }}>
                              <Grid item xs={12}>
                                <TextField
                                  fullWidth
                                  label="Message"
                                  multiline
                                  rows={2}
                                  value={action.parameters.message || ''}
                                  onChange={(e) => handleUpdateAction(index, 'parameters', {
                                    ...action.parameters,
                                    message: e.target.value
                                  })}
                                  helperText="Message to send to Teams channel"
                                />
                              </Grid>
                              <Grid item xs={12}>
                                <TextField
                                  fullWidth
                                  label="Mentions (comma-separated)"
                                  value={action.parameters.mentions || ''}
                                  onChange={(e) => handleUpdateAction(index, 'parameters', {
                                    ...action.parameters,
                                    mentions: e.target.value
                                  })}
                                  placeholder="@oncall-tech, @manager"
                                />
                              </Grid>
                            </Grid>
                          )}
                          {action.type === 'send_email' && (
                            <Grid container spacing={2} sx={{ mt: 1 }}>
                              <Grid item xs={12}>
                                <TextField
                                  fullWidth
                                  label="Recipients (comma-separated)"
                                  value={action.parameters.recipients || ''}
                                  onChange={(e) => handleUpdateAction(index, 'parameters', {
                                    ...action.parameters,
                                    recipients: e.target.value
                                  })}
                                />
                              </Grid>
                              <Grid item xs={12}>
                                <TextField
                                  fullWidth
                                  label="Subject"
                                  value={action.parameters.subject || ''}
                                  onChange={(e) => handleUpdateAction(index, 'parameters', {
                                    ...action.parameters,
                                    subject: e.target.value
                                  })}
                                />
                              </Grid>
                            </Grid>
                          )}
                        </Grid>
                        <Grid item xs={1}>
                          <IconButton
                            onClick={() => handleRemoveAction(index)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                ))}
                {rule.actions.length === 0 && (
                  <Typography variant="body2" color="textSecondary" sx={{ py: 2, textAlign: 'center' }}>
                    No actions defined. Add at least one action.
                  </Typography>
                )}
              </List>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};