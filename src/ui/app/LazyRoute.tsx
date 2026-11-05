import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { commonText } from '../../i18n/catalogues';
import { t } from '../../i18n';
import { Button } from '../design-system/Button';
import { BadgeRing } from '../design-system/BadgeRing';
import { useServices } from './context';
import styles from './LazyRoute.module.css';

type Loader = () => Promise<{ readonly default: ComponentType }>;

const loaded = new Map<string, ComponentType>();

/** Loads a page chunk on first use (Preise, Auswertung, Einstellungen, Spiel, Anzeige). */
export function LazyRoute({ id, load }: { readonly id: string; readonly load: Loader }) {
  const { app } = useServices();
  const [component, setComponent] = useState<ComponentType | undefined>(() => loaded.get(id));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (loaded.has(id)) {
      setComponent(() => loaded.get(id));
      return undefined;
    }
    let active = true;
    load()
      .then((module) => {
        loaded.set(id, module.default);
        if (active) setComponent(() => module.default);
      })
      .catch((error: unknown) => {
        app.platform.reportError(error, `chunk:${id}`);
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [app, id, load]);
  const m = t(commonText);
  if (failed) {
    return (
      <div class={styles.state}>
        <p>{m.errorBoundary.title}</p>
        <Button
          variant="primary"
          onClick={() => {
            window.location.reload();
          }}
        >
          {m.actions.reload}
        </Button>
      </div>
    );
  }
  if (component === undefined) {
    return (
      <div class={styles.state} role="status">
        <span class={styles.spinner}>
          <BadgeRing variant="ring" sweepMs={1200} />
        </span>
        <span>{m.loading}</span>
      </div>
    );
  }
  const Page = component;
  return <Page />;
}
