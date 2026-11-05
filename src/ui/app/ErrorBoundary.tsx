import { Component, type ComponentChildren } from 'preact';
import { commonText } from '../../i18n/catalogues';
import { t } from '../../i18n';
import { Button } from '../design-system/Button';
import { Panel } from '../design-system/Surface';
import { href } from './router';

interface Props {
  readonly onError: (error: unknown) => void;
  /** Changing the key (e.g. the route) resets the boundary. */
  readonly resetKey: string;
  readonly children: ComponentChildren;
}

interface State {
  readonly failed: boolean;
  readonly key: string;
}

/** Route-level error boundary: the UI never goes blank (§9). */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false, key: this.props.resetKey };

  static override getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey === state.key ? null : { failed: false, key: props.resetKey };
  }

  override componentDidCatch(error: unknown): void {
    this.props.onError(error);
    this.setState({ failed: true });
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    const m = t(commonText);
    return (
      <Panel>
        <h1>{m.errorBoundary.title}</h1>
        <p>{m.errorBoundary.body}</p>
        <p>
          <Button
            variant="primary"
            onClick={() => {
              window.location.reload();
            }}
          >
            {m.actions.reload}
          </Button>{' '}
          <a href={href('start')}>{m.errorBoundary.toStart}</a>
        </p>
      </Panel>
    );
  }
}
