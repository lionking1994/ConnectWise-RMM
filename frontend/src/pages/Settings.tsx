import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  FormGroup,
  Checkbox,
  Divider,
  Grid,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  CircularProgress,
  InputAdornment
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Security as SecurityIcon,
  Notifications as NotificationsIcon,
  Api as ApiIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import axios from 'axios';
import { getApiUrl } from '../config/api';

interface Settings {
  general: {
    companyName: string;
    clientId: string;
    timezone: string;
    dateFormat: string;
    language: string;
  };
  notifications: {
    teamsEnabled: boolean;
    teamsWebhookUrl?: string;
    teamsChannel?: string;
    teamsAlertTypes?: string[];
    teamsEscalationMentions?: string[];
  };
  automation: {
    enabled: boolean;
    maxRetries: number;
    retryDelay: number;
    defaultTimeout: number;
    requireApproval: boolean;
  };
  api: {
    connectwiseUrl: string;
    connectwiseCompanyId: string;
    connectwisePublicKey: string;
    connectwisePrivateKey: string;
    connectwiseClientId?: string;
    nableUrl: string;
    nableAccessKey: string;
    rateLimitPerMinute: number;
    timeout: number;
  };
  maintenance: {
    window: {
      start: string;
      end: string;
      days: string[];
    };
    autoUpdate: boolean;
  };
}

interface TestResult {
  service: string;
  status: 'idle' | 'testing' | 'success' | 'error';
  message?: string;
}

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [activeSection, setActiveSection] = useState('api');
  const [newEmail, setNewEmail] = useState('');
  const [showApiKeys, setShowApiKeys] = useState({
    connectwisePrivate: false
  });
  const [testResults, setTestResults] = useState<TestResult[]>([
    { service: 'ConnectWise', status: 'idle' },
    { service: 'N-able', status: 'idle' }
  ]);
  
  // Add missing testingConnections state
  const [testingConnections, setTestingConnections] = useState({
    'ConnectWise': false,
    'N-able': false
  });
  
  // Debug: Log whenever testResults changes
  React.useEffect(() => {
    console.log('[DEBUG useEffect] testResults updated:', testResults);
    console.log('[DEBUG useEffect] ConnectWise status:', testResults[0]?.status, 'message:', testResults[0]?.message);
    console.log('[DEBUG useEffect] N-able status:', testResults[1]?.status, 'message:', testResults[1]?.message);
    
    // Check if we're stuck in testing state
    if (testResults[1]?.status === 'testing') {
      console.warn('[DEBUG WARNING] N-able is stuck in testing state!');
    }
  }, [testResults]);
  
  // Debug: Log whenever testingConnections changes
  React.useEffect(() => {
    console.log('[DEBUG useEffect] testingConnections updated:', testingConnections);
  }, [testingConnections]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${getApiUrl()}/api/settings`);
      const data = response.data;
      
      // Transform the new backend response format to the expected frontend format
      const transformedData: Settings = {
        api: {
          connectwiseUrl: data.connectwise?.credentials?.apiUrl || '',
          connectwiseCompanyId: data.connectwise?.credentials?.companyId || '',
          connectwisePublicKey: data.connectwise?.credentials?.publicKey || '',
          connectwisePrivateKey: data.connectwise?.credentials?.privateKey || '',
          nableUrl: data.nable?.credentials?.apiUrl || '',
          nableAccessKey: data.nable?.credentials?.apiKey || '',
          rateLimitPerMinute: 60,
          timeout: 30000
        },
        general: {
          companyName: data.general?.companyName || 'Your Company',
          clientId: data.general?.clientId || 'RMM-CLIENT-001',
          timezone: data.general?.timezone || 'UTC',
          dateFormat: data.general?.dateFormat || 'MM/DD/YYYY',
          language: data.general?.language || 'en'
        },
        notifications: {
          teamsEnabled: data.notifications?.teamsEnabled || false,
          teamsWebhookUrl: data.notifications?.teamsWebhookUrl || '',
          teamsChannel: data.notifications?.teamsChannel || 'Network Operations Center',
          teamsAlertTypes: data.notifications?.teamsAlertTypes || ['Critical Alerts', 'Escalations'],
          teamsEscalationMentions: data.notifications?.teamsEscalationMentions || []
        },
        automation: {
          enabled: data.automation?.enabled || true,
          maxRetries: data.automation?.maxRetries || 3,
          retryDelay: data.automation?.retryDelay || 5000,
          defaultTimeout: data.automation?.defaultTimeout || 30000,
          requireApproval: data.automation?.requireApproval || false
        },
        maintenance: data.maintenance || {
          autoBackup: true,
          backupInterval: 24,
          logRetention: 30
        },
        // Store the original connectwise and nable objects for updates
        _connectwise: data.connectwise,
        _nable: data.nable
      } as any;
      
      setSettings(transformedData);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      // Transform the frontend format back to the backend format
      const dataToSend = {
        connectwise: {
          apiUrl: settings?.api.connectwiseUrl,
          companyId: settings?.api.connectwiseCompanyId,
          publicKey: settings?.api.connectwisePublicKey,
          privateKey: settings?.api.connectwisePrivateKey,
          isActive: (settings as any)?._connectwise?.isActive || false
        },
        nable: {
          apiUrl: settings?.api.nableUrl,
          apiKey: settings?.api.nableAccessKey,
          isActive: (settings as any)?._nable?.isActive || false
        },
        general: settings?.general,
        notifications: settings?.notifications
      };
      
      await axios.put(`${getApiUrl()}/api/settings`, dataToSend);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleTestConnection = async (service: 'ConnectWise' | 'N-able') => {
    console.log(`[DEBUG] Starting test for ${service}`);
    console.log('[DEBUG] Current testResults:', testResults);
    
    if (!settings) return;

    const testIndex = service === 'ConnectWise' ? 0 : 1;
    const newResults = [...testResults];
    newResults[testIndex] = { service, status: 'testing' };
    
    console.log('[DEBUG] Setting status to testing:', newResults);
    setTestResults(newResults);
    
    // CRITICAL: Set testingConnections to true
    console.log('[DEBUG] Setting testingConnections to true for', service);
    setTestingConnections(prev => ({ ...prev, [service]: true }));
    
    // Add a small delay to ensure state update
    await new Promise(resolve => setTimeout(resolve, 10));

    try {
      let response;
      
      if (service === 'ConnectWise') {
        if (!settings.api.connectwiseCompanyId || !settings.api.connectwisePublicKey || !settings.api.connectwisePrivateKey) {
          throw new Error('Missing required ConnectWise credentials');
        }
        
        response = await axios.post(`${getApiUrl()}/api/settings/test-connection/connectwise`, {
          companyId: settings.api.connectwiseCompanyId,
          publicKey: settings.api.connectwisePublicKey,
          privateKey: settings.api.connectwisePrivateKey,
          url: settings.api.connectwiseUrl,
          clientId: settings.api.connectwiseClientId
        }, {
          timeout: 15000 // 15 second timeout
        });
      } else {
        if (!settings.api.nableAccessKey) {
          throw new Error('Missing required N-able access key');
        }
        
        console.log('[DEBUG] Sending N-able test request with:', {
          accessKey: settings.api.nableAccessKey?.substring(0, 10) + '...',
          url: settings.api.nableUrl
        });
        
        response = await axios.post(`${getApiUrl()}/api/settings/test-connection/nable`, {
          accessKey: settings.api.nableAccessKey,
          url: settings.api.nableUrl
        }, {
          timeout: 15000 // 15 second timeout
        });
        
        console.log('[DEBUG] N-able test response received:', response.data);
      }

      console.log('[DEBUG] Response success flag:', response.data.success);

      if (response.data.success) {
        console.log('[DEBUG] Test successful, updating status to success');
        newResults[testIndex] = { 
          service, 
          status: 'success', 
          message: response.data.message || 'Connection successful'
        };
      } else {
        console.log('[DEBUG] Test failed (success=false), updating status to error');
        newResults[testIndex] = { 
          service, 
          status: 'error', 
          message: response.data.message || 'Connection failed'
        };
      }
      
      console.log('[DEBUG] newResults before finally:', newResults);
      
    } catch (error: any) {
      console.log('[DEBUG] Test error caught:', error);
      newResults[testIndex] = { 
        service, 
        status: 'error', 
        message: error.response?.data?.message || error.message || `Failed to connect to ${service}` 
      };
      console.log('[DEBUG] newResults after error:', newResults);
      
    } finally {
      console.log('[DEBUG] Finally block - current testIndex:', testIndex);
      console.log('[DEBUG] Finally block - newResults[testIndex]:', newResults[testIndex]);
      
      // Stop spinning regardless of success or failure  
      setTestingConnections(prev => {
        console.log('[DEBUG] Updating testingConnections from:', prev);
        const updated = { ...prev, [service]: false };
        console.log('[DEBUG] Updating testingConnections to:', updated);
        return updated;
      });
      
      // Ensure we're not stuck in 'testing' status
      if (newResults[testIndex].status === 'testing') {
        console.log('[DEBUG] Status still testing, resetting to idle');
        newResults[testIndex].status = 'idle';
      }
      
      // Update the results immediately
      console.log('[DEBUG] Final newResults to set:', newResults);
      setTestResults([...newResults]);
      
      // Force a re-render by updating a timestamp
      console.log('[DEBUG] Forcing component update');
    }

    // Don't need this anymore as it's in the finally block
    // setTestResults(newResults);
  };

  // Helper function handled inline for Teams mentions

  if (loading || !settings) {
    return <Typography>Loading settings...</Typography>;
  }

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          System Settings
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {saveStatus === 'saved' && (
            <Alert severity="success" sx={{ alignItems: 'center' }}>
              Settings saved successfully!
            </Alert>
          )}
          {saveStatus === 'error' && (
            <Alert severity="error" sx={{ alignItems: 'center' }}>
              Error saving settings
            </Alert>
          )}
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchSettings}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Configuration Sections
            </Typography>
            <List>
              {[
                { id: 'api', label: 'API Credentials', icon: <ApiIcon /> },
                { id: 'general', label: 'General', icon: <SecurityIcon /> },
                { id: 'notifications', label: 'Notifications', icon: <NotificationsIcon /> },
                { id: 'automation', label: 'Automation', icon: <ScheduleIcon /> }
              ].map(section => (
                <ListItem
                  key={section.id}
                  button
                  selected={activeSection === section.id}
                  onClick={() => setActiveSection(section.id)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {section.icon}
                    <ListItemText primary={section.label} />
                  </Box>
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        <Grid item xs={9}>
          <Paper sx={{ p: 3 }}>
            {activeSection === 'api' && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  API Credentials & Connection
                </Typography>
                
                {/* ConnectWise Configuration */}
                <Box sx={{ mb: 4 }}>
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
                    ConnectWise PSA Configuration
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="ConnectWise API URL"
                        value={settings.api.connectwiseUrl}
                        onChange={(e) => setSettings({
                          ...settings,
                          api: { ...settings.api, connectwiseUrl: e.target.value }
                        })}
                        helperText="Example: https://api-na.myconnectwise.net"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Company ID"
                        value={settings.api.connectwiseCompanyId || ''}
                        onChange={(e) => setSettings({
                          ...settings,
                          api: { ...settings.api, connectwiseCompanyId: e.target.value }
                        })}
                        required
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Public Key"
                        value={settings.api.connectwisePublicKey || ''}
                        onChange={(e) => setSettings({
                          ...settings,
                          api: { ...settings.api, connectwisePublicKey: e.target.value }
                        })}
                        required
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Private Key"
                        type={showApiKeys.connectwisePrivate ? 'text' : 'password'}
                        value={settings.api.connectwisePrivateKey || ''}
                        onChange={(e) => setSettings({
                          ...settings,
                          api: { ...settings.api, connectwisePrivateKey: e.target.value }
                        })}
                        required
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                onClick={() => setShowApiKeys({
                                  ...showApiKeys,
                                  connectwisePrivate: !showApiKeys.connectwisePrivate
                                })}
                                edge="end"
                              >
                                {showApiKeys.connectwisePrivate ? <VisibilityOffIcon /> : <VisibilityIcon />}
                              </IconButton>
                            </InputAdornment>
                          )
                        }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Client ID"
                        value={settings.api.connectwiseClientId || ''}
                        onChange={(e) => setSettings({
                          ...settings,
                          api: { ...settings.api, connectwiseClientId: e.target.value }
                        })}
                        helperText="Some ConnectWise integrations require a Client ID. Example: 0ea93dc0-6921-4d58-919a-4433616ef054"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Button
                        key={`cw-test-${testResults[0].status}`} // Force re-mount on status change
                        variant="outlined"
                        onClick={() => handleTestConnection('ConnectWise')}
                        disabled={testResults[0].status === 'testing'}
                        startIcon={
                          testResults[0].status === 'testing' ? (
                            <CircularProgress size={20} key="spinner" />
                          ) : testResults[0].status === 'success' ? (
                            <CheckCircleIcon key="check" />
                          ) : testResults[0].status === 'error' ? (
                            <ErrorIcon key="error" />
                          ) : null
                        }
                        color={
                          testResults[0].status === 'success' ? 'success' :
                          testResults[0].status === 'error' ? 'error' : 'primary'
                        }
                      >
                        {testResults[0].status === 'testing' ? 'Testing...' : 'Test Connection'}
                      </Button>
                      {testResults[0].message && (
                        <Typography 
                          variant="caption" 
                          color={testResults[0].status === 'success' ? 'success.main' : 'error.main'}
                          sx={{ ml: 2 }}
                        >
                          {testResults[0].message}
                        </Typography>
                      )}
                    </Grid>
                  </Grid>
                </Box>

                <Divider sx={{ my: 3 }} />

                {/* N-able Configuration */}
                <Box>
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
                    N-able RMM Configuration
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="N-able API URL"
                        value={settings.api.nableUrl}
                        onChange={(e) => setSettings({
                          ...settings,
                          api: { ...settings.api, nableUrl: e.target.value }
                        })}
                        helperText="Example: https://api.n-able.com"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Access Key"
                        value={settings.api.nableAccessKey || ''}
                        onChange={(e) => setSettings({
                          ...settings,
                          api: { ...settings.api, nableAccessKey: e.target.value }
                        })}
                        required
                      />
                    </Grid>
                    <Grid item xs={12}>
                      {(() => {
                        const timestamp = new Date().toISOString().split('T')[1];
                        console.log(`[${timestamp}] [DEBUG Render] N-able button rendering`);
                        console.log('[DEBUG Render] testResults[1]:', testResults[1]);
                        console.log('[DEBUG Render] Status === testing?', testResults[1].status === 'testing');
                        console.log('[DEBUG Render] Button should be disabled?', testResults[1].status === 'testing');
                        console.log('[DEBUG Render] Spinner should show?', testResults[1].status === 'testing');
                        
                        // Check what icon should be shown
                        const iconType = testResults[1].status === 'testing' ? 'SPINNER' :
                                       testResults[1].status === 'success' ? 'CHECK' :
                                       testResults[1].status === 'error' ? 'ERROR' : 'NONE';
                        console.log('[DEBUG Render] Icon that should show:', iconType);
                        return null;
                      })()}
                      <Button
                        key={`nable-test-${testResults[1].status}`} // Force re-mount on status change
                        variant="outlined"
                        onClick={() => handleTestConnection('N-able')}
                        disabled={testResults[1].status === 'testing'}
                        startIcon={
                          testResults[1].status === 'testing' ? (
                            <CircularProgress size={20} key="spinner" />
                          ) : testResults[1].status === 'success' ? (
                            <CheckCircleIcon key="check" />
                          ) : testResults[1].status === 'error' ? (
                            <ErrorIcon key="error" />
                          ) : null
                        }
                        color={
                          testResults[1].status === 'success' ? 'success' :
                          testResults[1].status === 'error' ? 'error' : 'primary'
                        }
                      >
                        {testResults[1].status === 'testing' ? 'Testing...' : 'Test Connection'}
                      </Button>
                      {testResults[1].message && (
                        <Typography 
                          variant="caption" 
                          color={testResults[1].status === 'success' ? 'success.main' : 'error.main'}
                          sx={{ ml: 2 }}
                        >
                          {testResults[1].message}
                        </Typography>
                      )}
                    </Grid>
                  </Grid>
                </Box>

                <Divider sx={{ my: 3 }} />

                {/* Rate Limiting */}
                <Box>
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
                    Rate Limiting & Timeouts
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Rate Limit (requests per minute)"
                        value={settings.api.rateLimitPerMinute}
                        onChange={(e) => setSettings({
                          ...settings,
                          api: { ...settings.api, rateLimitPerMinute: parseInt(e.target.value) }
                        })}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Request Timeout (seconds)"
                        value={settings.api.timeout}
                        onChange={(e) => setSettings({
                          ...settings,
                          api: { ...settings.api, timeout: parseInt(e.target.value) }
                        })}
                      />
                    </Grid>
                  </Grid>
                </Box>

                <Alert severity="info" sx={{ mt: 3 }}>
                  API credentials are encrypted and stored securely. Test connections before saving to ensure proper configuration.
                </Alert>
              </Box>
            )}

            {activeSection === 'general' && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  General Settings
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Company Name"
                      value={settings.general.companyName}
                      onChange={(e) => setSettings({
                        ...settings,
                        general: { ...settings.general, companyName: e.target.value }
                      })}
                      helperText="Your company or organization name"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Client ID"
                      value={settings.general.clientId || ''}
                      onChange={(e) => setSettings({
                        ...settings,
                        general: { ...settings.general, clientId: e.target.value }
                      })}
                      helperText="Unique identifier for this client instance"
                      InputProps={{
                        style: { fontFamily: 'monospace' }
                      }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <FormControl fullWidth>
                      <InputLabel>Timezone</InputLabel>
                      <Select
                        value={settings.general.timezone}
                        label="Timezone"
                        onChange={(e) => setSettings({
                          ...settings,
                          general: { ...settings.general, timezone: e.target.value }
                        })}
                      >
                        <MenuItem value="America/New_York">Eastern Time</MenuItem>
                        <MenuItem value="America/Chicago">Central Time</MenuItem>
                        <MenuItem value="America/Denver">Mountain Time</MenuItem>
                        <MenuItem value="America/Los_Angeles">Pacific Time</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6}>
                    <FormControl fullWidth>
                      <InputLabel>Date Format</InputLabel>
                      <Select
                        value={settings.general.dateFormat}
                        label="Date Format"
                        onChange={(e) => setSettings({
                          ...settings,
                          general: { ...settings.general, dateFormat: e.target.value }
                        })}
                      >
                        <MenuItem value="MM/DD/YYYY">MM/DD/YYYY</MenuItem>
                        <MenuItem value="DD/MM/YYYY">DD/MM/YYYY</MenuItem>
                        <MenuItem value="YYYY-MM-DD">YYYY-MM-DD</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6}>
                    <FormControl fullWidth>
                      <InputLabel>Language</InputLabel>
                      <Select
                        value={settings.general.language}
                        label="Language"
                        onChange={(e) => setSettings({
                          ...settings,
                          general: { ...settings.general, language: e.target.value }
                        })}
                      >
                        <MenuItem value="en-US">English (US)</MenuItem>
                        <MenuItem value="es-ES">Spanish</MenuItem>
                        <MenuItem value="fr-FR">French</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <Alert severity="info">
                      Client ID is loaded from environment configuration and identifies this specific deployment
                    </Alert>
                  </Grid>
                </Grid>
              </Box>
            )}

            {activeSection === 'notifications' && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Microsoft Teams Notification Settings
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.notifications.teamsEnabled}
                          onChange={(e) => setSettings({
                            ...settings,
                            notifications: { ...settings.notifications, teamsEnabled: e.target.checked }
                          })}
                        />
                      }
                      label="Enable Microsoft Teams Notifications"
                    />
                  </Grid>
                  
                  {settings.notifications.teamsEnabled && (
                    <>
                  <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Teams Webhook URL"
                          value={settings.notifications.teamsWebhookUrl || ''}
                          onChange={(e) => setSettings({
                            ...settings,
                            notifications: { ...settings.notifications, teamsWebhookUrl: e.target.value }
                          })}
                          placeholder="https://outlook.office.com/webhook/..."
                          helperText="Enter your Microsoft Teams incoming webhook URL"
                        />
                      </Grid>
                      
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Teams Channel"
                          value={settings.notifications.teamsChannel || ''}
                          onChange={(e) => setSettings({
                            ...settings,
                            notifications: { ...settings.notifications, teamsChannel: e.target.value }
                          })}
                          placeholder="e.g., Network Operations Center"
                          helperText="Specify the Teams channel for notifications"
                    />
                  </Grid>
                      
                  <Grid item xs={12}>
                        <Typography variant="subtitle2" gutterBottom>
                          Alert Types to Send to Teams
                        </Typography>
                        <FormGroup row>
                          {['Critical Alerts', 'Ticket Updates', 'Automation Results', 'Escalations'].map((alertType) => (
                    <FormControlLabel
                              key={alertType}
                      control={
                                <Checkbox
                                  checked={(settings.notifications.teamsAlertTypes || []).includes(alertType)}
                                  onChange={(e) => {
                                    const current = settings.notifications.teamsAlertTypes || [];
                                    const updated = e.target.checked 
                                      ? [...current, alertType]
                                      : current.filter(t => t !== alertType);
                                    setSettings({
                            ...settings,
                                      notifications: { ...settings.notifications, teamsAlertTypes: updated }
                                    });
                                  }}
                        />
                      }
                              label={alertType}
                    />
                          ))}
                        </FormGroup>
                  </Grid>
                      
                  <Grid item xs={12}>
                        <Typography variant="subtitle2" gutterBottom>
                          Escalation Mentions (Teams User IDs)
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                      <TextField
                        size="small"
                            placeholder="Enter Teams user ID or email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter' && newEmail) {
                                const current = settings.notifications.teamsEscalationMentions || [];
                                if (!current.includes(newEmail)) {
                                  setSettings({
                                    ...settings,
                                    notifications: { 
                                      ...settings.notifications, 
                                      teamsEscalationMentions: [...current, newEmail] 
                                    }
                                  });
                                  setNewEmail('');
                                }
                              }
                            }}
                      />
                      <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                            onClick={() => {
                              if (newEmail) {
                                const current = settings.notifications.teamsEscalationMentions || [];
                                if (!current.includes(newEmail)) {
                                  setSettings({
                                    ...settings,
                                    notifications: { 
                                      ...settings.notifications, 
                                      teamsEscalationMentions: [...current, newEmail] 
                                    }
                                  });
                                  setNewEmail('');
                                }
                              }
                            }}
                      >
                        Add
                      </Button>
                    </Box>
                    <List>
                          {(settings.notifications.teamsEscalationMentions || []).map((mention) => (
                            <ListItem key={mention}>
                              <ListItemText primary={mention} />
                          <ListItemSecondaryAction>
                                <IconButton 
                                  edge="end" 
                                  onClick={() => {
                                    const current = settings.notifications.teamsEscalationMentions || [];
                                    setSettings({
                                      ...settings,
                                      notifications: { 
                                        ...settings.notifications, 
                                        teamsEscalationMentions: current.filter(m => m !== mention) 
                                      }
                                    });
                                  }}
                                >
                              <DeleteIcon />
                            </IconButton>
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))}
                    </List>
                  </Grid>
                      
                      <Grid item xs={12}>
                        <Alert severity="info">
                          <Typography variant="body2">
                            To set up Teams notifications:
                          </Typography>
                          <Typography variant="body2" component="ol" sx={{ pl: 2, mt: 1 }}>
                            <li>Create an incoming webhook in your Teams channel</li>
                            <li>Copy the webhook URL and paste it above</li>
                            <li>Select the types of alerts you want to receive</li>
                            <li>Add team members to mention for escalations</li>
                          </Typography>
                        </Alert>
                      </Grid>
                    </>
                  )}
                </Grid>
              </Box>
            )}

            {activeSection === 'automation' && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Automation Settings
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.automation.enabled}
                          onChange={(e) => setSettings({
                            ...settings,
                            automation: { ...settings.automation, enabled: e.target.checked }
                          })}
                        />
                      }
                      label="Enable Automation"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Max Retries"
                      value={settings.automation.maxRetries}
                      onChange={(e) => setSettings({
                        ...settings,
                        automation: { ...settings.automation, maxRetries: parseInt(e.target.value) }
                      })}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Retry Delay (seconds)"
                      value={settings.automation.retryDelay}
                      onChange={(e) => setSettings({
                        ...settings,
                        automation: { ...settings.automation, retryDelay: parseInt(e.target.value) }
                      })}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Default Timeout (seconds)"
                      value={settings.automation.defaultTimeout}
                      onChange={(e) => setSettings({
                        ...settings,
                        automation: { ...settings.automation, defaultTimeout: parseInt(e.target.value) }
                      })}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.automation.requireApproval}
                          onChange={(e) => setSettings({
                            ...settings,
                            automation: { ...settings.automation, requireApproval: e.target.checked }
                          })}
                        />
                      }
                      label="Require Approval for Critical Actions"
                    />
                  </Grid>
                </Grid>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Settings;
