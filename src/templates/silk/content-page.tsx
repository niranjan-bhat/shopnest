import type { ContentPageProps } from '../contract';
import { SectionHeading } from './section-heading';

/** About us and policy pages: the merchant's text as paragraphs and lists. */
export function SilkContentPage({ page }: ContentPageProps) {
  return (
    <article className="mx-auto max-w-2xl px-4 pt-10 md:px-8">
      <SectionHeading as="h1" title={page.title} className="mb-12" />
      <div className="space-y-6 text-lg leading-relaxed">
        {page.blocks.map((block, i) =>
          block.type === 'paragraph' ? (
            <p key={i}>{block.text}</p>
          ) : (
            <ul
              key={i}
              className="list-disc space-y-2 pl-6 marker:text-store-accent"
            >
              {block.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          ),
        )}
      </div>
    </article>
  );
}
