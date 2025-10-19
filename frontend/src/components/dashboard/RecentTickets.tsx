import React from 'react';
import { Paper, Typography, List, ListItem, ListItemText, Chip } from '@mui/material';

export const RecentTickets: React.FC = () => {
  // Mock data - would come from API
  const tickets = [
    { id: 1, title: 'Server CPU High', priority: 'high', status: 'open' },
    { id: 2, title: 'Backup Failed', priority: 'critical', status: 'in_progress' },
    { id: 3, title: 'Update Required', priority: 'medium', status: 'resolved' },
  ];

  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Typography variant="h6" gutterBottom>
        Recent Tickets
      </Typography>
      <List>
        {tickets.map((ticket) => (
          <ListItem key={ticket.id}>
            <ListItemText 
              primary={ticket.title}
              secondary={
                <Chip 
                  label={ticket.priority} 
                  size="small" 
                  color={ticket.priority === 'critical' ? 'error' : 'warning'}
                />
              }
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};


