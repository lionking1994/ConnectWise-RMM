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
  Tabs,
  Tab,
  Card,
  CardContent,
  CardActions,
  Tooltip,
  Alert,
  CircularProgress,
  FormControlLabel,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FileCopy as CloneIcon,
  PlayArrow as RunIcon,
  Code as CodeIcon,
  History as HistoryIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Security as SecurityIcon,
  Speed as PerformanceIcon,
  Build as MaintenanceIcon,
  Storage as DiskIcon,
  Dns as NetworkIcon,
  Settings as ServicesIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import axios from 'axios';
import { getApiUrl } from '../config/api';
import CodeEditor from '@uiw/react-textarea-code-editor';

interface Script {
  id: number;
  name: string;
  description: string;
  type: 'powershell' | 'batch' | 'bash' | 'python';
  category: string;
  content: string;
  parameters: Record<string, any>;
  isActive: boolean;
  isTemplate: boolean;
  version: string;
  tags: string[];
  timeoutSeconds: number;
  maxRetries: number;
  retryDelaySeconds: number;
  createdAt: string;
  updatedAt: string;
  executionHistory?: Array<{
    executedAt: string;
    deviceId: string;
    ticketId: number;
    success: boolean;
    output: string;
    duration: number;
  }>;
}

interface ScriptTemplate {
  name: string;
  description: string;
  type: string;
  category: string;
  content: string;
  parameters: Record<string, any>;
  tags: string[];
}

interface ExecutionHistory {
  id: number;
  script: Script;
  deviceId: string;
  ticketId?: number;
  executedBy: string;
  status: string;
  output?: string;
  errorMessage?: string;
  startTime: string;
  endTime?: string;
  duration?: number;
}

const categoryIcons: Record<string, React.ReactElement> = {
  security: <SecurityIcon />,
  performance: <PerformanceIcon />,
  maintenance: <MaintenanceIcon />,
  disk: <DiskIcon />,
  services: <ServicesIcon />,
  network: <NetworkIcon />,
  custom: <CodeIcon />,
};

export const ScriptManager: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [templates, setTemplates] = useState<ScriptTemplate[]>([]);
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [showInactive, setShowInactive] = useState(false);

  // Form state for script editor
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'powershell' as Script['type'],
    category: 'custom',
    content: '',
    parameters: {},
    tags: [] as string[],
    timeoutSeconds: 30,
    maxRetries: 3,
    retryDelaySeconds: 60,
    isActive: true,
  });

  // Execution dialog state
  const [executeDialogOpen, setExecuteDialogOpen] = useState(false);
  const [executionParams, setExecutionParams] = useState<Record<string, any>>({});
  const [targetDeviceId, setTargetDeviceId] = useState('');
  const [targetTicketId, setTargetTicketId] = useState('');

  useEffect(() => {
    fetchScripts();
    fetchTemplates();
    fetchExecutionHistory();
  }, [filterCategory, filterType, showInactive]);

  const fetchScripts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterCategory !== 'all') params.append('category', filterCategory);
      if (filterType !== 'all') params.append('type', filterType);
      if (!showInactive) params.append('isActive', 'true');

      const token = localStorage.getItem('token');
      const response = await axios.get(`${getApiUrl()}/api/scripts?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      // Ensure response.data is an array
      const scriptsData = Array.isArray(response.data) ? response.data : [];
      setScripts(scriptsData);
    } catch (error) {
      console.error('Failed to fetch scripts:', error);
      setScripts([]); // Set empty array on error
      // Use mock data for demonstration
      const mockScripts: Script[] = [
        {
          id: 1,
          name: 'Disk Cleanup',
          description: 'Cleans up disk space by removing temporary files',
          type: 'powershell',
          category: 'disk',
          content: '# Disk cleanup script',
          parameters: {},
          isActive: true,
          isTemplate: false,
          version: '1.0.0',
          tags: ['cleanup', 'disk', 'maintenance'],
          timeoutSeconds: 300,
          maxRetries: 2,
          retryDelaySeconds: 60,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 2,
          name: 'Service Restart',
          description: 'Restarts specified Windows services',
          type: 'powershell',
          category: 'services',
          content: '# Service restart script',
          parameters: { serviceName: '' },
          isActive: true,
          isTemplate: false,
          version: '1.0.0',
          tags: ['service', 'restart'],
          timeoutSeconds: 180,
          maxRetries: 3,
          retryDelaySeconds: 30,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      setScripts(mockScripts);
      enqueueSnackbar('Using demo scripts. Configure API to see real data.', { variant: 'info' });
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${getApiUrl()}/api/scripts/templates`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      // Ensure response.data is an array
      const templatesData = Array.isArray(response.data) ? response.data : [];
      setTemplates(templatesData);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      setTemplates([]); // Set empty array on error
      // Use mock templates
      const mockTemplates: ScriptTemplate[] = [
        {
          name: 'Disk Cleanup Advanced',
          description: 'Comprehensive disk cleanup with multiple strategies',
          type: 'powershell',
          category: 'disk',
          content: '# Advanced disk cleanup template',
          parameters: { threshold: 20 },
          tags: ['cleanup', 'disk', 'space']
        },
        {
          name: 'IIS Reset',
          description: 'Resets IIS and application pools',
          type: 'powershell',
          category: 'services',
          content: '# IIS reset template',
          parameters: {},
          tags: ['iis', 'web', 'reset']
        }
      ];
      setTemplates(mockTemplates);
    }
  };

  const fetchExecutionHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${getApiUrl()}/api/scripts/executions/history`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      // Ensure response.data is an array
      const historyData = Array.isArray(response.data) ? response.data : [];
      setExecutionHistory(historyData);
    } catch (error) {
      console.error('Failed to fetch execution history:', error);
      setExecutionHistory([]); // Set empty array on error
    }
  };

  const handleCreateFromTemplate = (template: ScriptTemplate) => {
    setFormData({
      ...template,
      type: template.type as any,
      timeoutSeconds: 30,
      maxRetries: 3,
      retryDelaySeconds: 60,
      isActive: true,
    });
    setEditMode(false);
    setDialogOpen(true);
  };

  const handleEditScript = (script: Script) => {
    setFormData({
      name: script.name,
      description: script.description || '',
      type: script.type,
      category: script.category,
      content: script.content,
      parameters: script.parameters,
      tags: script.tags,
      timeoutSeconds: script.timeoutSeconds,
      maxRetries: script.maxRetries,
      retryDelaySeconds: script.retryDelaySeconds,
      isActive: script.isActive,
    });
    setSelectedScript(script);
    setEditMode(true);
    setDialogOpen(true);
  };

  const handleSaveScript = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      if (editMode && selectedScript) {
        await axios.put(`${getApiUrl()}/api/scripts/${selectedScript.id}`, formData, { headers });
        enqueueSnackbar('Script updated successfully', { variant: 'success' });
      } else {
        await axios.post(`${getApiUrl()}/api/scripts`, formData, { headers });
        enqueueSnackbar('Script created successfully', { variant: 'success' });
      }
      setDialogOpen(false);
      fetchScripts();
    } catch (error) {
      enqueueSnackbar('Failed to save script', { variant: 'error' });
    }
  };

  const handleDeleteScript = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this script?')) {
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        await axios.delete(`${getApiUrl()}/api/scripts/${id}`, { headers });
        enqueueSnackbar('Script deleted successfully', { variant: 'success' });
        fetchScripts();
      } catch (error) {
        enqueueSnackbar('Failed to delete script', { variant: 'error' });
      }
    }
  };

  const handleCloneScript = async (script: Script) => {
    const name = prompt('Enter name for cloned script:', `${script.name} (Copy)`);
    if (name) {
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        await axios.post(`${getApiUrl()}/api/scripts/${script.id}/clone`, { name }, { headers });
        enqueueSnackbar('Script cloned successfully', { variant: 'success' });
        fetchScripts();
      } catch (error) {
        enqueueSnackbar('Failed to clone script', { variant: 'error' });
      }
    }
  };

  const handleExecuteScript = async () => {
    if (!selectedScript || !targetDeviceId) {
      enqueueSnackbar('Please select a device', { variant: 'error' });
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.post(`${getApiUrl()}/api/scripts/${selectedScript.id}/execute`, {
        deviceId: targetDeviceId,
        parameters: executionParams,
        ticketId: targetTicketId || undefined,
      }, { headers });

      if (response.data.status === 'success') {
        enqueueSnackbar('Script executed successfully', { variant: 'success' });
      } else {
        enqueueSnackbar('Script execution failed', { variant: 'error' });
      }
      
      setExecuteDialogOpen(false);
      fetchExecutionHistory();
    } catch (error) {
      enqueueSnackbar('Failed to execute script', { variant: 'error' });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <SuccessIcon color="success" />;
      case 'failure':
        return <ErrorIcon color="error" />;
      case 'running':
        return <CircularProgress size={20} />;
      default:
        return <WarningIcon color="warning" />;
    }
  };

  const renderScriptsTab = () => (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Category</InputLabel>
          <Select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            label="Category"
          >
            <MenuItem value="all">All Categories</MenuItem>
            <MenuItem value="security">Security</MenuItem>
            <MenuItem value="performance">Performance</MenuItem>
            <MenuItem value="maintenance">Maintenance</MenuItem>
            <MenuItem value="disk">Disk</MenuItem>
            <MenuItem value="services">Services</MenuItem>
            <MenuItem value="network">Network</MenuItem>
            <MenuItem value="custom">Custom</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            label="Type"
          >
            <MenuItem value="all">All Types</MenuItem>
            <MenuItem value="powershell">PowerShell</MenuItem>
            <MenuItem value="batch">Batch</MenuItem>
            <MenuItem value="bash">Bash</MenuItem>
            <MenuItem value="python">Python</MenuItem>
          </Select>
        </FormControl>

        <FormControlLabel
          control={
            <Switch
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
          }
          label="Show Inactive"
        />

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setFormData({
              name: '',
              description: '',
              type: 'powershell',
              category: 'custom',
              content: '',
              parameters: {},
              tags: [],
              timeoutSeconds: 30,
              maxRetries: 3,
              retryDelaySeconds: 60,
              isActive: true,
            });
            setEditMode(false);
            setDialogOpen(true);
          }}
          sx={{ ml: 'auto' }}
        >
          New Script
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Version</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last Updated</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(Array.isArray(scripts) ? scripts : []).map((script) => (
              <TableRow key={script.id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {categoryIcons[script.category] || <CodeIcon />}
                    <Typography variant="body2">{script.name}</Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip label={script.category} size="small" />
                </TableCell>
                <TableCell>
                  <Chip label={script.type} size="small" variant="outlined" />
                </TableCell>
                <TableCell>{script.version}</TableCell>
                <TableCell>
                  <Chip
                    label={script.isActive ? 'Active' : 'Inactive'}
                    color={script.isActive ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {new Date(script.updatedAt).toLocaleDateString()}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Execute">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setSelectedScript(script);
                        setExecutionParams({});
                        setTargetDeviceId('');
                        setTargetTicketId('');
                        setExecuteDialogOpen(true);
                      }}
                    >
                      <RunIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => handleEditScript(script)}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Clone">
                    <IconButton size="small" onClick={() => handleCloneScript(script)}>
                      <CloneIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteScript(script.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const renderTemplatesTab = () => (
    <Grid container spacing={2}>
            {(Array.isArray(templates) ? templates : []).map((template, index) => (
        <Grid item xs={12} md={6} lg={4} key={index}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                {categoryIcons[template.category] || <CodeIcon />}
                <Typography variant="h6">{template.name}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {template.description}
              </Typography>
              <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip label={template.category} size="small" />
                <Chip label={template.type} size="small" variant="outlined" />
                {template.tags.map((tag) => (
                  <Chip key={tag} label={tag} size="small" variant="outlined" />
                ))}
              </Box>
            </CardContent>
            <CardActions>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => handleCreateFromTemplate(template)}
              >
                Use Template
              </Button>
              <Button
                size="small"
                startIcon={<CodeIcon />}
                onClick={() => {
                  setFormData({
                    ...template,
                    type: template.type as any,
                    name: '',
                    timeoutSeconds: 30,
                    maxRetries: 3,
                    retryDelaySeconds: 60,
                    isActive: true,
                  });
                  setDialogOpen(true);
                }}
              >
                View Code
              </Button>
            </CardActions>
          </Card>
        </Grid>
      ))}
    </Grid>
  );

  const renderHistoryTab = () => (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Script</TableCell>
            <TableCell>Device</TableCell>
            <TableCell>Ticket</TableCell>
            <TableCell>Executed By</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Duration</TableCell>
            <TableCell>Start Time</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
            {(Array.isArray(executionHistory) ? executionHistory : []).map((execution) => (
            <TableRow key={execution.id}>
              <TableCell>{execution.script?.name}</TableCell>
              <TableCell>{execution.deviceId}</TableCell>
              <TableCell>{execution.ticketId || '-'}</TableCell>
              <TableCell>{execution.executedBy}</TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {getStatusIcon(execution.status)}
                  <Typography variant="body2">{execution.status}</Typography>
                </Box>
              </TableCell>
              <TableCell>
                {execution.duration ? `${(execution.duration / 1000).toFixed(2)}s` : '-'}
              </TableCell>
              <TableCell>
                {new Date(execution.startTime).toLocaleString()}
              </TableCell>
              <TableCell>
                <Tooltip title="View Output">
                  <IconButton
                    size="small"
                    onClick={() => {
                      alert(execution.output || execution.errorMessage || 'No output');
                    }}
                  >
                    <CodeIcon />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Script Management
      </Typography>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Scripts" icon={<CodeIcon />} />
          <Tab label="Templates" icon={<UploadIcon />} />
          <Tab label="Execution History" icon={<HistoryIcon />} />
        </Tabs>
      </Paper>

      <Box sx={{ mt: 2 }}>
        {loading ? (
          <CircularProgress />
        ) : (
          <>
            {tabValue === 0 && renderScriptsTab()}
            {tabValue === 1 && renderTemplatesTab()}
            {tabValue === 2 && renderHistoryTab()}
          </>
        )}
      </Box>

      {/* Script Editor Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          {editMode ? 'Edit Script' : 'Create Script'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as Script['type'] })}
                  label="Type"
                >
                  <MenuItem value="powershell">PowerShell</MenuItem>
                  <MenuItem value="batch">Batch</MenuItem>
                  <MenuItem value="bash">Bash</MenuItem>
                  <MenuItem value="python">Python</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  label="Category"
                >
                  <MenuItem value="security">Security</MenuItem>
                  <MenuItem value="performance">Performance</MenuItem>
                  <MenuItem value="maintenance">Maintenance</MenuItem>
                  <MenuItem value="disk">Disk</MenuItem>
                  <MenuItem value="services">Services</MenuItem>
                  <MenuItem value="network">Network</MenuItem>
                  <MenuItem value="custom">Custom</MenuItem>
                </Select>
              </FormControl>
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
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Script Content
              </Typography>
              <CodeEditor
                value={formData.content}
                language={formData.type === 'python' ? 'python' : 'powershell'}
                onChange={(evn) => setFormData({ ...formData, content: evn.target.value })}
                padding={15}
                style={{
                  fontSize: 12,
                  backgroundColor: '#f5f5f5',
                  fontFamily: 'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace',
                  minHeight: '300px',
                }}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Timeout (seconds)"
                type="number"
                value={formData.timeoutSeconds}
                onChange={(e) => setFormData({ ...formData, timeoutSeconds: Number(e.target.value) })}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Max Retries"
                type="number"
                value={formData.maxRetries}
                onChange={(e) => setFormData({ ...formData, maxRetries: Number(e.target.value) })}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Retry Delay (seconds)"
                type="number"
                value={formData.retryDelaySeconds}
                onChange={(e) => setFormData({ ...formData, retryDelaySeconds: Number(e.target.value) })}
              />
            </Grid>
            <Grid item xs={12}>
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
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveScript} variant="contained">
            {editMode ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Execute Script Dialog */}
      <Dialog open={executeDialogOpen} onClose={() => setExecuteDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Execute Script: {selectedScript?.name}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Device ID"
                value={targetDeviceId}
                onChange={(e) => setTargetDeviceId(e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Ticket ID (optional)"
                value={targetTicketId}
                onChange={(e) => setTargetTicketId(e.target.value)}
              />
            </Grid>
            {selectedScript?.parameters && Object.keys(selectedScript.parameters).length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Parameters
                </Typography>
                {Object.entries(selectedScript.parameters).map(([key, defaultValue]) => (
                  <TextField
                    key={key}
                    fullWidth
                    label={key}
                    value={executionParams[key] || defaultValue}
                    onChange={(e) => setExecutionParams({ ...executionParams, [key]: e.target.value })}
                    sx={{ mb: 2 }}
                  />
                ))}
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExecuteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleExecuteScript} variant="contained" startIcon={<RunIcon />}>
            Execute
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ScriptManager;
