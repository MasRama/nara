import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'vue/compiler-sfc';

/**
 * Interface text lives in Feature or app dictionaries, never inline in a
 * template, so a new page cannot quietly ship in one language. Code samples
 * (`code`, `pre`, `kbd`, `samp`) and content marked with the standard HTML
 * `translate="no"` attribute (brand names, paths, commands) stay literal.
 */
const root = process.cwd();
const SCANNED = ['src/app', 'src/features', 'src/shared', 'official-features'];
const VERBATIM_ELEMENTS = new Set(['code', 'pre', 'kbd', 'samp', 'script', 'style', 'svg']);
const TEXT_ATTRIBUTES = new Set(['aria-label', 'placeholder', 'title', 'alt', 'label', 'nav-label', 'heading', 'highlight', 'description']);
/** The language picker's own label reads the same in every locale. */
const ALLOWED = new Set(['Language / Bahasa']);
const LETTER = /\p{L}/u;

interface TemplateNode {
  type: number;
  tag?: string;
  content?: string | { content?: string };
  name?: string;
  value?: { content: string };
  arg?: { content?: string };
  exp?: { content?: string };
  props?: TemplateNode[];
  children?: TemplateNode[];
  loc: { start: { line: number } };
}

function vueFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' || entry.name.startsWith('.') ? [] : vueFiles(path);
    return entry.name.endsWith('.vue') ? [path] : [];
  });
}

/** String literals in an expression, ignoring the keys passed to `t()`/`find()` and `${…}` holes. */
function textLiterals(expression: string): string[] {
  const withoutKeys = expression.replace(/\b(?:t|find)\(\s*(['"`])[^'"`]*\1/g, '');
  const literals = [...withoutKeys.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)].map((match) =>
    (match[1] ?? match[2] ?? match[3] ?? '').replace(/\$\{[^}]*\}/g, ''),
  );
  // Prose has lowercase letters and reads as a phrase or a capitalized word;
  // single lowercase words and ALL-CAPS codes are identifiers, not text.
  return literals.filter(
    (literal) => /\p{Ll}/u.test(literal) && (/[\s!?…]/.test(literal.trim()) || /^\p{Lu}\p{Ll}/u.test(literal)),
  );
}

function inlineText(file: string): string[] {
  const { descriptor } = parse(readFileSync(file, 'utf8'), { filename: file });
  const ast = descriptor.template?.ast as TemplateNode | undefined;
  if (!ast) return [];
  const found: string[] = [];
  const report = (node: TemplateNode, text: string) => found.push(`${relative(root, file)}:${node.loc.start.line} ${JSON.stringify(text)}`);

  const visit = (node: TemplateNode) => {
    if (node.type === 1 && VERBATIM_ELEMENTS.has(node.tag ?? '')) return;
    if (node.props?.some((prop) => prop.type === 6 && prop.name === 'translate' && prop.value?.content === 'no')) return;
    if (node.type === 2 && typeof node.content === 'string') {
      const text = node.content.trim();
      if (LETTER.test(text) && !ALLOWED.has(text)) report(node, text);
    }
    if (node.type === 5 && typeof node.content === 'object') {
      for (const literal of textLiterals(node.content.content ?? '')) report(node, literal);
    }
    for (const prop of node.props ?? []) {
      if (prop.type === 6 && TEXT_ATTRIBUTES.has(prop.name ?? '') && prop.value && LETTER.test(prop.value.content)) {
        if (!ALLOWED.has(prop.value.content)) report(prop, prop.value.content);
      }
      if (prop.type === 7 && prop.name === 'bind' && TEXT_ATTRIBUTES.has(prop.arg?.content ?? '')) {
        for (const literal of textLiterals(prop.exp?.content ?? '')) report(prop, literal);
      }
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(ast);
  return found;
}

describe('interface text', () => {
  it('comes from a dictionary in every template', () => {
    const files = SCANNED.flatMap((directory) => vueFiles(join(root, directory)));
    expect(files.length).toBeGreaterThan(10);
    expect(files.flatMap(inlineText)).toEqual([]);
  });
});
