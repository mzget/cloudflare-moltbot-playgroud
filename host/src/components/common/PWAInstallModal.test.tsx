import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import PWAInstallModal from './PWAInstallModal';

describe('PWAInstallModal Component', () => {
  it('does not render content when closed', () => {
    const html = renderToString(
      <PWAInstallModal isOpen={false} onClose={vi.fn()} />
    );
    expect(html).not.toContain('ติดตั้ง Oaktree App');
  });

  it('renders instructions for Android/Desktop when open with isIOS=false', () => {
    const html = renderToString(
      <PWAInstallModal isOpen={true} onClose={vi.fn()} isIOS={false} />
    );
    expect(html).toContain('ติดตั้ง Oaktree App');
    expect(html).toContain('วิธีติดตั้งบน Android / Chrome / Edge');
    expect(html).toContain('ติดตั้งแอปทันที');
  });

  it('renders instructions for iOS Safari when open with isIOS=true', () => {
    const html = renderToString(
      <PWAInstallModal isOpen={true} onClose={vi.fn()} isIOS={true} />
    );
    expect(html).toContain('ติดตั้ง Oaktree App');
    expect(html).toContain('วิธีติดตั้งบน iOS Safari');
    expect(html).toContain('แชร์ (Share)');
    expect(html).toContain('เพิ่มไปยังหน้าจอโฮม');
    expect(html).toContain('เข้าใจแล้ว');
  });
});
