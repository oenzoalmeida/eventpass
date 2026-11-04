import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

it('releases a camera stream that arrives after the scanner is closed', async () => {
  const stop = vi.fn();
  let grantCamera!: (stream: MediaStream) => void;
  const getUserMedia = vi.fn(
    () => new Promise<MediaStream>((resolve) => { grantCamera = resolve; }),
  );
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  });
  vi.stubGlobal('BarcodeDetector', class {
    detect() { return Promise.resolve([]); }
  });

  // Import after stubbing: camera feature detection happens at module load.
  const { QrScanner } = await import('./QrScanner');
  const onScan = vi.fn();
  const view = render(<QrScanner onScan={onScan} paused={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'Ligar câmera' }));
  expect(getUserMedia).toHaveBeenCalledTimes(1);

  view.unmount();
  await act(async () => {
    grantCamera({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    await Promise.resolve();
  });

  expect(stop).toHaveBeenCalledTimes(1);
  expect(onScan).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
