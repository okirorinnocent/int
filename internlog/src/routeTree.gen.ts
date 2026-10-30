/* eslint-disable */
// Generated route tree for the initial foundation. Regenerate with the TanStack router tooling when routes change.
import { Route as rootRoute } from './routes/__root';
import { Route as indexRouteImport } from './routes/index';
import { Route as authRouteImport } from './routes/auth';
import { Route as privacyRouteImport } from './routes/privacy';
import { Route as termsRouteImport } from './routes/terms';
const indexRoute = indexRouteImport.update({ id: '/', path: '/', getParentRoute: () => rootRoute } as never);
const authRoute = authRouteImport.update({ id: '/auth', path: '/auth', getParentRoute: () => rootRoute } as never);
const privacyRoute = privacyRouteImport.update({ id: '/privacy', path: '/privacy', getParentRoute: () => rootRoute } as never);
const termsRoute = termsRouteImport.update({ id: '/terms', path: '/terms', getParentRoute: () => rootRoute } as never);
export const routeTree = rootRoute._addFileChildren({ indexRoute, authRoute, privacyRoute, termsRoute });
