import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { ProtectedRoute } from './ProtectedRoute.jsx';
import { PublicOnlyRoute } from './PublicOnlyRoute.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';
import { RegisterPage } from '../pages/RegisterPage.jsx';
import { AllChannelsPage } from '../pages/AllChannelsPage.jsx';
import { MyChannelsPage } from '../pages/MyChannelsPage.jsx';
import { ChannelPage } from '../pages/ChannelPage.jsx';
import { NotFoundPage } from '../pages/NotFoundPage.jsx';

export const AppRoutes = () => (
  <Routes>
    <Route element={<PublicOnlyRoute />}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
    </Route>

    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route path="/channels" element={<AllChannelsPage />} />
        <Route path="/my-channels" element={<MyChannelsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* The chat view fills the viewport, so it uses the flush layout. */}
      <Route element={<AppLayout flush />}>
        <Route path="/channels/:channelName" element={<ChannelPage />} />
      </Route>
    </Route>

    <Route path="/" element={<Navigate to="/channels" replace />} />
  </Routes>
);
