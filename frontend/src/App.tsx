import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';

import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { theme } from './theme';
import { PrivateRoute } from './components/PrivateRoute';
import { Layout } from './components/Layout';

// Pages
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Tickets } from './pages/Tickets';
import { TicketDetail } from './pages/TicketDetail';
import { Automation } from './pages/Automation';
import { RuleEditor } from './pages/RuleEditor';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { Users } from './pages/Users';
import { ApiConfig } from './pages/ApiConfig';
import { Notifications } from './pages/Notifications';
import { AuditLog } from './pages/AuditLog';
// import { NotificationSettings } from './pages/NotificationSettings';
// import { Reports } from './pages/Reports';
// import { AutomationDesigner } from './pages/AutomationDesigner';
// import { AlertManagement } from './pages/AlertManagement';
import { ScriptManager } from './pages/ScriptManager';
import { AlertScriptMapping } from './pages/AlertScriptMapping';
// import { BoardManagement } from './pages/BoardManagement';  // Disabled - not needed

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <SnackbarProvider 
            maxSnack={3} 
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          >
            <CssBaseline />
            <Router>
              <AuthProvider>
                <SocketProvider>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
                      <Route index element={<Navigate to="/dashboard" replace />} />
                      <Route path="dashboard" element={<Dashboard />} />
                      <Route path="tickets" element={<Tickets />} />
                      <Route path="tickets/new" element={<TicketDetail />} />
                      <Route path="tickets/:id/edit" element={<TicketDetail />} />
                      <Route path="tickets/:id" element={<TicketDetail />} />
                      <Route path="automation" element={<Automation />} />
                      <Route path="automation/rules/new" element={<RuleEditor />} />
                      <Route path="automation/rules/:id" element={<RuleEditor />} />
                      {/* <Route path="automation/designer" element={<AutomationDesigner />} /> */}
                      <Route path="automation/scripts" element={<ScriptManager />} />
                      <Route path="automation/alert-mappings" element={<AlertScriptMapping />} />
            {/* <Route path="alerts" element={<AlertManagement />} /> */}
                      {/* <Route path="boards" element={<BoardManagement />} />  // Disabled - not needed when N-able creates tickets */}
                      <Route path="analytics" element={<Analytics />} />
                      {/* <Route path="reports" element={<Reports />} /> */}
                      <Route path="settings" element={<Settings />} />
                      <Route path="settings/users" element={<Users />} />
                      <Route path="settings/api" element={<ApiConfig />} />
                      {/* <Route path="settings/notifications" element={<NotificationSettings />} /> */}
                      <Route path="audit-log" element={<AuditLog />} />
                    </Route>
                  </Routes>
                </SocketProvider>
              </AuthProvider>
            </Router>
          </SnackbarProvider>
        </LocalizationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;


