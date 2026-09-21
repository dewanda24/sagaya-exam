'use client';

import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathRendererProps {
  text: string;
  className?: string;
}

/**
 * MathRenderer parses and renders mixed text containing LaTeX formulas:
 * - Block math: $$ ... $$
 * - Inline math: $ ... $ or \( ... \)
 */
export default function MathRenderer({ text, className = '' }: MathRendererProps) {
  const renderedContent = useMemo(() => {
    if (!text) return '';

    // If no math indicators, return original
    if (!text.includes('$') && !text.includes('\\(')) {
      return null;
    }

    try {
      // Replace block math $$formula$$
      let processed = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
        try {
          return `<div class="my-2 overflow-x-auto text-center">${katex.renderToString(math.trim(), {
            displayMode: true,
            throwOnError: false,
          })}</div>`;
        } catch {
          return `$$${math}$$`;
        }
      });

      // Replace inline math $formula$ (ignoring escaped \$)
      processed = processed.replace(/(?<!\\)\$([^$\n]+?)\$/g, (_, math) => {
        try {
          return `<span class="inline-math mx-0.5">${katex.renderToString(math.trim(), {
            displayMode: false,
            throwOnError: false,
          })}</span>`;
        } catch {
          return `$${math}$`;
        }
      });

      return processed;
    } catch {
      return null;
    }
  }, [text]);

  if (!renderedContent) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  );
}
