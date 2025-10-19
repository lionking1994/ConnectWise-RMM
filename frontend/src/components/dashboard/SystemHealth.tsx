import React from 'react';
import { Paper, Typography, Box, LinearProgress } from '@mui/material';

export const SystemHealth: React.FC = () => {
  // Mock data - would come from API
  const metrics = [
    { name: 'API Response Time', value: 85, unit: 'ms' },
    { name: 'Queue Processing', value: 92, unit: '%' },
    { name: 'Database Load', value: 45, unit: '%' },
    { name: 'Memory Usage', value: 67, unit: '%' },
  ];

  const getColor = (value: number) => {
    if (value > 80) return 'error';
    if (value > 60) return 'warning';
    return 'success';
  };

  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Typography variant="h6" gutterBottom>
        System Health
      </Typography>
      {metrics.map((metric) => (
        <Box key={metric.name} sx={{ mb: 2 }}>
          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography variant="body2">{metric.name}</Typography>
            <Typography variant="body2">
              {metric.value}{metric.unit}
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={metric.value} 
            color={getColor(metric.value)}
          />
        </Box>
      ))}
    </Paper>
  );
};


