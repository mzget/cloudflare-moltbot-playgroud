import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import RoutesLayout from './RoutesLayout';

let currentPathname = '/about';

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => ({ pathname: currentPathname }),
  useSearch: () => ({ symbol: undefined, tab: undefined }),
  useNavigate: () => vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => `i18n:${key}`,
  }),
}));

vi.mock('@mui/joy/styles', () => ({
  useColorScheme: () => ({
    mode: 'dark',
    setMode: vi.fn(),
  }),
}));

vi.mock('../../store/settingsStore', () => ({
  useSettingsStore: (selector: (state: any) => any) => selector({ theme: 'dark' }),
}));

vi.mock('../../store/intelligenceStore', () => ({
  useIntelligenceStore: () => ({
    reports: [],
    digests: [],
    fetchReports: vi.fn(),
  }),
}));

vi.mock('./Header', () => ({
  default: () => <div data-testid="header">Header</div>,
}));

vi.mock('./Sidebar', () => ({
  default: () => <div data-testid="sidebar">Sidebar</div>,
}));

describe('RoutesLayout - Route Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders about screen correctly without errors when on /about route', () => {
    currentPathname = '/about';
    const html = renderToString(<RoutesLayout />);
    
    // Check that about content (title, description, footer) is rendered
    expect(html).toContain('i18n:about.title');
    expect(html).toContain('i18n:about.description');
    expect(html).toContain('i18n:about.footer');
  });

  it('renders dashboard by default when on root / route', () => {
    currentPathname = '/';
    const html = renderToString(<RoutesLayout />);
    
    // Should not render about content
    expect(html).not.toContain('i18n:about.title');
  });

  it('renders prompt when on /analysis without symbol', () => {
    currentPathname = '/analysis';
    const html = renderToString(<RoutesLayout />);
    
    expect(html).toContain('กรุณาระบุสัญลักษณ์หุ้นที่ต้องการวิเคราะห์');
  });
});
