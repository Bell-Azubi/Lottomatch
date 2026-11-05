import { render } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { Drum } from './Drum';

describe('Drum', () => {
  it('animates tumbling balls on the canvas while mounted and stops on unmount', () => {
    const gradient = { addColorStop: vi.fn() };
    const context = {
      clearRect: vi.fn(),
      createRadialGradient: vi.fn(() => gradient),
      createLinearGradient: vi.fn(() => gradient),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      frames.push(callback),
    );
    const cancel = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cancel);
    const view = render(<Drum seed={42} />);
    frames.shift()?.(performance.now() + 16);
    frames.shift()?.(performance.now() + 32);
    expect(context.arc.mock.calls.length).toBeGreaterThan(28);
    expect(context.createRadialGradient).toHaveBeenCalled();
    view.unmount();
    expect(cancel).toHaveBeenCalled();
  });
});
