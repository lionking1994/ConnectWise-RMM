import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Card,
  CardContent,
  Tooltip,
  Alert,
  CircularProgress,
  FormControlLabel,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Badge,
  ToggleButton,
  ToggleButtonGroup,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FileCopy as CloneIcon,
  PlayArrow as TestIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Notifications as NotificationIcon,
  Schedule as ScheduleIcon,
  TrendingUp as EscalateIcon,
  Code as ScriptIcon,
  Rule as RuleIcon,
  BugReport as DebugIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import axios from 'axios';

interface AlertCondition {
  field: string;
  operator: string;
  value: any;
}

interface AlertAction {
  type: string;
  order: number;
  parameters: Record<string, any>;
  continueOnError?: boolean;
}

interface AlertMapping {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  priority: number;
  conditions: {
    all?: AlertCondition[];
    any?: AlertCondition[];
  };
  actions: AlertAction[];
  primaryScript?: {
    id: number;
    name: string;
  };
  maxRetries: number;
  retryDelaySeconds: number;
  executionTimeoutSeconds: number;
  stopOnFirstSuccess: boolean;
  escalateAfterFailures?: number;
  notificationSettings?: {
    onSuccess?: boolean;
    onFailure?: boolean;
    onEscalation?: boolean;
  };
  executionCount: number;
  successCount: number;
  failureCount: number;
  lastExecutedAt?: string;
  lastExecutionStatus?: string;
}

interface Script {
  id: number;
  name: string;
  type: string;
  category: string;
}

const FIELD_OPTIONS = [
  { value: 'type', label: 'Alert Type' },
  { value: 'severity', label: 'Severity' },
  { value: 'deviceName', label: 'Device Name' },
  { value: 'deviceId', label: 'Device ID' },
  { value: 'message', label: 'Message' },
  { value: 'metadata.category', label: 'Category' },
];

const OPERATOR_OPTIONS = [
  { value: 'equals', label: 'Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'starts_with', label: 'Starts With' },
  { value: 'ends_with', label: 'Ends With' },
  { value: 'regex', label: 'Regex Match' },
  { value: 'in', label: 'In List' },
  { value: 'not_in', label: 'Not In List' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
];

const ACTION_TYPES = [
  { value: 'run_script', label: 'Run Script', icon: <ScriptIcon /> },
  { value: 'update_ticket', label: 'Update Ticket', icon: <EditIcon /> },
  { value: 'send_notification', label: 'Send Notification', icon: <NotificationIcon /> },
  { value: 'escalate', label: 'Escalate', icon: <EscalateIcon /> },
  { value: 'close_ticket', label: 'Close Ticket', icon: <SuccessIcon /> },
];

export const AlertScriptMapping: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [mappings, setMappings] = useState<AlertMapping[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [selectedMapping, setSelectedMapping] = useState<AlertMapping | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testAlertData, setTestAlertData] = useState({
    type: '',
    severity: 'warning',
    deviceId: '',
    deviceName: '',
    message: '',
  });

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true,
    priority: 0,
    conditions: {
      all: [] as AlertCondition[],
      any: [] as AlertCondition[],
    },
    actions: [] as AlertAction[],
    primaryScriptId: undefined as number | undefined,
    maxRetries: 3,
    retryDelaySeconds: 60,
    executionTimeoutSeconds: 300,
    stopOnFirstSuccess: false,
    escalateAfterFailures: undefined as number | undefined,
    notificationSettings: {
      onSuccess: false,
      onFailure: true,
      onEscalation: true,
    },
  });

  useEffect(() => {
    fetchMappings();
    fetchScripts();
  }, []);

  const fetchMappings = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/alert-mappings');
      setMappings(response.data);
    } catch (error) {
      enqueueSnackbar('Failed to fetch alert mappings', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchScripts = async () => {
    try {
      const response = await axios.get('/api/scripts');
      setScripts(response.data);
    } catch (error) {
      console.error('Failed to fetch scripts');
    }
  };

  const handleCreateMapping = () => {
    setFormData({
      name: '',
      description: '',
      isActive: true,
      priority: 0,
      conditions: {
        all: [],
        any: [],
      },
      actions: [],
      primaryScriptId: undefined,
      maxRetries: 3,
      retryDelaySeconds: 60,
      executionTimeoutSeconds: 300,
      stopOnFirstSuccess: false,
      escalateAfterFailures: undefined,
      notificationSettings: {
        onSuccess: false,
        onFailure: true,
        onEscalation: true,
      },
    });
    setEditMode(false);
    setActiveStep(0);
    setDialogOpen(true);
  };

  const handleEditMapping = (mapping: AlertMapping) => {
    setFormData({
      name: mapping.name,
      description: mapping.description || '',
      isActive: mapping.isActive,
      priority: mapping.priority,
      conditions: {
        all: mapping.conditions?.all || [],
        any: mapping.conditions?.any || []
      },
      actions: mapping.actions,
      primaryScriptId: mapping.primaryScript?.id,
      maxRetries: mapping.maxRetries,
      retryDelaySeconds: mapping.retryDelaySeconds,
      executionTimeoutSeconds: mapping.executionTimeoutSeconds,
      stopOnFirstSuccess: mapping.stopOnFirstSuccess,
      escalateAfterFailures: mapping.escalateAfterFailures,
      notificationSettings: {
        onSuccess: mapping.notificationSettings?.onSuccess || false,
        onFailure: mapping.notificationSettings?.onFailure !== undefined ? mapping.notificationSettings.onFailure : true,
        onEscalation: mapping.notificationSettings?.onEscalation !== undefined ? mapping.notificationSettings.onEscalation : true,
      },
    });
    setSelectedMapping(mapping);
    setEditMode(true);
    setActiveStep(0);
    setDialogOpen(true);
  };

  const handleSaveMapping = async () => {
    try {
      if (editMode && selectedMapping) {
        await axios.put(`/api/alert-mappings/${selectedMapping.id}`, formData);
        enqueueSnackbar('Mapping updated successfully', { variant: 'success' });
      } else {
        await axios.post('/api/alert-mappings', formData);
        enqueueSnackbar('Mapping created successfully', { variant: 'success' });
      }
      setDialogOpen(false);
      fetchMappings();
    } catch (error) {
      enqueueSnackbar('Failed to save mapping', { variant: 'error' });
    }
  };

  const handleDeleteMapping = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this mapping?')) {
      try {
        await axios.delete(`/api/alert-mappings/${id}`);
        enqueueSnackbar('Mapping deleted successfully', { variant: 'success' });
        fetchMappings();
      } catch (error) {
        enqueueSnackbar('Failed to delete mapping', { variant: 'error' });
      }
    }
  };

  const handleCloneMapping = async (mapping: AlertMapping) => {
    const name = prompt('Enter name for cloned mapping:', `${mapping.name} (Copy)`);
    if (name) {
      try {
        await axios.post(`/api/alert-mappings/${mapping.id}/clone`, { name });
        enqueueSnackbar('Mapping cloned successfully', { variant: 'success' });
        fetchMappings();
      } catch (error) {
        enqueueSnackbar('Failed to clone mapping', { variant: 'error' });
      }
    }
  };

  const handleTestMapping = async () => {
    if (!selectedMapping) return;

    try {
      const response = await axios.post(`/api/alert-mappings/${selectedMapping.id}/test`, testAlertData);
      
      if (response.data.matches) {
        enqueueSnackbar('Alert matches mapping conditions!', { variant: 'success' });
      } else {
        enqueueSnackbar('Alert does not match mapping conditions', { variant: 'warning' });
      }
      
      setTestDialogOpen(false);
    } catch (error) {
      enqueueSnackbar('Failed to test mapping', { variant: 'error' });
    }
  };

  const addCondition = (type: 'all' | 'any') => {
    const newCondition: AlertCondition = {
      field: 'type',
      operator: 'equals',
      value: '',
    };

    setFormData({
      ...formData,
      conditions: {
        ...formData.conditions,
        [type]: [...(formData.conditions[type] || []), newCondition],
      },
    });
  };

  const updateCondition = (type: 'all' | 'any', index: number, updates: Partial<AlertCondition>) => {
    const conditions = [...(formData.conditions[type] || [])];
    conditions[index] = { ...conditions[index], ...updates };
    
    setFormData({
      ...formData,
      conditions: {
        ...formData.conditions,
        [type]: conditions,
      },
    });
  };

  const removeCondition = (type: 'all' | 'any', index: number) => {
    const conditions = [...(formData.conditions[type] || [])];
    conditions.splice(index, 1);
    
    setFormData({
      ...formData,
      conditions: {
        ...formData.conditions,
        [type]: conditions,
      },
    });
  };

  const addAction = () => {
    const newAction: AlertAction = {
      type: 'run_script',
      order: formData.actions.length,
      parameters: {},
      continueOnError: false,
    };

    setFormData({
      ...formData,
      actions: [...formData.actions, newAction],
    });
  };

  const updateAction = (index: number, updates: Partial<AlertAction>) => {
    const actions = [...formData.actions];
    actions[index] = { ...actions[index], ...updates };
    setFormData({ ...formData, actions });
  };

  const removeAction = (index: number) => {
    const actions = [...formData.actions];
    actions.splice(index, 1);
    // Reorder remaining actions
    actions.forEach((action, idx) => {
      action.order = idx;
    });
    setFormData({ ...formData, actions });
  };

  const getSuccessRate = (mapping: AlertMapping) => {
    if (mapping.executionCount === 0) return 0;
    return Math.round((mapping.successCount / mapping.executionCount) * 100);
  };

  const renderConditionsStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Define Alert Conditions
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        Configure conditions to match specific alerts. Use "ALL" for AND logic, "ANY" for OR logic.
      </Alert>

      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>ALL Conditions (AND)</Typography>
          <Chip
            label={formData.conditions.all?.length || 0}
            size="small"
            sx={{ ml: 2 }}
          />
        </AccordionSummary>
        <AccordionDetails>
          <List>
            {formData.conditions.all?.map((condition, index) => (
              <ListItem key={index}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={3}>
                    <FormControl fullWidth size="small">
                      <Select
                        value={condition.field}
                        onChange={(e) => updateCondition('all', index, { field: e.target.value })}
                      >
                        {FIELD_OPTIONS.map(opt => (
                          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={3}>
                    <FormControl fullWidth size="small">
                      <Select
                        value={condition.operator}
                        onChange={(e) => updateCondition('all', index, { operator: e.target.value })}
                      >
                        {OPERATOR_OPTIONS.map(opt => (
                          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      size="small"
                      value={condition.value}
                      onChange={(e) => updateCondition('all', index, { value: e.target.value })}
                      placeholder="Value"
                    />
                  </Grid>
                  <Grid item xs={2}>
                    <IconButton onClick={() => removeCondition('all', index)}>
                      <DeleteIcon />
                    </IconButton>
                  </Grid>
                </Grid>
              </ListItem>
            ))}
          </List>
          <Button
            startIcon={<AddIcon />}
            onClick={() => addCondition('all')}
            variant="outlined"
            size="small"
          >
            Add Condition
          </Button>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>ANY Conditions (OR)</Typography>
          <Chip
            label={formData.conditions.any?.length || 0}
            size="small"
            sx={{ ml: 2 }}
          />
        </AccordionSummary>
        <AccordionDetails>
          <List>
            {formData.conditions.any?.map((condition, index) => (
              <ListItem key={index}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={3}>
                    <FormControl fullWidth size="small">
                      <Select
                        value={condition.field}
                        onChange={(e) => updateCondition('any', index, { field: e.target.value })}
                      >
                        {FIELD_OPTIONS.map(opt => (
                          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={3}>
                    <FormControl fullWidth size="small">
                      <Select
                        value={condition.operator}
                        onChange={(e) => updateCondition('any', index, { operator: e.target.value })}
                      >
                        {OPERATOR_OPTIONS.map(opt => (
                          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      size="small"
                      value={condition.value}
                      onChange={(e) => updateCondition('any', index, { value: e.target.value })}
                      placeholder="Value"
                    />
                  </Grid>
                  <Grid item xs={2}>
                    <IconButton onClick={() => removeCondition('any', index)}>
                      <DeleteIcon />
                    </IconButton>
                  </Grid>
                </Grid>
              </ListItem>
            ))}
          </List>
          <Button
            startIcon={<AddIcon />}
            onClick={() => addCondition('any')}
            variant="outlined"
            size="small"
          >
            Add Condition
          </Button>
        </AccordionDetails>
      </Accordion>
    </Box>
  );

  const renderActionsStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Configure Actions
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        Define actions to execute when alert conditions match. Actions run in order.
      </Alert>

      <List>
        {formData.actions.map((action, index) => {
          const actionType = ACTION_TYPES.find(t => t.value === action.type);
          return (
            <Card key={index} sx={{ mb: 2 }}>
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      {actionType?.icon}
                      <FormControl sx={{ ml: 2, minWidth: 200 }}>
                        <InputLabel>Action Type</InputLabel>
                        <Select
                          value={action.type}
                          onChange={(e) => updateAction(index, { type: e.target.value })}
                          label="Action Type"
                        >
                          {ACTION_TYPES.map(type => (
                            <MenuItem key={type.value} value={type.value}>
                              {type.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={action.continueOnError}
                            onChange={(e) => updateAction(index, { continueOnError: e.target.checked })}
                          />
                        }
                        label="Continue on Error"
                        sx={{ ml: 'auto' }}
                      />
                      <IconButton onClick={() => removeAction(index)}>
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Grid>

                  {action.type === 'run_script' && (
                    <Grid item xs={12}>
                      <FormControl fullWidth>
                        <InputLabel>Script</InputLabel>
                        <Select
                          value={action.parameters.scriptId || ''}
                          onChange={(e) => updateAction(index, {
                            parameters: { ...action.parameters, scriptId: e.target.value }
                          })}
                          label="Script"
                        >
                          {scripts.map(script => (
                            <MenuItem key={script.id} value={script.id}>
                              {script.name} ({script.type})
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  )}

                  {action.type === 'update_ticket' && (
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Note Template"
                        value={action.parameters.noteTemplate || ''}
                        onChange={(e) => updateAction(index, {
                          parameters: { ...action.parameters, noteTemplate: e.target.value }
                        })}
                        helperText="Use {{alertType}}, {{deviceName}}, {{severity}} as variables"
                      />
                    </Grid>
                  )}

                  {action.type === 'send_notification' && (
                    <>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="Notification Title"
                          value={action.parameters.title || ''}
                          onChange={(e) => updateAction(index, {
                            parameters: { ...action.parameters, title: e.target.value }
                          })}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <FormControl fullWidth>
                          <InputLabel>Priority</InputLabel>
                          <Select
                            value={action.parameters.priority || 'medium'}
                            onChange={(e) => updateAction(index, {
                              parameters: { ...action.parameters, priority: e.target.value }
                            })}
                            label="Priority"
                          >
                            <MenuItem value="low">Low</MenuItem>
                            <MenuItem value="medium">Medium</MenuItem>
                            <MenuItem value="high">High</MenuItem>
                            <MenuItem value="critical">Critical</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                    </>
                  )}
                </Grid>
              </CardContent>
            </Card>
          );
        })}
      </List>

      <Button
        startIcon={<AddIcon />}
        onClick={addAction}
        variant="contained"
      >
        Add Action
      </Button>
    </Box>
  );

  const renderSettingsStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Execution Settings
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                Primary Script
              </Typography>
              <FormControl fullWidth>
                <InputLabel>Default Script</InputLabel>
                <Select
                  value={formData.primaryScriptId || ''}
                  onChange={(e) => setFormData({ ...formData, primaryScriptId: Number(e.target.value) })}
                  label="Default Script"
                >
                  <MenuItem value="">None</MenuItem>
                  {scripts.map(script => (
                    <MenuItem key={script.id} value={script.id}>
                      {script.name} ({script.category})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                Retry Configuration
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Max Retries"
                    type="number"
                    value={formData.maxRetries}
                    onChange={(e) => setFormData({ ...formData, maxRetries: Number(e.target.value) })}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Retry Delay (seconds)"
                    type="number"
                    value={formData.retryDelaySeconds}
                    onChange={(e) => setFormData({ ...formData, retryDelaySeconds: Number(e.target.value) })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Execution Timeout (seconds)"
                    type="number"
                    value={formData.executionTimeoutSeconds}
                    onChange={(e) => setFormData({ ...formData, executionTimeoutSeconds: Number(e.target.value) })}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                Escalation
              </Typography>
              <TextField
                fullWidth
                label="Escalate After Failures"
                type="number"
                value={formData.escalateAfterFailures || ''}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  escalateAfterFailures: e.target.value ? Number(e.target.value) : undefined 
                })}
                helperText="Leave empty to disable escalation"
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                Notification Settings
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.notificationSettings.onSuccess}
                    onChange={(e) => setFormData({
                      ...formData,
                      notificationSettings: {
                        ...formData.notificationSettings,
                        onSuccess: e.target.checked,
                      },
                    })}
                  />
                }
                label="Notify on Success"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.notificationSettings.onFailure}
                    onChange={(e) => setFormData({
                      ...formData,
                      notificationSettings: {
                        ...formData.notificationSettings,
                        onFailure: e.target.checked,
                      },
                    })}
                  />
                }
                label="Notify on Failure"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.notificationSettings.onEscalation}
                    onChange={(e) => setFormData({
                      ...formData,
                      notificationSettings: {
                        ...formData.notificationSettings,
                        onEscalation: e.target.checked,
                      },
                    })}
                  />
                }
                label="Notify on Escalation"
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.stopOnFirstSuccess}
                onChange={(e) => setFormData({ ...formData, stopOnFirstSuccess: e.target.checked })}
              />
            }
            label="Stop processing other rules if this one succeeds"
          />
        </Grid>
      </Grid>
    </Box>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">
          Alert-to-Script Mapping
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateMapping}
        >
          Create Mapping
        </Button>
      </Box>

      {loading ? (
        <CircularProgress />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Conditions</TableCell>
                <TableCell>Actions</TableCell>
                <TableCell>Success Rate</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Executed</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mappings.map((mapping) => (
                <TableRow key={mapping.id}>
                  <TableCell>
                    <Typography variant="body2">{mapping.name}</Typography>
                    {mapping.description && (
                      <Typography variant="caption" color="text.secondary">
                        {mapping.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip label={mapping.priority} size="small" />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {mapping.conditions.all && mapping.conditions.all.length > 0 && (
                        <Chip label={`ALL: ${mapping.conditions.all.length}`} size="small" />
                      )}
                      {mapping.conditions.any && mapping.conditions.any.length > 0 && (
                        <Chip label={`ANY: ${mapping.conditions.any.length}`} size="small" variant="outlined" />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {mapping.actions.slice(0, 3).map((action, idx) => {
                        const actionType = ACTION_TYPES.find(t => t.value === action.type);
                        return (
                          <Tooltip key={idx} title={actionType?.label || action.type}>
                            {actionType?.icon || <RuleIcon />}
                          </Tooltip>
                        );
                      })}
                      {mapping.actions.length > 3 && (
                        <Chip label={`+${mapping.actions.length - 3}`} size="small" />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {mapping.executionCount > 0 ? (
                        <>
                          <CircularProgress
                            variant="determinate"
                            value={getSuccessRate(mapping)}
                            size={30}
                            thickness={4}
                            color={getSuccessRate(mapping) > 70 ? 'success' : 'warning'}
                          />
                          <Typography variant="body2">
                            {getSuccessRate(mapping)}%
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No executions
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={mapping.isActive ? 'Active' : 'Inactive'}
                      color={mapping.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {mapping.lastExecutedAt ? (
                      <Box>
                        <Typography variant="caption">
                          {new Date(mapping.lastExecutedAt).toLocaleString()}
                        </Typography>
                        {mapping.lastExecutionStatus && (
                          <Chip
                            label={mapping.lastExecutionStatus}
                            size="small"
                            color={mapping.lastExecutionStatus === 'success' ? 'success' : 'error'}
                            sx={{ ml: 1 }}
                          />
                        )}
                      </Box>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Test">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedMapping(mapping);
                          setTestDialogOpen(true);
                        }}
                      >
                        <TestIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => handleEditMapping(mapping)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Clone">
                      <IconButton size="small" onClick={() => handleCloneMapping(mapping)}>
                        <CloneIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => handleDeleteMapping(mapping.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          {editMode ? 'Edit Mapping' : 'Create Alert Mapping'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Priority"
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })}
                  helperText="Higher priority executes first"
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                  }
                  label="Active"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  multiline
                  rows={2}
                />
              </Grid>
            </Grid>

            <Stepper activeStep={activeStep} orientation="vertical">
              <Step>
                <StepLabel>Conditions</StepLabel>
                <StepContent>
                  {renderConditionsStep()}
                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="contained"
                      onClick={() => setActiveStep(1)}
                      sx={{ mr: 1 }}
                    >
                      Continue
                    </Button>
                  </Box>
                </StepContent>
              </Step>

              <Step>
                <StepLabel>Actions</StepLabel>
                <StepContent>
                  {renderActionsStep()}
                  <Box sx={{ mt: 2 }}>
                    <Button onClick={() => setActiveStep(0)} sx={{ mr: 1 }}>
                      Back
                    </Button>
                    <Button
                      variant="contained"
                      onClick={() => setActiveStep(2)}
                      sx={{ mr: 1 }}
                    >
                      Continue
                    </Button>
                  </Box>
                </StepContent>
              </Step>

              <Step>
                <StepLabel>Settings</StepLabel>
                <StepContent>
                  {renderSettingsStep()}
                  <Box sx={{ mt: 2 }}>
                    <Button onClick={() => setActiveStep(1)} sx={{ mr: 1 }}>
                      Back
                    </Button>
                  </Box>
                </StepContent>
              </Step>
            </Stepper>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveMapping} variant="contained">
            {editMode ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Test Dialog */}
      <Dialog open={testDialogOpen} onClose={() => setTestDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Test Mapping: {selectedMapping?.name}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Enter sample alert data to test if it matches the mapping conditions
          </Alert>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Alert Type"
                value={testAlertData.type}
                onChange={(e) => setTestAlertData({ ...testAlertData, type: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Severity</InputLabel>
                <Select
                  value={testAlertData.severity}
                  onChange={(e) => setTestAlertData({ ...testAlertData, severity: e.target.value })}
                  label="Severity"
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="warning">Warning</MenuItem>
                  <MenuItem value="error">Error</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Device ID"
                value={testAlertData.deviceId}
                onChange={(e) => setTestAlertData({ ...testAlertData, deviceId: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Device Name"
                value={testAlertData.deviceName}
                onChange={(e) => setTestAlertData({ ...testAlertData, deviceName: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Message"
                value={testAlertData.message}
                onChange={(e) => setTestAlertData({ ...testAlertData, message: e.target.value })}
                multiline
                rows={3}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleTestMapping} variant="contained" startIcon={<TestIcon />}>
            Test Mapping
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
