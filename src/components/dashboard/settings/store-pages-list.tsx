import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PAGE_INFO } from '@/features/pages/content';
import type { EditablePage } from '@/features/pages/dashboard';

function status(page: EditablePage) {
  if (page.isPublished) return { label: 'Shown', variant: 'default' as const };
  if (page.saved && page.body) {
    return { label: 'Hidden', variant: 'secondary' as const };
  }
  return { label: 'Not written', variant: 'outline' as const };
}

/** The store's information pages, each linking to its editor. */
export function StorePagesList({ pages }: { pages: EditablePage[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pages</CardTitle>
        <p className="text-sm text-muted-foreground">
          About us and your policies, linked from your store&apos;s footer.
          Shoppers look for these before they buy.
        </p>
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-lg border" aria-label="Pages">
          {pages.map((page) => {
            const { label, variant } = status(page);
            return (
              <li key={page.slug}>
                <Link
                  href={`/dashboard/settings/pages/${page.slug}`}
                  className="flex items-center gap-3 p-3 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="grid min-w-0 flex-1">
                    <span className="font-medium">{page.title}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      {PAGE_INFO[page.slug].description}
                    </span>
                  </span>
                  <Badge variant={variant}>{label}</Badge>
                  <ChevronRight
                    aria-hidden
                    className="size-4 text-muted-foreground"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
