import { t } from '../../../i18n';
import { useHostServices } from '../../app/context';
import { AboutSection } from './AboutSection';
import { DataSection } from './DataSection';
import { EventForm } from './EventForm';
import { EventsSection } from './EventsSection';
import { settingsText } from './messages';
import { PinSection } from './PinSection';
import { PresentationSection } from './PresentationSection';
import { focusSection, type SectionId } from './Section';
import styles from './Settings.module.css';

const SECTIONS: readonly SectionId[] = ['events', 'event', 'presentation', 'data', 'pin', 'about'];

/** Einstellungen (FR-9): events, event settings, presentation, data, PIN and about. */
export default function SettingsPage() {
  const m = t(settingsText);
  const { hostLink } = useHostServices();
  const canEdit = hostLink.control.value === 'CONTROLLING';
  return (
    <div class={styles.page}>
      <nav class={styles.toc} aria-label={m.sectionsLabel}>
        <h1 class={styles.tocTitle}>{m.title}</h1>
        <ul class={styles.tocList}>
          {SECTIONS.map((id) => (
            <li key={id}>
              <button
                type="button"
                class={styles.tocButton}
                onClick={() => {
                  focusSection(id);
                }}
              >
                {m.sections[id]}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div class={styles.sections}>
        {!canEdit && (
          <p class={styles.notice} role="status">
            {m.readOnly}
          </p>
        )}
        <EventsSection canEdit={canEdit} />
        <EventForm canEdit={canEdit} />
        <PresentationSection canEdit={canEdit} />
        <DataSection canEdit={canEdit} />
        <PinSection canEdit={canEdit} />
        <AboutSection />
      </div>
    </div>
  );
}
