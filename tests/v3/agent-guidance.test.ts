import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();
const agentsDir = path.join(projectRoot, '.agents', 'skills');
const archivedSkillsDir = path.join(projectRoot, 'docs', 'archive', 'v3', 'skills');

function skillFiles(): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(agentsDir)) {
    if (!entry.startsWith('nara-')) continue;
    const skillFile = path.join(agentsDir, entry, 'SKILL.md');
    if (statSync(skillFile).isFile()) found.push(skillFile);
  }
  return found.sort();
}

function readActiveSkillDocuments(): { file: string; content: string }[] {
  return [
    ...skillFiles().map((file) => ({
      file,
      content: readFileSync(file, 'utf-8'),
    })),
    {
      file: path.join(projectRoot, 'AGENTS.md'),
      content: readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf-8'),
    },
    {
      file: path.join(projectRoot, 'ARCHITECTURE.md'),
      content: readFileSync(path.join(projectRoot, 'ARCHITECTURE.md'), 'utf-8'),
    },
  ];
}

/** Agent guidance must describe the current product, not the v2 → v3 rewrite. */
describe('agent guidance stays current', () => {
  it('keeps no rewrite task authority at the root or in active guidance', () => {
    expect(existsSync(path.join(projectRoot, 'TODO.md'))).toBe(false);
    expect(existsSync(path.join(projectRoot, 'V3_SPEC.md'))).toBe(false);
    for (const { file, content } of readActiveSkillDocuments()) {
      expect(content, `${file} must not depend on TODO.md`).not.toMatch(/TODO\.md/);
      expect(content, `${file} must not cite the archived rewrite spec`).not.toMatch(/V3_SPEC\.md/);
    }
  });

  it('references no deleted v2 source paths from active skills', () => {
    const deadPaths = [
      'routes/web.ts',
      'app/handlers',
      'app/queries',
      'app/services',
      'app/middlewares',
      'app/validators',
      'app/core',
      'resources/Pages',
      'resources/Components',
      'resources/inertia.html',
      'import.meta.glob',
      'NaraRequest',
      'NaraResponse',
      'NaraMiddleware',
      'NaraHandler',
    ];
    for (const file of skillFiles()) {
      const content = readFileSync(file, 'utf-8');
      for (const dead of deadPaths) {
        expect(content, `${file} references deleted v2 path ${dead}`).not.toContain(dead);
      }
    }
  });

  it('teaches no removed Svelte/Inertia runtime patterns in active skills', () => {
    const removedPatterns = [
      '@inertiajs/',
      'res.inertia',
      'router.visit(',
      '$props()',
      '$state(',
      '$derived(',
      'bits-ui',
      '.svelte',
    ];
    for (const file of skillFiles()) {
      const content = readFileSync(file, 'utf-8');
      // The dependency policy names banned packages in its banned column; that
      // explicit unsupported-stack statement is legitimate, not a usage recipe.
      const lines = content
        .split('\n')
        .filter((line) => !(file.endsWith('nara-dependencies/SKILL.md') && line.startsWith('|')));
      for (const pattern of removedPatterns) {
        expect(lines.join('\n'), `${file} teaches removed pattern ${pattern}`).not.toContain(pattern);
      }
    }
  });

  it('keeps superseded v2 skills out of the active retrieval path', () => {
    for (const stale of ['inertia-patterns.md', 'crud-pattern.md', 'new-world.md', 'pentest-pattern.md']) {
      expect(existsSync(path.join(agentsDir, stale))).toBe(false);
      expect(existsSync(path.join(archivedSkillsDir, stale))).toBe(true);
    }
    expect(existsSync(path.join(projectRoot, '.agents', 'types-baseline.json'))).toBe(false);
  });

  it('gives every skill a directory with machine-readable frontmatter', () => {
    const skills = skillFiles();
    expect(skills.length).toBeGreaterThan(0);
    for (const file of skills) {
      const content = readFileSync(file, 'utf-8');
      expect(content, `${file} needs name frontmatter`).toMatch(/^---\nname: /);
      expect(content, `${file} needs description frontmatter`).toMatch(/\ndescription: .+\n---/);
    }
  });

  it('resolves documentation links from the agent entry points', () => {
    for (const entry of ['AGENTS.md', 'ARCHITECTURE.md', '.agents/skills/README.md']) {
      const file = path.join(projectRoot, entry);
      const content = readFileSync(file, 'utf-8');
      for (const match of content.matchAll(/\]\((\.[^)]+)\)/g)) {
        const target = match[1].split('#')[0];
        expect(existsSync(path.resolve(path.dirname(file), target)), `${entry} links to missing ${target}`).toBe(
          true,
        );
      }
    }
  });

  it('references only npm scripts that exist', () => {
    const manifest = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf-8')) as {
      scripts?: Record<string, string>;
    };
    const scripts = new Set(Object.keys(manifest.scripts ?? {}));
    for (const { file, content } of readActiveSkillDocuments()) {
      for (const match of content.matchAll(/npm run ([a-z0-9:.-]+)/gi)) {
        expect(scripts.has(match[1]), `${file} references missing npm script ${match[1]}`).toBe(true);
      }
    }
  });

  it('matches frontend guidance to the real Vue Router composition', () => {
    expect(existsSync(path.join(projectRoot, 'src', 'app', 'router.ts'))).toBe(true);
    const frontend = readFileSync(path.join(agentsDir, 'nara-frontend', 'SKILL.md'), 'utf-8');
    expect(frontend).toContain('vue-router');
    expect(frontend).toContain('src/app/router.ts');
    expect(frontend).not.toMatch(/unless a later specification adds a router/);
  });
});
