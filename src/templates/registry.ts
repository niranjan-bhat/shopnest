import type { TemplateDefinition } from './contract';
import { silkTemplate } from './silk/manifest';

/** Every template that ships with the app, by key. */
export const templates: Record<string, TemplateDefinition> = {
  [silkTemplate.key]: silkTemplate,
};

export const DEFAULT_TEMPLATE_KEY = silkTemplate.key;

/** Looks up a template; unknown keys fall back to the default template. */
export function getTemplate(key: string): TemplateDefinition {
  return templates[key] ?? templates[DEFAULT_TEMPLATE_KEY]!;
}
