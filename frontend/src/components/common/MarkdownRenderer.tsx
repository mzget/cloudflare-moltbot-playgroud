import React from 'react';
import { Box, Typography } from '@mui/joy';

interface MarkdownRendererProps {
  text: string;
  themeColor?: 'primary' | 'neutral';
}

export const parseInline = (text: string, themeColor: 'primary' | 'neutral' = 'neutral'): React.ReactNode[] => {
  // Matches:
  // 1. span tag: <span style="...">...</span>
  // 2. bold tag: **...** or __...__
  // 3. inline code: `...`
  // 4. link tag: [text](url)
  const regex = /(<span\s+style="([^"]+)">([\s\S]*?)<\/span>|\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/gi;
  const parts = text.split(regex);
  
  const result: React.ReactNode[] = [];
  // step size is 1 non-match + 8 capturing groups = 9 elements
  for (let idx = 0; idx < parts.length; idx += 9) {
    const regularText = parts[idx];
    if (regularText) {
      result.push(regularText);
    }
    
    if (idx + 1 < parts.length) {
      const styleAttr = parts[idx + 2];
      const spanInner = parts[idx + 3];
      const boldInner1 = parts[idx + 4];
      const boldInner2 = parts[idx + 5];
      const codeInner = parts[idx + 6];
      const linkText = parts[idx + 7];
      const linkUrl = parts[idx + 8];
      
      const boldInner = boldInner1 || boldInner2;
      
      if (boldInner !== undefined) {
        result.push(
          <strong key={idx} style={{ fontWeight: 700, color: themeColor === 'primary' ? 'inherit' : '#10b981' }}>
            {boldInner}
          </strong>
        );
      } else if (spanInner !== undefined) {
        const styleObj: React.CSSProperties = {};
        if (styleAttr) {
          const styles = styleAttr.split(';');
          styles.forEach(s => {
            const [k, v] = s.split(':');
            if (k && v) {
              const key = k.trim().replace(/-./g, x => x[1].toUpperCase()) as keyof React.CSSProperties;
              (styleObj as any)[key] = v.trim();
            }
          });
        }
        result.push(
          <span key={idx} style={styleObj}>
            {parseInline(spanInner, themeColor)}
          </span>
        );
      } else if (codeInner !== undefined) {
        result.push(
          <code key={idx} style={{ 
            fontFamily: 'monospace', 
            backgroundColor: 'rgba(0,0,0,0.1)', 
            padding: '2px 4px', 
            borderRadius: '4px',
            fontSize: '0.9em' 
          }}>
            {codeInner}
          </code>
        );
      } else if (linkText !== undefined && linkUrl !== undefined) {
        result.push(
          <a key={idx} href={linkUrl} target="_blank" rel="noopener noreferrer" style={{
            color: 'var(--joy-palette-primary-plainColor, #096bde)',
            textDecoration: 'underline'
          }}>
            {linkText}
          </a>
        );
      }
    }
  }
  return result;
};

export function renderMarkdown(md: string, themeColor: 'primary' | 'neutral' = 'neutral'): React.ReactNode[] {
  const lines = md.split('\n');
  const elements: React.ReactNode[] = [];
  
  let inList = false;
  let listItems: React.ReactNode[] = [];
  let isNumberedList = false;
  
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];
  let tableAlignments: ('left' | 'center' | 'right')[] = [];
  
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let codeBlockLang = '';

  const flushList = (key: string | number) => {
    if (listItems.length > 0) {
      const listTag = isNumberedList ? 'ol' : 'ul';
      elements.push(
        <Box component={listTag} key={`list-${key}`} sx={{ pl: 3, my: 1.5, color: themeColor === 'primary' ? 'inherit' : 'text.primary' }}>
          {listItems}
        </Box>
      );
      listItems = [];
      inList = false;
    }
  };

  const flushTable = (key: string | number) => {
    if (tableRows.length > 0 || tableHeaders.length > 0) {
      elements.push(
        <Box key={`table-wrapper-${key}`} sx={{ overflowX: 'auto', my: 2, borderRadius: '8px', border: '1px solid', borderColor: 'divider' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            {tableHeaders.length > 0 && (
              <thead>
                <tr style={{ backgroundColor: 'var(--joy-palette-background-level1, rgba(255,255,255,0.05))', borderBottom: '1px solid var(--joy-palette-divider)' }}>
                  {tableHeaders.map((th, idx) => {
                    const align = tableAlignments[idx] || 'left';
                    return (
                      <th key={`th-${idx}`} style={{ padding: '10px 14px', fontSize: '14px', fontWeight: 600, textAlign: align, color: themeColor === 'primary' ? '#fff' : 'var(--joy-palette-text-primary)' }}>
                        {parseInline(th, themeColor)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
            )}
            <tbody>
              {tableRows.map((row, rowIdx) => (
                <tr key={`tr-${rowIdx}`} style={{ borderBottom: '1px solid var(--joy-palette-divider)' }}>
                  {row.map((cell, cellIdx) => {
                    const align = tableAlignments[cellIdx] || 'left';
                    return (
                      <td key={`td-${cellIdx}`} style={{ padding: '10px 14px', fontSize: '14px', color: themeColor === 'primary' ? 'rgba(255,255,255,0.9)' : 'var(--joy-palette-text-secondary)', textAlign: align }}>
                        {parseInline(cell, themeColor)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      );
      tableRows = [];
      tableHeaders = [];
      tableAlignments = [];
      inTable = false;
    }
  };

  const flushCodeBlock = (key: string | number) => {
    if (inCodeBlock) {
      elements.push(
        <Box key={`code-${key}`} sx={{ 
          my: 2, 
          p: 2, 
          bgcolor: 'rgba(0,0,0,0.2)', 
          borderRadius: '8px', 
          border: '1px solid',
          borderColor: 'divider',
          fontFamily: 'monospace',
          fontSize: '13px',
          whiteSpace: 'pre',
          overflowX: 'auto',
          color: '#e2e8f0'
        }}>
          {codeBlockLines.join('\n')}
        </Box>
      );
      codeBlockLines = [];
      inCodeBlock = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Code block parser
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        flushCodeBlock(i);
      } else {
        flushList(i);
        flushTable(i);
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    // Horizontal rule
    if (line === '---' || line === '***' || line === '___') {
      flushList(i);
      flushTable(i);
      elements.push(
        <Box component="hr" key={i} sx={{ my: 2, border: 0, borderTop: '1px solid', borderColor: 'divider' }} />
      );
      continue;
    }

    // Tables
    if (line.startsWith('|')) {
      flushList(i);
      
      const cells = line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      const isSeparator = cells.every(c => c.replace(/[:-\s]/g, '') === '');
      
      if (isSeparator) {
        tableAlignments = cells.map(c => {
          const left = c.startsWith(':');
          const right = c.endsWith(':');
          if (left && right) return 'center';
          if (right) return 'right';
          return 'left';
        });
        continue;
      }
      
      if (!inTable) {
        inTable = true;
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else {
      flushTable(i);
    }

    // Lists
    const listMatch = line.match(/^([*\-+])\s+(.*)/);
    const numListMatch = line.match(/^(\d+)\.\s+(.*)/);
    
    if (listMatch) {
      const content = listMatch[2];
      if (!inList || isNumberedList) {
        flushList(i);
        inList = true;
        isNumberedList = false;
      }
      listItems.push(
        <Box component="li" key={`li-${i}`} sx={{ my: 0.5 }}>
          {parseInline(content, themeColor)}
        </Box>
      );
      continue;
    } else if (numListMatch) {
      const content = numListMatch[2];
      if (!inList || !isNumberedList) {
        flushList(i);
        inList = true;
        isNumberedList = true;
      }
      listItems.push(
        <Box component="li" key={`li-${i}`} sx={{ my: 0.5 }}>
          {parseInline(content, themeColor)}
        </Box>
      );
      continue;
    } else {
      flushList(i);
    }

    // Headers
    if (line.startsWith('# ')) {
      elements.push(
        <Typography level="h2" key={i} sx={{ mt: 3, mb: 1.5, fontWeight: 800, color: themeColor === 'primary' ? 'inherit' : 'text.primary', borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
          {parseInline(line.substring(2), themeColor)}
        </Typography>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <Typography level="h3" key={i} sx={{ mt: 2.5, mb: 1, fontWeight: 700, color: themeColor === 'primary' ? 'inherit' : 'text.primary' }}>
          {parseInline(line.substring(3), themeColor)}
        </Typography>
      );
    } else if (line.startsWith('### ')) {
      elements.push(
        <Typography level="title-lg" key={i} sx={{ mt: 2, mb: 0.5, fontWeight: 600, color: themeColor === 'primary' ? 'inherit' : 'text.primary' }}>
          {parseInline(line.substring(4), themeColor)}
        </Typography>
      );
    } else if (line.startsWith('#### ')) {
      elements.push(
        <Typography level="title-md" key={i} sx={{ mt: 1.5, mb: 0.5, fontWeight: 600, color: themeColor === 'primary' ? 'inherit' : 'text.primary' }}>
          {parseInline(line.substring(5), themeColor)}
        </Typography>
      );
    } else if (line.startsWith('> ')) {
      elements.push(
        <Box key={i} sx={{ 
          borderLeft: '4px solid', 
          borderColor: 'success.solidBg', 
          pl: 2, 
          my: 2, 
          py: 0.5, 
          bgcolor: themeColor === 'primary' ? 'rgba(255,255,255,0.1)' : 'background.level1', 
          borderRadius: '0 8px 8px 0' 
        }}>
          <Typography level="body-md" sx={{ fontStyle: 'italic', color: themeColor === 'primary' ? 'inherit' : 'text.secondary' }}>
            {parseInline(line.substring(2), themeColor)}
          </Typography>
        </Box>
      );
    } else if (line === '') {
      continue;
    } else {
      elements.push(
        <Typography level="body-md" key={i} sx={{ mb: 1.5, lineHeight: 1.7, color: themeColor === 'primary' ? 'inherit' : 'text.primary' }}>
          {parseInline(line, themeColor)}
        </Typography>
      );
    }
  }

  flushList('end');
  flushTable('end');
  flushCodeBlock('end');

  return elements;
}

export default function MarkdownRenderer({ text, themeColor = 'neutral' }: MarkdownRendererProps) {
  return <>{renderMarkdown(text, themeColor)}</>;
}
