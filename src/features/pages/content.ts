import { z } from 'zod';

// A store's information pages: About us and its policies. Shared by the
// dashboard editor, the save action and the storefront.

export const PAGE_SLUGS = [
  'about',
  'shipping',
  'returns',
  'privacy',
  'terms',
] as const;
export type PageSlug = (typeof PAGE_SLUGS)[number];

export function isPageSlug(value: string): value is PageSlug {
  return (PAGE_SLUGS as readonly string[]).includes(value);
}

export const PAGE_INFO: Record<
  PageSlug,
  { title: string; description: string }
> = {
  about: {
    title: 'About us',
    description: 'Your story: who you are and how you make your pieces.',
  },
  shipping: {
    title: 'Shipping',
    description: 'Where you deliver, how long it takes and what it costs.',
  },
  returns: {
    title: 'Returns & exchanges',
    description: 'What can come back, in how many days, and how.',
  },
  privacy: {
    title: 'Privacy policy',
    description: 'What you do with shoppers’ names, phones and addresses.',
  },
  terms: {
    title: 'Terms',
    description: 'Prices, orders, payment and the rules of your shop.',
  },
};

export const MAX_PAGE_BODY = 20_000;

export const pageFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Enter a title')
      .max(80, 'Keep the title under 80 characters'),
    body: z
      .string()
      .trim()
      .max(
        MAX_PAGE_BODY,
        `Keep the page under ${MAX_PAGE_BODY.toLocaleString('en-IN')} characters`,
      ),
    isPublished: z.boolean(),
  })
  .refine((v) => !v.isPublished || v.body !== '', {
    path: ['body'],
    message: 'Write the page before showing it in your store',
  });

export type PageFormValues = z.infer<typeof pageFormSchema>;
export type PageField = keyof PageFormValues;

/** A block of page text, rendered by templates as plain text (no HTML). */
export type ContentBlock =
  { type: 'paragraph'; text: string } | { type: 'list'; items: string[] };

/**
 * Plain text to blocks: a blank line starts a new paragraph, and lines
 * starting with "- " (or "• ") are bullet points. Line breaks inside a
 * paragraph are kept as spaces.
 */
export function toBlocks(body: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      blocks.push({ type: 'list', items: list });
      list = [];
    }
  };
  for (const raw of body.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    const bullet = /^[-•*]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      if (bullet[1]) list.push(bullet[1]);
    } else if (line === '') {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

/** Parts of a sample the merchant still has to fill in, e.g. "[7 days]". */
export function placeholdersIn(body: string): string[] {
  return [...new Set(body.match(/\[[^\]\n]{1,60}\]/g) ?? [])];
}

/**
 * Starting text for each page, for Indian shops that take orders on
 * WhatsApp. The merchant edits it; the parts in [brackets] are theirs to
 * fill in. Not legal advice.
 */
export const SAMPLE_PAGES: Record<PageSlug, string> = {
  about: `[Store name] began in [year] in [city] with a simple idea: [what you set out to do].

Today we work with [number] weavers and artisans across [regions]. Every piece is checked by hand before it reaches you.

- [What makes your pieces special]
- [How they are made]
- [Why customers come back]

Write to us on WhatsApp any time. We would love to help you find the right piece.`,

  shipping: `We deliver across India. Orders are confirmed with you on WhatsApp, and we share the tracking details once your parcel is on its way.

- Dispatch: within [2–3] working days of payment.
- Delivery: usually [4–7] working days after dispatch, depending on your PIN code.
- Shipping charges: free on orders above ₹[5,000]; otherwise ₹[100], shown before you pay.
- Made-to-order or customised pieces take [10–15] days to prepare.

We currently do not ship outside India. For urgent orders, message us before ordering and we will try our best.`,

  returns: `We want you to love what you buy. If something is not right, write to us on WhatsApp within [3] days of delivery with your order number and a photo.

- Exchanges and returns are accepted within [7] days of delivery for unused pieces with their tags.
- Customised, altered, stitched-to-measure and sale pieces cannot be returned.
- Handloom pieces may have small irregularities in weave and colour. These are part of their character and are not defects.
- If a piece arrives damaged, tell us within [48 hours] with an unboxing video and we will replace it or refund you in full.

Refunds go back to the original payment method within [7] working days of us receiving the piece. Return shipping is [paid by us / paid by you] unless the piece was damaged.`,

  privacy: `This policy explains what [Store name] does with the details you share with us.

When you order, we collect your name, phone number and delivery address. We use them only to confirm your order on WhatsApp, deliver it and help you afterwards.

- We do not sell or rent your details to anyone.
- We share your address and phone only with our courier, to deliver your order.
- Payments are handled by your bank or payment app; we never see your card or UPI PIN.
- We keep order records for [as long as the law requires] and then delete them.

You can ask us to see, correct or delete your details at any time by writing to [email or WhatsApp number].`,

  terms: `These terms apply to orders placed with [Store name].

- Prices are in Indian rupees and include [GST / taxes as applicable].
- Your order is confirmed only when we confirm availability and payment with you on WhatsApp.
- Colours may look slightly different on screen than in person, especially for handloom and silk.
- We may cancel an order if a piece is no longer available; any payment is then refunded in full.
- Shipping, returns and exchanges follow our Shipping and Returns pages.

These terms are governed by the laws of India, and any dispute is subject to the courts of [city].`,
};
