import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { FederatedErrorBoundary } from './FederatedErrorBoundary';
import { RemoteFinanceContainer } from './RemoteFinanceContainer';

describe('Empirical Adversarial Verification: FederatedErrorBoundary & Remote Loader', () => {
  it('1. verifies normal rendering when no error occurs', () => {
    const html = renderToString(
      <FederatedErrorBoundary>
        <div data-testid="remote-content">Remote Finance Content Loaded</div>
      </FederatedErrorBoundary>
    );
    expect(html).toContain('Remote Finance Content Loaded');
    expect(html).not.toContain('Simplicity Finance Unavailable');
  });

  it('2. simulates network failure / unreachable remoteEntry.js and verifies fallback UI', () => {
    const networkError = new TypeError('Failed to fetch dynamically imported module: http://localhost:5173/assets/remoteEntry.js');
    
    // Simulate error transition via getDerivedStateFromError
    const errorState = FederatedErrorBoundary.getDerivedStateFromError(networkError);
    expect(errorState.hasError).toBe(true);
    expect(errorState.error).toBe(networkError);

    // Instantiate and inject error state
    const boundary = new FederatedErrorBoundary({
      children: <div>Should not render</div>,
    });
    boundary.state = errorState;

    const rendered = boundary.render();
    const html = renderToString(rendered as React.ReactElement);

    // Verify fallback UI elements
    expect(html).toContain('Simplicity Finance Unavailable');
    expect(html).toContain('Unable to connect to the Simplicity Finance remote application');
    expect(html).toContain('http://localhost:5173');
    expect(html).toContain('Failed to fetch dynamically imported module');
    expect(html).toContain('Retry Connection');
    expect(html).not.toContain('Should not render');
  });

  it('3. verifies Retry Connection triggers recovery callback and resets error state', () => {
    const onRetryMock = vi.fn();
    const boundary = new FederatedErrorBoundary({
      children: <div>Recovered Content</div>,
      onRetry: onRetryMock,
    });

    // Simulate error state
    boundary.state = {
      hasError: true,
      error: new Error('Network timeout loading remoteEntry.js'),
    };

    let updatedState: any = null;
    boundary.setState = vi.fn((state) => {
      updatedState = typeof state === 'function' ? state(boundary.state) : state;
    });

    // Trigger handleRetry
    boundary.handleRetry();

    expect(updatedState).toEqual({ hasError: false, error: null });
    expect(onRetryMock).toHaveBeenCalledTimes(1);
  });

  it('4. verifies safe execution when onRetry prop is undefined', () => {
    const boundary = new FederatedErrorBoundary({
      children: <div>Content</div>,
    });
    boundary.state = { hasError: true, error: new Error('Remote offline') };
    boundary.setState = vi.fn();

    // Calling handleRetry without onRetry prop should NOT throw
    expect(() => boundary.handleRetry()).not.toThrow();
  });

  it('5. verifies custom fallback override prop if provided', () => {
    const customFallback = <div data-testid="custom-fallback">Custom Service Fallback</div>;
    const boundary = new FederatedErrorBoundary({
      children: <div>Normal</div>,
      fallback: customFallback,
    });
    boundary.state = { hasError: true, error: new Error('Offline') };

    const rendered = boundary.render();
    const html = renderToString(rendered as React.ReactElement);

    expect(html).toContain('Custom Service Fallback');
    expect(html).not.toContain('Simplicity Finance Unavailable');
  });

  it('6. verifies SSG prerender safety: RemoteFinanceContainer returns null when window is undefined', () => {
    // In node/SSR environment where window === undefined, verify null return
    // Temporarily ensure global.window is undefined
    const originalWindow = (globalThis as any).window;
    try {
      delete (globalThis as any).window;

      const result = RemoteFinanceContainer({});
      expect(result).toBeNull();
    } finally {
      if (originalWindow !== undefined) {
        (globalThis as any).window = originalWindow;
      }
    }
  });
});
