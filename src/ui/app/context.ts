import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { AppStore, WindowRole } from '../../application/app-store';
import type { DisplayLink } from '../../application/display-link';
import type { HostController } from '../../application/host-controller';
import type { HostLink } from '../../application/host-link';
import type { MatchAdmin } from '../../application/match-admin';
import type { PinService } from '../../application/pin';
import type { PwaState } from '../../application/pwa';

/** Application services available to the UI; host-only services are absent on the display. */
export interface Services {
  readonly role: WindowRole;
  readonly app: AppStore;
  readonly pwa: PwaState;
  readonly admin: MatchAdmin;
  readonly pin: PinService;
  readonly host?: HostController;
  readonly hostLink?: HostLink;
  readonly display?: DisplayLink;
}

export const ServicesContext = createContext<Services | null>(null);

/** Services from the composition root. */
export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (services === null) throw new Error('useServices must be used inside ServicesContext');
  return services;
}

export interface HostServices extends Services {
  readonly host: HostController;
  readonly hostLink: HostLink;
}

/** Host-window services; host routes are never rendered in the display window. */
export function useHostServices(): HostServices {
  const services = useServices();
  const { host, hostLink } = services;
  if (host === undefined || hostLink === undefined)
    throw new Error('Host services are not available');
  return { ...services, host, hostLink };
}
