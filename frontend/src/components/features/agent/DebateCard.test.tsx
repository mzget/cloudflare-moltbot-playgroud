import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { DialecticalDebateData } from './DebateCard';
import DebateCard from './DebateCard';

const mockDebate: DialecticalDebateData = {
  symbol: 'ARM',
  round1: {
    bull: {
      bull_thesis: 'Leading CPU architecture for AI era',
      growth_catalysts: ['v9 royalty surge', 'Compute subsystem adoption'],
      competitive_advantages: ['Ubiquitous ecosystem', 'Unmatched power efficiency'],
      valuation_upside: 'Fair value with upside margin'
    },
    bear: {
      bear_thesis: 'High valuation multiple amidst smartphone slowdown',
      downside_risks: ['Smartphone cycle softness', 'RISC-V competition'],
      structural_headwinds: ['Custom silicon insourcing'],
      valuation_stretch: 'P/E multiple elevated'
    }
  },
  round2_rebuttal: {
    bull_rebuttal: {
      rebuttal_arguments: ['Data center market share doubling', 'CSS licensing higher margin'],
      mitigating_factors: ['v9 ASP 2x higher than v8']
    },
    bear_rebuttal: {
      rebuttal_arguments: ['RISC-V gains ground in IoT', 'China revenue risks remain'],
      skeptical_counters: ['Customer concentration risk with major hyperscalers']
    }
  },
  synthesis: {
    key_tensions: [
      {
        topic: 'Architecture Lock-in vs Open Source Alternatives',
        bull_argument: 'ARM ecosystem tooling is irreplaceable for mobile and automotive',
        bear_argument: 'RISC-V architecture is accelerating adoption in edge AI',
        decisive_factor: 'Software ecosystem maturity'
      }
    ],
    consensus_points: ['World-class power efficiency leadership'],
    conviction_score: 4,
    conviction_label: 'Moderate Bull',
    verdict_summary: 'Solid architectural moat with strong momentum in server and edge AI.'
  },
  model_used: 'gemini-1.5-pro',
  created_at: '2026-11-04 10:00:00',
  updated_at: '2026-11-05 14:00:00'
};

describe('DebateCard Component', () => {
  it('renders "วิเคราะห์ล่าสุดเมื่อ" with updated_at when provided', () => {
    const html = renderToString(
      <DebateCard
        symbol="ARM"
        initialDebate={mockDebate}
      />
    );

    expect(html).toContain('Dialectical Market Debate: Bull vs. Bear');
    expect(html).toContain('วิเคราะห์ล่าสุดเมื่อ:');
    expect(html).toContain('2026-11-05 14:00:00');
    expect(html).toContain('Moderate Bull');
    expect(html).toContain('+4');
  });

  it('falls back to created_at if updated_at is undefined', () => {
    const debateWithCreatedAtOnly: DialecticalDebateData = {
      ...mockDebate,
      updated_at: undefined,
      created_at: '2026-11-04 10:00:00'
    };

    const html = renderToString(
      <DebateCard
        symbol="ARM"
        initialDebate={debateWithCreatedAtOnly}
      />
    );

    expect(html).toContain('วิเคราะห์ล่าสุดเมื่อ:');
    expect(html).toContain('2026-11-04 10:00:00');
  });

  it('omits "วิเคราะห์ล่าสุดเมื่อ" when neither updated_at nor created_at is present', () => {
    const debateNoTimestamp: DialecticalDebateData = {
      ...mockDebate,
      updated_at: undefined,
      created_at: undefined
    };

    const html = renderToString(
      <DebateCard
        symbol="ARM"
        initialDebate={debateNoTimestamp}
      />
    );

    expect(html).toContain('Dialectical Market Debate: Bull vs. Bear');
    expect(html).not.toContain('วิเคราะห์ล่าสุดเมื่อ:');
  });

  it('renders fallback prompt and copy button when initialDebate is null', () => {
    const html = renderToString(
      <DebateCard
        symbol="NVDA"
        initialDebate={null}
      />
    );

    expect(html).toContain('ยังไม่มีข้อมูลการโต้วาทีสองขั้วสำหรับหุ้น');
    expect(html).toContain('NVDA');
    expect(html).toContain('Copy Gemini Prompt');
    expect(html).not.toContain('วิเคราะห์ล่าสุดเมื่อ:');
  });
});
