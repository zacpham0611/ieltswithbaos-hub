import React from 'react';
import { cleanReadingText } from '../lib/questionNormalizer';

export { cleanReadingText };

/**
 * Parses inline Markdown formatting (**bold**, *italic*) and renders clean React elements
 * without leaking raw asterisks, svgFlag, or unescaped HTML entities into the UI.
 */
export function renderCleanMarkdown(text?: string, fallbackQNum?: number): React.ReactNode {
  if (!text) return null;

  let cleaned = cleanReadingText(text);

  // Strip redundant leading "Question N" or "**Question N**" if question number is already known
  if (fallbackQNum !== undefined) {
    const redundantPrefixRegex = new RegExp(
      `^(?:\\*\\*(?:Question|Câu)\\s*${fallbackQNum}[:\\.]?\\*\\*|(?:Question|Câu)\\s*${fallbackQNum}[:\\.]?)\\s*`,
      'i'
    );
    cleaned = cleaned.replace(redundantPrefixRegex, '').trim();
  }
  cleaned = cleaned.replace(/^\*\*(?:Question|Câu)\s*\d+[:\.]?\*\*\s*/i, '').trim();

  // If no bold/italic markers exist, return plain cleaned string
  if (!/\*\*|\*|__|_/.test(cleaned)) {
    return cleaned;
  }

  // Split text by markdown tokens: **bold**, *italic*, __bold__, _italic_
  // Matching pattern: (\\*\\*[^*]+\\*\\*|\\*[^*]+\\*|__[^_]+__|_[^_]+_)
  const parts = cleaned.split(/(\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|_[^_]+_)/g);

  return parts.map((part, idx) => {
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      const inner = part.slice(2, -2);
      return (
        <strong key={idx} className="font-bold text-slate-900">
          {inner}
        </strong>
      );
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      const inner = part.slice(1, -1);
      return (
        <em key={idx} className="italic">
          {inner}
        </em>
      );
    }
    return part;
  });
}
