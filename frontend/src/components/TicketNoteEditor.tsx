import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Paper,
  Tabs,
  Tab,
  Chip,
  IconButton,
  Alert,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Card,
  CardContent,
  FormControlLabel,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Save as SaveIcon,
  Send as SendIcon,
  Preview as PreviewIcon,
  Code as CodeIcon,
  TextFields as TextIcon,
  History as HistoryIcon,
  Description as TemplateIcon,
  Functions as VariableIcon,
  ExpandMore as ExpandMoreIcon,
  FormatBold as BoldIcon,
  FormatItalic as ItalicIcon,
  FormatUnderlined as UnderlineIcon,
  FormatListBulleted as BulletIcon,
  FormatListNumbered as NumberIcon,
  Link as LinkIcon,
  AttachFile as AttachIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';

interface NoteTemplate {
  id: string;
  name: string;
  category: string;
  content: string;
  variables: string[];
  isInternal: boolean;
}

interface NoteVariable {
  name: string;
  value: string | number | boolean;
  description: string;
}

interface TicketNoteEditorProps {
  open: boolean;
  onClose: () => void;
  ticketId: string | number;
  ticketNumber?: string;
  onSave: (note: {
    content: string;
    isInternal: boolean;
    syncToConnectWise: boolean;
    attachments?: string[];
  }) => void;
  existingNote?: string;
  context?: {
    scriptName?: string;
    executionTime?: string;
    result?: string;
    errorMessage?: string;
    deviceName?: string;
    clientName?: string;
    technicianName?: string;
    ticketPriority?: string;
    ticketStatus?: string;
  };
}

export const TicketNoteEditor: React.FC<TicketNoteEditorProps> = ({
  open,
  onClose,
  ticketId,
  ticketNumber,
  onSave,
  existingNote = '',
  context = {},
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const [content, setContent] = useState(existingNote);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isInternal, setIsInternal] = useState(false);
  const [syncToConnectWise, setSyncToConnectWise] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [editorMode, setEditorMode] = useState<'rich' | 'markdown' | 'template'>('rich');
  const [tabValue, setTabValue] = useState(0);
  const [copied, setCopied] = useState(false);

  // Predefined note templates
  const templates: NoteTemplate[] = [
    {
      id: 'remediation-success',
      name: 'Automated Remediation Success',
      category: 'Automation',
      content: `**Automated Remediation Completed Successfully**

Script: {{ScriptName}}
Execution Time: {{ExecutionTime}}
Status: ✅ SUCCESS

**Actions Taken:**
{{Result}}

**Next Steps:**
- Monitoring ticket for 24 hours
- Will auto-close if no recurrence

Automation System`,
      variables: ['ScriptName', 'ExecutionTime', 'Result'],
      isInternal: false,
    },
    {
      id: 'remediation-failure',
      name: 'Automated Remediation Failed',
      category: 'Automation',
      content: `**Automated Remediation Failed - Manual Intervention Required**

Script: {{ScriptName}}
Execution Time: {{ExecutionTime}}
Status: ❌ FAILED

**Error Details:**
{{ErrorMessage}}

**Manual Action Required:**
- Please review the error above
- Manually resolve the issue
- Update ticket when complete

Device: {{DeviceName}}
Priority: {{TicketPriority}}`,
      variables: ['ScriptName', 'ExecutionTime', 'ErrorMessage', 'DeviceName', 'TicketPriority'],
      isInternal: false,
    },
    {
      id: 'escalation',
      name: 'Ticket Escalated',
      category: 'Escalation',
      content: `**Ticket Escalated to Senior Technician**

Reason: {{EscalationReason}}
Previous Technician: {{PreviousTech}}
Escalation Level: {{Level}}

**Summary of Previous Actions:**
{{PreviousActions}}

**Recommended Next Steps:**
{{RecommendedActions}}

This ticket has been escalated for immediate attention.`,
      variables: ['EscalationReason', 'PreviousTech', 'Level', 'PreviousActions', 'RecommendedActions'],
      isInternal: false,
    },
    {
      id: 'client-update',
      name: 'Client Update',
      category: 'Communication',
      content: `Hello {{ClientName}},

We wanted to provide you with an update on ticket #{{TicketNumber}}.

**Current Status:** {{TicketStatus}}

{{UpdateDetails}}

**Expected Resolution Time:** {{ExpectedTime}}

If you have any questions or concerns, please don't hesitate to reach out.

Best regards,
{{TechnicianName}}`,
      variables: ['ClientName', 'TicketNumber', 'TicketStatus', 'UpdateDetails', 'ExpectedTime', 'TechnicianName'],
      isInternal: false,
    },
    {
      id: 'internal-note',
      name: 'Internal Technical Note',
      category: 'Internal',
      content: `**Internal Note - Do Not Share with Client**

Technical Details:
{{TechnicalDetails}}

Root Cause Analysis:
{{RootCause}}

Action Items:
- {{ActionItem1}}
- {{ActionItem2}}
- {{ActionItem3}}

Follow-up Required: {{FollowUpRequired}}`,
      variables: ['TechnicalDetails', 'RootCause', 'ActionItem1', 'ActionItem2', 'ActionItem3', 'FollowUpRequired'],
      isInternal: true,
    },
    {
      id: 'disk-cleanup',
      name: 'Disk Cleanup Performed',
      category: 'Maintenance',
      content: `**Disk Cleanup Completed**

Device: {{DeviceName}}
Space Before: {{SpaceBefore}}GB
Space After: {{SpaceAfter}}GB
Space Recovered: {{SpaceRecovered}}GB

**Actions Performed:**
- Cleared temporary files
- Removed old log files
- Cleaned Windows Update cache
- Emptied recycle bin

The disk space issue has been resolved.`,
      variables: ['DeviceName', 'SpaceBefore', 'SpaceAfter', 'SpaceRecovered'],
      isInternal: false,
    },
    {
      id: 'service-restart',
      name: 'Service Restarted',
      category: 'Services',
      content: `**Service Restart Completed**

Service Name: {{ServiceName}}
Previous Status: {{PreviousStatus}}
Current Status: {{CurrentStatus}}
Restart Time: {{RestartTime}}

The service has been successfully restarted and is now operational.`,
      variables: ['ServiceName', 'PreviousStatus', 'CurrentStatus', 'RestartTime'],
      isInternal: false,
    },
    {
      id: 'patch-applied',
      name: 'Patch/Update Applied',
      category: 'Updates',
      content: `**System Update Applied**

Update Type: {{UpdateType}}
Version: {{Version}}
Installation Status: {{Status}}
Reboot Required: {{RebootRequired}}

**Updates Installed:**
{{UpdateList}}

System is now up to date.`,
      variables: ['UpdateType', 'Version', 'Status', 'RebootRequired', 'UpdateList'],
      isInternal: false,
    },
    {
      id: 'monitoring-started',
      name: 'Monitoring Started',
      category: 'Monitoring',
      content: `**Active Monitoring Initiated**

Monitoring Type: {{MonitoringType}}
Duration: {{Duration}}
Metrics Tracked: {{Metrics}}
Alert Threshold: {{Threshold}}

We will continue monitoring this issue and will update the ticket with any findings.`,
      variables: ['MonitoringType', 'Duration', 'Metrics', 'Threshold'],
      isInternal: false,
    },
    {
      id: 'resolution-summary',
      name: 'Resolution Summary',
      category: 'Resolution',
      content: `**Ticket Resolution Summary**

Issue: {{IssueSummary}}
Root Cause: {{RootCause}}
Resolution: {{ResolutionDetails}}
Time to Resolve: {{TimeToResolve}}

**Prevention Measures:**
{{PreventionMeasures}}

This ticket has been successfully resolved and will be closed.`,
      variables: ['IssueSummary', 'RootCause', 'ResolutionDetails', 'TimeToResolve', 'PreventionMeasures'],
      isInternal: false,
    },
  ];

  // Available variables from context and custom
  const availableVariables: NoteVariable[] = [
    // Context variables
    { name: 'ScriptName', value: context.scriptName || '', description: 'Name of executed script' },
    { name: 'ExecutionTime', value: context.executionTime || new Date().toISOString(), description: 'Script execution timestamp' },
    { name: 'Result', value: context.result || '', description: 'Script execution result' },
    { name: 'ErrorMessage', value: context.errorMessage || '', description: 'Error message if failed' },
    { name: 'DeviceName', value: context.deviceName || '', description: 'Affected device name' },
    { name: 'ClientName', value: context.clientName || '', description: 'Client name' },
    { name: 'TechnicianName', value: context.technicianName || '', description: 'Current technician' },
    { name: 'TicketNumber', value: ticketNumber || ticketId, description: 'Ticket number' },
    { name: 'TicketPriority', value: context.ticketPriority || 'Medium', description: 'Ticket priority' },
    { name: 'TicketStatus', value: context.ticketStatus || 'In Progress', description: 'Current ticket status' },
    // System variables
    { name: 'CurrentDate', value: new Date().toLocaleDateString(), description: 'Current date' },
    { name: 'CurrentTime', value: new Date().toLocaleTimeString(), description: 'Current time' },
    { name: 'Timestamp', value: new Date().toISOString(), description: 'Full timestamp' },
  ];

  useEffect(() => {
    if (existingNote) {
      setContent(existingNote);
    }
  }, [existingNote]);

  const applyTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      let templateContent = template.content;
      
      // Replace variables with actual values
      availableVariables.forEach(variable => {
        const regex = new RegExp(`{{${variable.name}}}`, 'g');
        templateContent = templateContent.replace(regex, String(variable.value || `[${variable.name}]`));
      });
      
      setContent(templateContent);
      setIsInternal(template.isInternal);
      enqueueSnackbar(`Template "${template.name}" applied`, { variant: 'success' });
    }
  };

  const insertVariable = (variableName: string) => {
    const variable = availableVariables.find(v => v.name === variableName);
    if (variable) {
      const insertion = editorMode === 'markdown' 
        ? `{{${variable.name}}}`
        : String(variable.value || `[${variable.name}]`);
      
      setContent(content + insertion);
    }
  };

  const replaceVariables = (text: string): string => {
    let processedText = text;
    availableVariables.forEach(variable => {
      const regex = new RegExp(`{{${variable.name}}}`, 'g');
      processedText = processedText.replace(regex, String(variable.value || `[${variable.name}]`));
    });
    return processedText;
  };

  const handleFormatting = (format: string) => {
    const textarea = document.getElementById('note-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    let formattedText = selectedText;

    switch (format) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
      case 'underline':
        formattedText = `__${selectedText}__`;
        break;
      case 'bullet':
        formattedText = `\n- ${selectedText}`;
        break;
      case 'number':
        formattedText = `\n1. ${selectedText}`;
        break;
      case 'link':
        formattedText = `[${selectedText}](url)`;
        break;
    }

    const newContent = content.substring(0, start) + formattedText + content.substring(end);
    setContent(newContent);
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(replaceVariables(content));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    enqueueSnackbar('Note copied to clipboard', { variant: 'success' });
  };

  const handleSave = () => {
    const processedContent = replaceVariables(content);
    onSave({
      content: processedContent,
      isInternal,
      syncToConnectWise,
    });
    
    enqueueSnackbar('Note saved successfully', { variant: 'success' });
    onClose();
  };

  const renderEditor = () => {
    switch (editorMode) {
      case 'rich':
        return (
          <Box>
            <Box sx={{ mb: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <IconButton size="small" onClick={() => handleFormatting('bold')}>
                <BoldIcon />
              </IconButton>
              <IconButton size="small" onClick={() => handleFormatting('italic')}>
                <ItalicIcon />
              </IconButton>
              <IconButton size="small" onClick={() => handleFormatting('underline')}>
                <UnderlineIcon />
              </IconButton>
              <Divider orientation="vertical" flexItem />
              <IconButton size="small" onClick={() => handleFormatting('bullet')}>
                <BulletIcon />
              </IconButton>
              <IconButton size="small" onClick={() => handleFormatting('number')}>
                <NumberIcon />
              </IconButton>
              <Divider orientation="vertical" flexItem />
              <IconButton size="small" onClick={() => handleFormatting('link')}>
                <LinkIcon />
              </IconButton>
            </Box>
            <TextField
              id="note-textarea"
              fullWidth
              multiline
              rows={12}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your note here..."
              variant="outlined"
            />
          </Box>
        );
      
      case 'markdown':
        return (
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="subtitle2" gutterBottom>
                Markdown Editor
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={14}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="# Heading&#10;**Bold** *Italic*&#10;- Bullet point&#10;[Link](url)"
                variant="outlined"
                sx={{ fontFamily: 'monospace' }}
              />
            </Grid>
            <Grid item xs={6}>
              <Typography variant="subtitle2" gutterBottom>
                Preview
              </Typography>
              <Paper sx={{ p: 2, minHeight: 350, maxHeight: 350, overflow: 'auto' }}>
                <ReactMarkdown>{replaceVariables(content)}</ReactMarkdown>
              </Paper>
            </Grid>
          </Grid>
        );
      
      case 'template':
        return (
          <Box>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Select Template</InputLabel>
              <Select
                value={selectedTemplate}
                onChange={(e) => {
                  setSelectedTemplate(e.target.value);
                  applyTemplate(e.target.value);
                }}
                label="Select Template"
              >
                {templates.map((template) => (
                  <MenuItem key={template.id} value={template.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label={template.category} size="small" />
                      {template.name}
                      {template.isInternal && <Chip label="Internal" size="small" color="warning" />}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              multiline
              rows={10}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              variant="outlined"
            />
          </Box>
        );
    }
  };

  const renderVariables = () => (
    <Box sx={{ height: 400, overflow: 'auto' }}>
      <Alert severity="info" sx={{ mb: 2 }}>
        Click on any variable to insert it into your note. Variables are automatically replaced with their values.
      </Alert>
      <List dense>
        {availableVariables.map((variable) => (
          <ListItem
            key={variable.name}
            button
            onClick={() => insertVariable(variable.name)}
            sx={{ 
              border: '1px solid', 
              borderColor: 'divider', 
              borderRadius: 1, 
              mb: 1,
              '&:hover': { backgroundColor: 'action.hover' }
            }}
          >
            <ListItemIcon>
              <VariableIcon />
            </ListItemIcon>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {`{{${variable.name}}}`}
                  </Typography>
                  {variable.value && (
                    <Chip 
                      label={String(variable.value).substring(0, 30)} 
                      size="small" 
                      variant="outlined"
                    />
                  )}
                </Box>
              }
              secondary={variable.description}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );

  const renderPreview = () => (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        This is how your note will appear when saved. All variables have been replaced with their values.
      </Alert>
      <Paper sx={{ p: 3, minHeight: 300 }}>
        <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
          {isInternal && <Chip label="Internal Note" color="warning" size="small" />}
          {syncToConnectWise && <Chip label="Will Sync to ConnectWise" color="success" size="small" />}
        </Box>
        <Divider sx={{ my: 2 }} />
        <ReactMarkdown>{replaceVariables(content)}</ReactMarkdown>
      </Paper>
    </Box>
  );

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{ sx: { minHeight: '80vh' } }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">
            Add Note to Ticket {ticketNumber ? `#${ticketNumber}` : ''}
          </Typography>
          <ToggleButtonGroup
            value={editorMode}
            exclusive
            onChange={(e, mode) => mode && setEditorMode(mode)}
            size="small"
          >
            <ToggleButton value="rich">
              <Tooltip title="Rich Text">
                <TextIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="markdown">
              <Tooltip title="Markdown">
                <CodeIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="template">
              <Tooltip title="Templates">
                <TemplateIcon />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Editor" />
          <Tab label="Variables" icon={<VariableIcon />} />
          <Tab label="Preview" icon={<PreviewIcon />} />
        </Tabs>
        
        <Box sx={{ mt: 2 }}>
          {tabValue === 0 && (
            <Box>
              <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                    />
                  }
                  label="Internal Note (Not visible to client)"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={syncToConnectWise}
                      onChange={(e) => setSyncToConnectWise(e.target.checked)}
                    />
                  }
                  label="Sync to ConnectWise"
                />
                <Button
                  startIcon={copied ? <CheckIcon /> : <CopyIcon />}
                  onClick={handleCopyToClipboard}
                  variant="outlined"
                  size="small"
                >
                  {copied ? 'Copied!' : 'Copy to Clipboard'}
                </Button>
              </Box>
              {renderEditor()}
            </Box>
          )}
          
          {tabValue === 1 && renderVariables()}
          
          {tabValue === 2 && renderPreview()}
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => setTabValue(2)}
          startIcon={<PreviewIcon />}
        >
          Preview
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={syncToConnectWise ? <SendIcon /> : <SaveIcon />}
        >
          {syncToConnectWise ? 'Save & Sync' : 'Save Note'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

