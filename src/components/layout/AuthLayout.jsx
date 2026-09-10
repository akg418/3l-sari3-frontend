import { config } from '../../config.js';
import { Footer } from './Footer.jsx';

export const AuthLayout = ({ title, tagline, children, footer }) => (
  <div className="auth-shell">
    <div className="auth-shell__body">
      <div className="card card--padded auth-card">
        <div className="auth-card__head">
          <div className="app-logo app-logo--centred">
            <span className="app-logo__mark" aria-hidden="true">
              3l
            </span>
            <span>{config.appName}</span>
          </div>

          <h1 className="auth-card__title">{title}</h1>
          {tagline && <p className="auth-card__tagline">{tagline}</p>}
        </div>

        {children}

        {footer && <div className="auth-footer">{footer}</div>}
      </div>

      <Footer />
    </div>
  </div>
);
