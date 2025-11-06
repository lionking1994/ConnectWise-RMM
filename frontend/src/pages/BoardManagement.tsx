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
  CardActions,
  Alert,
  CircularProgress,
  FormControlLabel,
  Switch,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ListItemIcon,
  Divider,
  Tooltip,
  Badge,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Sync as SyncIcon,
  Settings as SettingsIcon,
  Dashboard as DashboardIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon,
  ExpandMore as ExpandMoreIcon,
  Notifications as NotificationIcon,
  Timer as TimerIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  AutoMode as AutoIcon,
  ViewList as ListIcon,
  FilterList as FilterIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import axios from 'axios';

interface BoardConfig {
  id: number;
  boardId: string;
  boardName: string;
  description?: string;
  isActive: boolean;
  isPrimary: boolean;
  settings: {
    autoCreateTickets: boolean;
    autoAssignEnabled: boolean;
    defaultPriority: string;
    defaultStatus: string;
    syncInterval: number;
    notificationSettings?: {
      onNewTicket: boolean;
      onStatusChange: boolean;
      onPriorityChange: boolean;
      channels: string[];
    };
  };
  filters?: {
    statuses?: string[];
    priorities?: string[];
    types?: string[];
    companies?: string[];
  };
  lastSyncAt?: string;
  activeTicketsCount: number;
  syncStatus?: {
    isRunning: boolean;
    lastError?: string;
    consecutiveErrors?: number;
  };
  displaySettings?: {
    color: string;
    showInQuickAccess: boolean;
  };
}

interface ConnectWiseBoard {
  id: string;
  name: string;
  locationId?: number;
  businessUnitId?: number;
  inactiveFlag?: boolean;
}

interface SyncHistory {
  id: number;
  syncType: string;
  startTime: string;
  endTime?: string;
  ticketsCreated: number;
  ticketsUpdated: number;
  ticketsClosed: number;
  errors: number;
  status: string;
}

export const BoardManagement: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [boards, setBoards] = useState<BoardConfig[]>([]);
  const [availableBoards, setAvailableBoards] = useState<ConnectWiseBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState<BoardConfig | null>(null);
  const [syncHistoryDialog, setSyncHistoryDialog] = useState(false);
  const [syncHistory, setSyncHistory] = useState<SyncHistory[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    boardId: '',
    boardName: '',
    description: '',
    isPrimary: false,
    autoCreateTickets: true,
    autoAssignEnabled: false,
    defaultPriority: 'medium',
    defaultStatus: 'open',
    syncInterval: 15,
    onNewTicket: true,
    onStatusChange: false,
    onPriorityChange: false,
    notificationChannels: ['teams'],
    filterStatuses: [] as string[],
    filterPriorities: [] as string[],
    filterCompanies: [] as string[],
  });

  useEffect(() => {
    fetchBoards();
    fetchAvailableBoards();
  }, []);

  const fetchBoards = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/boards/configured', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        baseURL: window.location.origin.replace(':3000', ':3001')
      });
      
      // Ensure response.data is an array
      const boardsData = Array.isArray(response.data) ? response.data : [];
      setBoards(boardsData);
    } catch (error) {
      console.error('Failed to fetch boards:', error);
      setBoards([]); // Set empty array on error
      // Use mock data for demonstration
      const mockBoards: BoardConfig[] = [
        {
          id: 1,
          boardId: 'noc-board',
          boardName: 'Network Operations Center',
          description: 'Primary NOC board for monitoring',
          isActive: true,
          isPrimary: true,
          settings: {
            autoCreateTickets: true,
            autoAssignEnabled: true,
            defaultPriority: 'medium',
            defaultStatus: 'open',
            syncInterval: 15,
            notificationSettings: {
              onNewTicket: true,
              onStatusChange: false,
              onPriorityChange: false,
              channels: ['teams']
            }
          },
          activeTicketsCount: 12,
          lastSyncAt: new Date().toISOString()
        },
        {
          id: 2,
          boardId: 'service-board',
          boardName: 'Service Board',
          description: 'General service tickets',
          isActive: true,
          isPrimary: false,
          settings: {
            autoCreateTickets: true,
            autoAssignEnabled: false,
            defaultPriority: 'low',
            defaultStatus: 'open',
            syncInterval: 30,
            notificationSettings: {
              onNewTicket: true,
              onStatusChange: false,
              onPriorityChange: true,
              channels: ['teams']
            }
          },
          activeTicketsCount: 5,
          lastSyncAt: new Date().toISOString()
        }
      ];
      setBoards(mockBoards);
      enqueueSnackbar('Using demo boards. Configure API to see real data.', { variant: 'info' });
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableBoards = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/boards/available', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        baseURL: window.location.origin.replace(':3000', ':3001')
      });
      
      // Ensure response.data is an array
      const availableData = Array.isArray(response.data) ? response.data : [];
      setAvailableBoards(availableData);
    } catch (error) {
      console.error('Failed to fetch available boards:', error);
      setAvailableBoards([]); // Set empty array on error
      // Use mock data
      const mockAvailable: ConnectWiseBoard[] = [
        { id: 'noc-board', name: 'Network Operations Center' },
        { id: 'service-board', name: 'Service Board' },
        { id: 'project-board', name: 'Project Board' },
        { id: 'maintenance-board', name: 'Maintenance Board' }
      ];
      setAvailableBoards(mockAvailable);
    }
  };

  const fetchSyncHistory = async (boardId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/boards/${boardId}/sync-history`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        baseURL: window.location.origin.replace(':3000', ':3001')
      });
      
      // Ensure response.data is an array
      const historyData = Array.isArray(response.data) ? response.data : [];
      setSyncHistory(historyData);
      setSyncHistoryDialog(true);
    } catch (error) {
      console.error('Failed to fetch sync history:', error);
      setSyncHistory([]); // Set empty array on error
      enqueueSnackbar('Failed to fetch sync history', { variant: 'error' });
    }
  };

  const handleAddBoard = () => {
    setFormData({
      boardId: '',
      boardName: '',
      description: '',
      isPrimary: false,
      autoCreateTickets: true,
      autoAssignEnabled: false,
      defaultPriority: 'medium',
      defaultStatus: 'open',
      syncInterval: 15,
      onNewTicket: true,
      onStatusChange: false,
      onPriorityChange: false,
      notificationChannels: ['teams'],
      filterStatuses: [],
      filterPriorities: [],
      filterCompanies: [],
    });
    setEditMode(false);
    setDialogOpen(true);
  };

  const handleEditBoard = (board: BoardConfig) => {
    setFormData({
      boardId: board.boardId,
      boardName: board.boardName,
      description: board.description || '',
      isPrimary: board.isPrimary,
      autoCreateTickets: board.settings.autoCreateTickets,
      autoAssignEnabled: board.settings.autoAssignEnabled,
      defaultPriority: board.settings.defaultPriority,
      defaultStatus: board.settings.defaultStatus,
      syncInterval: board.settings.syncInterval,
      onNewTicket: board.settings.notificationSettings?.onNewTicket || false,
      onStatusChange: board.settings.notificationSettings?.onStatusChange || false,
      onPriorityChange: board.settings.notificationSettings?.onPriorityChange || false,
      notificationChannels: board.settings.notificationSettings?.channels || ['teams'],
      filterStatuses: board.filters?.statuses || [],
      filterPriorities: board.filters?.priorities || [],
      filterCompanies: board.filters?.companies || [],
    });
    setSelectedBoard(board);
    setEditMode(true);
    setDialogOpen(true);
  };

  const handleSaveBoard = async () => {
    try {
      const boardData = {
        boardId: formData.boardId,
        boardName: formData.boardName,
        description: formData.description,
        isPrimary: formData.isPrimary,
        settings: {
          autoCreateTickets: formData.autoCreateTickets,
          autoAssignEnabled: formData.autoAssignEnabled,
          defaultPriority: formData.defaultPriority,
          defaultStatus: formData.defaultStatus,
          syncInterval: formData.syncInterval,
          notificationSettings: {
            onNewTicket: formData.onNewTicket,
            onStatusChange: formData.onStatusChange,
            onPriorityChange: formData.onPriorityChange,
            channels: formData.notificationChannels,
          },
        },
        filters: {
          statuses: formData.filterStatuses,
          priorities: formData.filterPriorities,
          companies: formData.filterCompanies,
        },
      };

      if (editMode && selectedBoard) {
        await axios.put(`/api/boards/${selectedBoard.boardId}`, boardData);
        enqueueSnackbar('Board updated successfully', { variant: 'success' });
      } else {
        await axios.post('/api/boards/configure', boardData);
        enqueueSnackbar('Board configured successfully', { variant: 'success' });
      }

      setDialogOpen(false);
      fetchBoards();
    } catch (error) {
      enqueueSnackbar('Failed to save board configuration', { variant: 'error' });
    }
  };

  const handleDeleteBoard = async (boardId: string) => {
    if (window.confirm('Are you sure you want to remove this board from monitoring?')) {
      try {
        await axios.delete(`/api/boards/${boardId}`);
        enqueueSnackbar('Board removed successfully', { variant: 'success' });
        fetchBoards();
      } catch (error) {
        enqueueSnackbar('Failed to remove board', { variant: 'error' });
      }
    }
  };

  const handleSyncBoard = async (boardId: string) => {
    try {
      setSyncing(boardId);
      const response = await axios.post(`/api/boards/${boardId}/sync`);
      enqueueSnackbar(`Sync completed: ${response.data.ticketsCreated} new, ${response.data.ticketsUpdated} updated`, {
        variant: 'success',
      });
      fetchBoards();
    } catch (error) {
      enqueueSnackbar('Sync failed', { variant: 'error' });
    } finally {
      setSyncing(null);
    }
  };

  const handleSyncAll = async () => {
    try {
      setSyncing('all');
      const response = await axios.post('/api/boards/sync-all');
      enqueueSnackbar(`All boards synced: ${response.data.length} boards processed`, {
        variant: 'success',
      });
      fetchBoards();
    } catch (error) {
      enqueueSnackbar('Sync all failed', { variant: 'error' });
    } finally {
      setSyncing(null);
    }
  };

  const handleToggleActive = async (board: BoardConfig) => {
    try {
      await axios.patch(`/api/boards/${board.boardId}/toggle-active`);
      enqueueSnackbar(`Board ${board.isActive ? 'deactivated' : 'activated'}`, {
        variant: 'success',
      });
      fetchBoards();
    } catch (error) {
      enqueueSnackbar('Failed to toggle board status', { variant: 'error' });
    }
  };

  const handleSetPrimary = async (board: BoardConfig) => {
    try {
      await axios.patch(`/api/boards/${board.boardId}/set-primary`);
      enqueueSnackbar(`${board.boardName} set as primary board`, {
        variant: 'success',
      });
      fetchBoards();
    } catch (error) {
      enqueueSnackbar('Failed to set primary board', { variant: 'error' });
    }
  };

  const getStatusColor = (board: BoardConfig) => {
    if (!board.isActive) return 'default';
    if (board.syncStatus?.lastError) return 'error';
    if (board.syncStatus?.isRunning) return 'info';
    return 'success';
  };

  const getSyncStatusText = (board: BoardConfig) => {
    if (!board.isActive) return 'Inactive';
    if (board.syncStatus?.isRunning) return 'Syncing...';
    if (board.syncStatus?.lastError) return 'Error';
    if (board.lastSyncAt) {
      const lastSync = new Date(board.lastSyncAt);
      const minutesAgo = Math.floor((Date.now() - lastSync.getTime()) / 60000);
      if (minutesAgo < 1) return 'Just synced';
      if (minutesAgo < 60) return `${minutesAgo}m ago`;
      return `${Math.floor(minutesAgo / 60)}h ago`;
    }
    return 'Never synced';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">
          Board Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={syncing === 'all' ? <CircularProgress size={20} /> : <SyncIcon />}
            onClick={handleSyncAll}
            disabled={syncing !== null}
          >
            Sync All Boards
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddBoard}
          >
            Add Board
          </Button>
        </Box>
      </Box>

      {/* Primary Board Card */}
      {Array.isArray(boards) && boards.find(b => b.isPrimary) && (
        <Card sx={{ mb: 3, borderLeft: '4px solid #1976d2' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <StarIcon color="primary" />
              <Typography variant="h6">Primary Board</Typography>
              <Chip label="NOC" color="primary" size="small" />
            </Box>
            <Grid container spacing={2}>
              {(Array.isArray(boards) ? boards : []).filter(b => b.isPrimary).map(board => (
                <Grid item xs={12} md={6} lg={3} key={board.boardId}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle1">{board.boardName}</Typography>
                    {board.isActive ? (
                      <ActiveIcon color="success" fontSize="small" />
                    ) : (
                      <InactiveIcon color="disabled" fontSize="small" />
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {board.activeTicketsCount} active tickets
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Last sync: {getSyncStatusText(board)}
                  </Typography>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Board List */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Board Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="center">Active Tickets</TableCell>
              <TableCell>Sync Interval</TableCell>
              <TableCell>Last Sync</TableCell>
              <TableCell>Notifications</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : boards.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Alert severity="info">
                    No boards configured. Click "Add Board" to get started.
                  </Alert>
                </TableCell>
              </TableRow>
            ) : (
              (Array.isArray(boards) ? boards : []).map((board) => (
                <TableRow key={board.boardId}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {board.isPrimary ? (
                        <StarIcon color="primary" fontSize="small" />
                      ) : (
                        <IconButton
                          size="small"
                          onClick={() => handleSetPrimary(board)}
                          disabled={!board.isActive}
                        >
                          <StarBorderIcon fontSize="small" />
                        </IconButton>
                      )}
                      <Box>
                        <Typography variant="body2">{board.boardName}</Typography>
                        {board.description && (
                          <Typography variant="caption" color="text.secondary">
                            {board.description}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getSyncStatusText(board)}
                      color={getStatusColor(board)}
                      size="small"
                      icon={board.syncStatus?.isRunning ? <CircularProgress size={16} /> : undefined}
                    />
                    {board.syncStatus?.consecutiveErrors && board.syncStatus.consecutiveErrors > 0 && (
                      <Tooltip title={board.syncStatus.lastError}>
                        <Chip
                          label={`${board.syncStatus.consecutiveErrors} errors`}
                          color="error"
                          size="small"
                          sx={{ ml: 1 }}
                        />
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Badge badgeContent={board.activeTicketsCount} color="primary">
                      <ListIcon />
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {board.settings.syncInterval > 0 ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <TimerIcon fontSize="small" />
                        {board.settings.syncInterval} min
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Manual
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {board.lastSyncAt ? (
                      new Date(board.lastSyncAt).toLocaleString()
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Never
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {board.settings.notificationSettings?.channels.includes('teams') && (
                        <Tooltip title="Teams notifications enabled">
                          <NotificationIcon fontSize="small" />
                        </Tooltip>
                      )}
                      {board.settings.autoAssignEnabled && (
                        <Tooltip title="Auto-assign enabled">
                          <AutoIcon fontSize="small" />
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleSyncBoard(board.boardId)}
                      disabled={!board.isActive || syncing !== null}
                    >
                      {syncing === board.boardId ? (
                        <CircularProgress size={20} />
                      ) : (
                        <SyncIcon />
                      )}
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => fetchSyncHistory(board.boardId)}
                    >
                      <ListIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleEditBoard(board)}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleToggleActive(board)}
                    >
                      {board.isActive ? <InactiveIcon /> : <ActiveIcon />}
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteBoard(board.boardId)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Configuration Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editMode ? 'Edit Board Configuration' : 'Add ConnectWise Board'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {!editMode && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Select Board</InputLabel>
                  <Select
                    value={formData.boardId}
                    onChange={(e) => {
                      const board = availableBoards.find(b => b.id === e.target.value);
                      setFormData({
                        ...formData,
                        boardId: e.target.value,
                        boardName: board?.name || '',
                      });
                    }}
                    label="Select Board"
                  >
                    {(Array.isArray(availableBoards) ? availableBoards : []).map(board => (
                      <MenuItem key={board.id} value={board.id}>
                        {board.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description (optional)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isPrimary}
                    onChange={(e) => setFormData({ ...formData, isPrimary: e.target.checked })}
                  />
                }
                label="Set as Primary Board (NOC)"
              />
            </Grid>

            <Grid item xs={12}>
              <Divider>Sync Settings</Divider>
            </Grid>

            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Sync Interval (minutes)"
                type="number"
                value={formData.syncInterval}
                onChange={(e) => setFormData({ ...formData, syncInterval: Number(e.target.value) })}
                helperText="0 for manual sync only"
              />
            </Grid>

            <Grid item xs={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.autoCreateTickets}
                    onChange={(e) => setFormData({ ...formData, autoCreateTickets: e.target.checked })}
                  />
                }
                label="Auto-create tickets"
              />
            </Grid>

            <Grid item xs={12}>
              <Divider>Automation</Divider>
            </Grid>

            <Grid item xs={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.autoAssignEnabled}
                    onChange={(e) => setFormData({ ...formData, autoAssignEnabled: e.target.checked })}
                  />
                }
                label="Enable auto-assignment"
              />
            </Grid>

            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Default Priority</InputLabel>
                <Select
                  value={formData.defaultPriority}
                  onChange={(e) => setFormData({ ...formData, defaultPriority: e.target.value })}
                  label="Default Priority"
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Divider>Notifications</Divider>
            </Grid>

            <Grid item xs={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.onNewTicket}
                    onChange={(e) => setFormData({ ...formData, onNewTicket: e.target.checked })}
                  />
                }
                label="New tickets"
              />
            </Grid>

            <Grid item xs={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.onStatusChange}
                    onChange={(e) => setFormData({ ...formData, onStatusChange: e.target.checked })}
                  />
                }
                label="Status changes"
              />
            </Grid>

            <Grid item xs={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.onPriorityChange}
                    onChange={(e) => setFormData({ ...formData, onPriorityChange: e.target.checked })}
                  />
                }
                label="Priority changes"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveBoard} variant="contained">
            {editMode ? 'Update' : 'Add Board'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sync History Dialog */}
      <Dialog open={syncHistoryDialog} onClose={() => setSyncHistoryDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Sync History</DialogTitle>
        <DialogContent>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Time</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Updated</TableCell>
                  <TableCell>Closed</TableCell>
                  <TableCell>Errors</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(Array.isArray(syncHistory) ? syncHistory : []).map((sync) => (
                  <TableRow key={sync.id}>
                    <TableCell>{new Date(sync.startTime).toLocaleString()}</TableCell>
                    <TableCell>
                      <Chip label={sync.syncType} size="small" />
                    </TableCell>
                    <TableCell>{sync.ticketsCreated}</TableCell>
                    <TableCell>{sync.ticketsUpdated}</TableCell>
                    <TableCell>{sync.ticketsClosed}</TableCell>
                    <TableCell>
                      {sync.errors > 0 && (
                        <Chip label={sync.errors} color="error" size="small" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={sync.status}
                        color={sync.status === 'completed' ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSyncHistoryDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};


                  <Switch
                    checked={formData.onStatusChange}
                    onChange={(e) => setFormData({ ...formData, onStatusChange: e.target.checked })}
                  />
                }
                label="Status changes"
              />
            </Grid>

            <Grid item xs={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.onPriorityChange}
                    onChange={(e) => setFormData({ ...formData, onPriorityChange: e.target.checked })}
                  />
                }
                label="Priority changes"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveBoard} variant="contained">
            {editMode ? 'Update' : 'Add Board'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sync History Dialog */}
      <Dialog open={syncHistoryDialog} onClose={() => setSyncHistoryDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Sync History</DialogTitle>
        <DialogContent>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Time</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Updated</TableCell>
                  <TableCell>Closed</TableCell>
                  <TableCell>Errors</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(Array.isArray(syncHistory) ? syncHistory : []).map((sync) => (
                  <TableRow key={sync.id}>
                    <TableCell>{new Date(sync.startTime).toLocaleString()}</TableCell>
                    <TableCell>
                      <Chip label={sync.syncType} size="small" />
                    </TableCell>
                    <TableCell>{sync.ticketsCreated}</TableCell>
                    <TableCell>{sync.ticketsUpdated}</TableCell>
                    <TableCell>{sync.ticketsClosed}</TableCell>
                    <TableCell>
                      {sync.errors > 0 && (
                        <Chip label={sync.errors} color="error" size="small" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={sync.status}
                        color={sync.status === 'completed' ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSyncHistoryDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

