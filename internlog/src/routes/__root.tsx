import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { CookieConsent } from '../components/cookie-consent';
import '../styles/app.css';

export const Route = createRootRoute({
  head: () => ({ meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }, { title: 'InternLog | MUST' }, { name: 'description', content: 'Internships, placements and student progress at MUST.' }] }),
  component: RootLayout,
});

function RootLayout(): React.JSX.Element {
  return <html lang="en"><head><HeadContent /></head><body><Outlet /><CookieConsent /><Scripts /></body></html>;
}
