import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Button,
  Stack,
  Tooltip,
  CircularProgress,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Add as AddIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Sync as SyncIcon,
  CloudDownload as CloudDownloadIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { getApiUrl } from '../config/api';

interface Ticket {
  id: string;
  ticketNumber: string;
  externalId?: string; // ConnectWise ticket ID
  title: string;
  description: string;
  status: string;
  priority: string;
  source: string;
  clientName: string;
  board?: string;
  company?: string;
  type?: string;
  assignedTo?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string;
  metadata?: any;
}

export const Tickets: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    source: 'all',
    search: ''
  });

  const fetchTickets = async (syncFromCW = false) => {
    try {
      console.log(`[TICKETS DEBUG] Starting fetchTickets - syncFromCW: ${syncFromCW}`);
      console.log(`[TICKETS DEBUG] Current time: ${new Date().toISOString()}`);
      
      if (syncFromCW) {
        setSyncing(true);
        console.log('[TICKETS DEBUG] Setting syncing state to true');
      } else {
        setLoading(true);
      }
      setError(null);
      
      // Add sync parameter if requested
      const url = syncFromCW 
        ? `${getApiUrl()}/api/tickets?sync=true` 
        : `${getApiUrl()}/api/tickets`;
      
      console.log(`[TICKETS DEBUG] Fetching from URL: ${url}`);
      console.log(`[TICKETS DEBUG] Using token: ${token ? 'Yes (length: ' + token.length + ')' : 'No'}`);
      
      const response = await axios.get(url, {
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined
        }
      });
      
      console.log(`[TICKETS DEBUG] Response received:`, {
        status: response.status,
        dataType: typeof response.data,
        isArray: Array.isArray(response.data),
        ticketCount: Array.isArray(response.data) ? response.data.length : 'N/A',
        sampleTicket: response.data[0] || 'No tickets'
      });
      
      // Log ConnectWise tickets specifically
      if (Array.isArray(response.data)) {
        const cwTickets = response.data.filter(t => t.source === 'connectwise' || t.source === 'CONNECTWISE');
        const nableTickets = response.data.filter(t => t.source === 'nable' || t.source === 'NABLE');
        console.log(`[TICKETS DEBUG] Ticket breakdown:`, {
          total: response.data.length,
          fromConnectWise: cwTickets.length,
          fromNable: nableTickets.length,
          withExternalId: response.data.filter(t => t.externalId).length,
          cwTicketIds: cwTickets.slice(0, 5).map(t => ({ 
            id: t.id, 
            externalId: t.externalId, 
            ticketNumber: t.ticketNumber 
          }))
        });
      }
      
      setTickets(response.data);
      
      if (syncFromCW) {
        const message = `Successfully synced ${response.data.length} tickets from ConnectWise`;
        setSuccessMessage(message);
        console.log(`[TICKETS DEBUG] ${message}`);
      }
    } catch (error: any) {
      console.error('[TICKETS DEBUG] Error fetching tickets:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers
        }
      });
      
      if (error.response?.status === 401) {
        setError('You need to be logged in to view tickets');
      } else {
        setError(syncFromCW ? 'Failed to sync tickets from ConnectWise' : 'Failed to load tickets. Please try again.');
      }
    } finally {
      setLoading(false);
      setSyncing(false);
      console.log('[TICKETS DEBUG] fetchTickets completed, loading/syncing states reset');
    }
  };

  const syncFromConnectWise = async () => {
    try {
      console.log('[TICKETS DEBUG] ====== Starting ConnectWise Sync ======');
      console.log(`[TICKETS DEBUG] Sync initiated at: ${new Date().toISOString()}`);
      
      setSyncing(true);
      setError(null);
      
      const syncUrl = `${getApiUrl()}/api/tickets/sync`;
      console.log(`[TICKETS DEBUG] Calling sync endpoint: ${syncUrl}`);
      console.log(`[TICKETS DEBUG] Request method: POST`);
      console.log(`[TICKETS DEBUG] Using auth token: ${token ? 'Yes' : 'No'}`);
      
      const startTime = Date.now();
      
      const response = await axios.post(syncUrl, {}, {
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined
        }
      });
      
      const syncTime = Date.now() - startTime;
      
      console.log(`[TICKETS DEBUG] Sync response received in ${syncTime}ms:`, {
        success: response.data.success,
        message: response.data.message,
        ticketCount: response.data.ticketCount,
        responseData: response.data
      });
      
      if (response.data.success) {
        const message = `Sync completed: ${response.data.ticketCount} tickets in system`;
        setSuccessMessage(message);
        console.log(`[TICKETS DEBUG] ✅ ${message}`);
        
        // Refresh the tickets list after sync
        console.log('[TICKETS DEBUG] Refreshing ticket list after successful sync...');
        await fetchTickets(false);
        
        console.log('[TICKETS DEBUG] ====== ConnectWise Sync Completed Successfully ======');
      } else {
        console.warn('[TICKETS DEBUG] ⚠️ Sync returned success: false', response.data);
      }
    } catch (error: any) {
      console.error('[TICKETS DEBUG] ❌ Error syncing from ConnectWise:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        fullError: error,
        stack: error.stack
      });
      
      // Check if it's a credential issue
      if (error.response?.data?.message?.includes('not initialized') || 
          error.response?.data?.message?.includes('not configured')) {
        console.error('[TICKETS DEBUG] 🔑 ConnectWise credentials may not be configured');
        setError('ConnectWise not configured. Please check Settings → API Credentials');
      } else {
        setError('Failed to sync tickets from ConnectWise. Please check your ConnectWise settings.');
      }
      
      console.log('[TICKETS DEBUG] ====== ConnectWise Sync Failed ======');
    } finally {
      setSyncing(false);
      console.log('[TICKETS DEBUG] Sync state reset, syncing = false');
    }
  };

  useEffect(() => {
    console.log('[TICKETS DEBUG] Component mounted or token changed');
    console.log(`[TICKETS DEBUG] Token available: ${token ? 'Yes' : 'No'}`);
    fetchTickets();
  }, [token]);

  const handleRefresh = () => {
    console.log('[TICKETS DEBUG] 🔄 Refresh button clicked');
    fetchTickets();
  };

  const handleSyncFromCW = () => {
    console.log('[TICKETS DEBUG] 🔄 Sync from ConnectWise button clicked');
    syncFromConnectWise();
  };

  const handleViewTicket = (ticketId: string) => {
    navigate(`/tickets/${ticketId}`);
  };

  const handleCreateTicket = () => {
    navigate('/tickets/new');
  };

  const getStatusColor = (status: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    switch (status.toLowerCase()) {
      case 'open':
        return 'primary';
      case 'in_progress':
        return 'warning';
      case 'pending':
        return 'info';
      case 'resolved':
        return 'success';
      case 'closed':
        return 'default';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    switch (priority.toLowerCase()) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source.toLowerCase()) {
      case 'connectwise':
        return '🔗';
      case 'nable':
        return '📊';
      case 'manual':
        return '✏️';
      case 'automation':
        return '🤖';
      default:
        return '📝';
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    if (filters.status !== 'all' && ticket.status !== filters.status) {
      return false;
    }
    if (filters.priority !== 'all' && ticket.priority !== filters.priority) {
      return false;
    }
    if (filters.source !== 'all' && ticket.source.toLowerCase() !== filters.source) {
      return false;
    }
    if (filters.search && !ticket.title.toLowerCase().includes(filters.search.toLowerCase()) &&
        !ticket.description.toLowerCase().includes(filters.search.toLowerCase()) &&
        !ticket.clientName.toLowerCase().includes(filters.search.toLowerCase()) &&
        !(ticket.externalId && ticket.externalId.toLowerCase().includes(filters.search.toLowerCase()))) {
      return false;
    }
    return true;
  });

  if (loading) {
    return (
      <Container maxWidth={false}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth={false}>
        <Box sx={{ p: 3 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          {error.includes('logged in') && (
            <Button variant="contained" onClick={() => navigate('/login')}>
              Go to Login
            </Button>
          )}
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth={false}>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Tickets ({filteredTickets.length})
          </Typography>
          <Stack direction="row" spacing={2}>
            <Tooltip title="Refresh">
              <IconButton onClick={handleRefresh} disabled={syncing}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={syncing ? <CircularProgress size={20} /> : <CloudDownloadIcon />}
              onClick={handleSyncFromCW}
              disabled={syncing}
            >
              {syncing ? 'Syncing...' : 'Sync from ConnectWise'}
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateTicket}
            >
              New Ticket
            </Button>
          </Stack>
        </Box>

        <Snackbar
          open={!!successMessage}
          autoHideDuration={6000}
          onClose={() => setSuccessMessage(null)}
          message={successMessage}
        />

        <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
          <TextField
            placeholder="Search tickets or CW ID..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            sx={{ flex: 1 }}
            size="small"
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filters.status}
              label="Status"
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="open">Open</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="resolved">Resolved</MenuItem>
              <MenuItem value="closed">Closed</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Priority</InputLabel>
            <Select
              value={filters.priority}
              label="Priority"
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="low">Low</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Source</InputLabel>
            <Select
              value={filters.source}
              label="Source"
              onChange={(e) => setFilters({ ...filters, source: e.target.value })}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="connectwise">ConnectWise</MenuItem>
              <MenuItem value="nable">N-able</MenuItem>
              <MenuItem value="automation">Automation</MenuItem>
              <MenuItem value="manual">Manual</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Ticket #</TableCell>
                <TableCell>CW ID</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Client/Company</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Assigned To</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    <Typography color="textSecondary">
                      No tickets found. Click "Sync from ConnectWise" to import tickets.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTickets.map((ticket) => (
                  <TableRow key={ticket.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {ticket.ticketNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {ticket.externalId ? (
                        <Tooltip title="ConnectWise Ticket ID">
                          <Chip 
                            label={ticket.externalId} 
                            size="small" 
                            variant="outlined"
                            sx={{ fontFamily: 'monospace' }}
                          />
                        </Tooltip>
                      ) : (
                        <Typography variant="body2" color="textSecondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {ticket.title}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {ticket.description.substring(0, 50)}
                          {ticket.description.length > 50 && '...'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2">
                          {ticket.clientName || ticket.company || '-'}
                        </Typography>
                        {ticket.board && (
                          <Typography variant="caption" color="textSecondary">
                            Board: {ticket.board}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={ticket.status.replace('_', ' ')}
                        color={getStatusColor(ticket.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={ticket.priority}
                        color={getPriorityColor(ticket.priority)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title={ticket.source}>
                        <span>{getSourceIcon(ticket.source)} {ticket.source}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      {ticket.assignedTo ? (
                        <Typography variant="body2">
                          {ticket.assignedTo.firstName} {ticket.assignedTo.lastName}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="textSecondary">
                          Unassigned
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Tooltip 
                        title={
                          <Box>
                            <Typography variant="caption">
                              Created: {new Date(ticket.createdAt).toLocaleString()}
                            </Typography>
                            <br />
                            <Typography variant="caption">
                              Updated: {new Date(ticket.updatedAt).toLocaleString()}
                            </Typography>
                            {ticket.lastSyncedAt && (
                              <>
                                <br />
                                <Typography variant="caption">
                                  Synced: {new Date(ticket.lastSyncedAt).toLocaleString()}
                                </Typography>
                              </>
                            )}
                          </Box>
                        }
                      >
                        <Typography variant="body2">
                          {new Date(ticket.updatedAt).toLocaleDateString()}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Tooltip title="View">
                          <IconButton
                            size="small"
                            onClick={() => handleViewTicket(ticket.id)}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/tickets/${ticket.id}/edit`)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Container>
  );
};