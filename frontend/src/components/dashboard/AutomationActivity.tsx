import React from 'react';
import { Paper, Typography, List, ListItem, ListItemText, ListItemIcon } from '@mui/material';
import { CheckCircle, Error, Schedule } from '@mui/icons-material';

export const AutomationActivity: React.FC = () => {
  // Mock data - would come from API
  const activities = [
    { id: 1, name: 'Disk Cleanup', status: 'success', time: '2 min ago' },
    { id: 2, name: 'Service Restart', status: 'failed', time: '15 min ago' },
    { id: 3, name: 'Patch Install', status: 'running', time: 'In progress' },
  ];

  const getIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle color="success" />;
      case 'failed': return <Error color="error" />;
      case 'running': return <Schedule color="info" />;
      default: return null;
    }
  };

  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Typography variant="h6" gutterBottom>
        Automation Activity
      </Typography>
      <List>
        {activities.map((activity) => (
          <ListItem key={activity.id}>
            <ListItemIcon>
              {getIcon(activity.status)}
            </ListItemIcon>
            <ListItemText 
              primary={activity.name}
              secondary={activity.time}
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};


