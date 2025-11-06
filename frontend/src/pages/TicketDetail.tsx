import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Chip,
  Stack,
  Divider,
  Alert,
  CircularProgress,
  IconButton
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { getApiUrl } from '../config/api';

interface Ticket {
  id?: string;
  ticketNumber?: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  source: string;
  clientName: string;
  tags?: string[];
  notes?: any[];
  assignedTo?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export const TicketDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user } = useAuth();
  const isNewTicket = id === 'new' || !id;
  const isEditRoute = location.pathname.endsWith('/edit');
  
  const [ticket, setTicket] = useState<Ticket>({
    title: '',
    description: '',
    status: 'open',
    priority: 'medium',
    source: 'manual',
    clientName: '',
    tags: []
  });
  
  const [loading, setLoading] = useState(!isNewTicket);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(isNewTicket || isEditRoute);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (!isNewTicket && id) {
      fetchTicket();
    }
  }, [id]);

  useEffect(() => {
    setEditMode(isNewTicket || isEditRoute);
  }, [isNewTicket, isEditRoute]);

  const fetchTicket = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`${getApiUrl()}/api/tickets/${id}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined
        }
      });
      
      setTicket(response.data);
    } catch (error: any) {
      console.error('Error fetching ticket:', error);
      if (error.response?.status === 404) {
        setError('Ticket not found');
      } else if (error.response?.status === 401) {
        setError('You need to be logged in');
        navigate('/login');
      } else {
        setError('Failed to load ticket. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      
      if (!ticket.title || !ticket.description || !ticket.clientName) {
        setError('Please fill in all required fields');
        setSaving(false);
        return;
      }
      
      const url = isNewTicket 
        ? `${getApiUrl()}/api/tickets`
        : `${getApiUrl()}/api/tickets/${id}`;
        
      const method = isNewTicket ? 'post' : 'put';
      
      const payload = {
        ...ticket,
        assignedToId: user?.id // Assign to current user by default
      };
      
      const response = await axios[method](url, payload, {
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined
        }
      });
      
      if (isNewTicket) {
        navigate(`/tickets/${response.data.id}`);
      } else {
        setTicket(response.data);
        setEditMode(false);
      }
    } catch (error: any) {
      console.error('Error saving ticket:', error);
      setError('Failed to save ticket. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (isNewTicket) {
      navigate('/tickets');
    } else {
      setEditMode(false);
      fetchTicket();
    }
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      setTicket({
        ...ticket,
        tags: [...(ticket.tags || []), tagInput.trim()]
      });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTicket({
      ...ticket,
      tags: ticket.tags?.filter(tag => tag !== tagToRemove) || []
    });
  };

  const getStatusColor = (status: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    switch (status.toLowerCase()) {
      case 'open': return 'primary';
      case 'in_progress': return 'warning';
      case 'pending': return 'info';
      case 'resolved': return 'success';
      case 'closed': return 'default';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    switch (priority.toLowerCase()) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'default';
      default: return 'default';
    }
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

  if (error && !isNewTicket) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ p: 3 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button variant="contained" onClick={() => navigate('/tickets')}>
            Back to Tickets
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
            <IconButton onClick={() => navigate('/tickets')}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4">
              {isNewTicket ? 'New Ticket' : `Ticket ${ticket.ticketNumber || id}`}
            </Typography>
            {!isNewTicket && !editMode && (
              <>
                <Chip 
                  label={ticket.status.replace('_', ' ')} 
                  color={getStatusColor(ticket.status)} 
                  size="small" 
                />
                <Chip 
                  label={ticket.priority} 
                  color={getPriorityColor(ticket.priority)} 
                  size="small" 
                />
              </>
            )}
          </Box>
          <Box>
            {editMode ? (
              <Stack direction="row" spacing={2}>
                <Button
                  variant="outlined"
                  startIcon={<CancelIcon />}
                  onClick={handleCancel}
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
            ) : (
              <Button
                variant="contained"
                startIcon={<EditIcon />}
                onClick={() => setEditMode(true)}
              >
                Edit
              </Button>
            )}
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Paper sx={{ p: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Title"
                value={ticket.title}
                onChange={(e) => setTicket({ ...ticket, title: e.target.value })}
                disabled={!editMode}
                required
                error={editMode && !ticket.title}
                helperText={editMode && !ticket.title ? 'Title is required' : ''}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Description"
                value={ticket.description}
                onChange={(e) => setTicket({ ...ticket, description: e.target.value })}
                disabled={!editMode}
                required
                error={editMode && !ticket.description}
                helperText={editMode && !ticket.description ? 'Description is required' : ''}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Client Name"
                value={ticket.clientName}
                onChange={(e) => setTicket({ ...ticket, clientName: e.target.value })}
                disabled={!editMode}
                required
                error={editMode && !ticket.clientName}
                helperText={editMode && !ticket.clientName ? 'Client name is required' : ''}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth disabled={!editMode}>
                <InputLabel>Source</InputLabel>
                <Select
                  value={ticket.source}
                  label="Source"
                  onChange={(e) => setTicket({ ...ticket, source: e.target.value })}
                >
                  <MenuItem value="manual">Manual</MenuItem>
                  <MenuItem value="connectwise">ConnectWise</MenuItem>
                  <MenuItem value="nable">N-able</MenuItem>
                  <MenuItem value="automation">Automation</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth disabled={!editMode}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={ticket.status}
                  label="Status"
                  onChange={(e) => setTicket({ ...ticket, status: e.target.value })}
                >
                  <MenuItem value="open">Open</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="resolved">Resolved</MenuItem>
                  <MenuItem value="closed">Closed</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth disabled={!editMode}>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={ticket.priority}
                  label="Priority"
                  onChange={(e) => setTicket({ ...ticket, priority: e.target.value })}
                >
                  <MenuItem value="critical">Critical</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Tags
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                  {ticket.tags?.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      onDelete={editMode ? () => handleRemoveTag(tag) : undefined}
                      size="small"
                    />
                  ))}
                </Box>
                {editMode && (
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Add a tag and press Enter"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={handleAddTag}
                  />
                )}
              </Box>
            </Grid>

            {!isNewTicket && (
              <>
                <Grid item xs={12}>
                  <Divider />
                </Grid>

                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Created
                  </Typography>
                  <Typography>
                    {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : 'N/A'}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Last Updated
                  </Typography>
                  <Typography>
                    {ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString() : 'N/A'}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Assigned To
                  </Typography>
                  <Typography>
                    {ticket.assignedTo 
                      ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}` 
                      : 'Unassigned'}
                  </Typography>
                </Grid>
              </>
            )}
          </Grid>
        </Paper>
      </Box>
    </Container>
  );
};