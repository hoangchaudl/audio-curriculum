import React, { Suspense, lazy } from 'react';
import type { Options } from 'react-markdown';
import { TEXT_COLORS } from '../components/assessment/ui';

// Operations' own Markdown renderer: like the Training Program's <Md>, plus
// GitHub-style tables (remark-gfm), which pasted Google Docs often contain.
// Kept separate so the Training Program's rendering doesn't change.
// Loaded with the first document shown, not with the app.
const Markdown = lazy(async () => {
  const [{ default: ReactMarkdown }, { default: remarkGfm }] = await Promise.all([import('react-markdown'), import('remark-gfm')]);
  return { default: (props: Options) => <ReactMarkdown remarkPlugins={[remarkGfm]} {...props} /> };
});

const STYLE = [
  'text-[15px] md:text-base text-gray-800 leading-7 space-y-3 max-w-[72ch]',
  '[&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-gray-900 [&_h1]:pt-4 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:pt-3 [&_h3]:font-semibold [&_h3]:text-gray-900',
  '[&_h1]:scroll-mt-4 [&_h2]:scroll-mt-4 [&_h3]:scroll-mt-4',
  '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-[#176BBA] dark:[&_a]:text-[#6CB8FF] [&_a]:underline [&_a]:underline-offset-2 [&_strong]:text-gray-900',
  '[&_blockquote]:bg-sky [&_blockquote]:text-navy [&_blockquote]:rounded-2xl [&_blockquote]:px-4 [&_blockquote]:py-3 [&_blockquote]:border-l-4 [&_blockquote]:border-[#2E9DF7] [&_hr]:border-gray-200 [&_hr]:my-4',
  '[&_table]:w-full [&_table]:text-left [&_table]:border-collapse [&_table]:text-sm [&_th]:bg-gray-50 [&_th]:text-gray-900 [&_th]:font-semibold [&_th]:px-3 [&_th]:py-2 [&_th]:align-top',
  '[&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_td]:border-t [&_td]:border-gray-100 [&_tr:nth-child(even)_td]:bg-gray-50',
].join(' ');

export const OpsMarkdown: React.FC<{ children: string }> = ({ children }) => (
  <div className={STYLE}>
    <Suspense fallback={<p className="whitespace-pre-wrap">{children}</p>}>
      <Markdown
        components={{
          // Wide tables scroll inside the card instead of widening the page.
          table: ({ node: _node, ...props }) => <div className="overflow-x-auto rounded-2xl border border-gray-100"><table {...props} /></div>,
          a: ({ node: _node, href, ...props }) => {
            const color = href?.match(/^#color-(\w+)$/)?.[1];
            if (color) return <span className={`${TEXT_COLORS[color] ?? ''} font-semibold`}>{props.children}</span>;
            return <a href={href} {...props} target="_blank" rel="noreferrer" />;
          },
        }}
      >
        {children}
      </Markdown>
    </Suspense>
  </div>
);
