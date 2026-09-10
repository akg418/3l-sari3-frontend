import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ChannelsProvider } from './context/ChannelsContext.jsx';
import { RealtimeProvider } from './context/RealtimeContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { AppRoutes } from './routes/AppRoutes.jsx';

/**
 * Provider order matters: toasts are needed by everything, the socket needs
 * the session, and the channel directory needs the socket to stay live.
 */
const App = () => (
  <BrowserRouter>
    <ToastProvider>
      <AuthProvider>
        <RealtimeProvider>
          <ChannelsProvider>
            <AppRoutes />
          </ChannelsProvider>
        </RealtimeProvider>
      </AuthProvider>
    </ToastProvider>
  </BrowserRouter>
);

export default App;
