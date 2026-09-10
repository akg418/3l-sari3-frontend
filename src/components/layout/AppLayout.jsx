import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header.jsx';
import { ToastViewport } from '../common/ToastViewport.jsx';
import { Footer } from './Footer.jsx';

/**
 * Chrome for every authenticated page. Keying the main element on the route
 * replays the page transition on each navigation.
 *
 * The chat view opts out of the footer: it sizes itself to the viewport so it
 * can own its own scrolling, and anything below it would either be unreachable
 * or squeeze the transcript.
 */
export const AppLayout = ({ flush = false }) => {
  const location = useLocation();

  return (
    <div className="app-shell">
      <Header />
      <ToastViewport />
      <main
        key={location.pathname}
        className={`app-main ${flush ? 'app-main--flush' : ''} animate-page`.trim()}
      >
        <Outlet />
      </main>
      {!flush && <Footer />}
    </div>
  );
};
