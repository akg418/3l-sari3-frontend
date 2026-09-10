import { config } from '../../config.js';

/**
 * Site footer: attribution and the year.
 *
 * The year is read at render rather than hardcoded, so the notice does not
 * quietly go stale in January.
 */
export const Footer = () => (
  <footer className="app-footer">
    <p className="app-footer__line">
      <span aria-hidden="true">&copy;</span> {new Date().getFullYear()} {config.appName}. All
      rights reserved.
    </p>

    <p className="app-footer__line">
      Built by{' '}
      <a
        className="app-footer__link"
        href={config.author.portfolioUrl}
        target="_blank"
        // noreferrer implies noopener, but both are spelled out so the intent
        // survives someone trimming one of them later.
        rel="noopener noreferrer"
      >
        {config.author.portfolioLabel}
      </a>
    </p>
  </footer>
);
