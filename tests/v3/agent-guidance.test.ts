import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();
const agentsDir = path.join(projectRoot, '.agents', 'skills');
const archivedSkillsDir = path.join(projectRoot, 'docs', 'archive', 'v3', 'skills');

const ACTIVE_SKILLS = [
  'nara-feature-development',
  'nara-api-contracts',
  'nara-auth-rbac',
  'nara-database',
  'nara-frontend',
  'nara-testing',
];

const ARCHIVED_SKILLS = ['nara-pitfalls', 'nara-dependencies'];

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

function readActiveGuidanceDocuments(): { file: string; content: string }[] {
  return [
    ...readActiveSkillDocuments(),
    {
      file: path.join(projectRoot, '.agents', 'skills', 'README.md'),
      content: readFileSync(path.join(projectRoot, '.agents', 'skills', 'README.md'), 'utf-8'),
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
      for (const pattern of removedPatterns) {
        expect(content, `${file} teaches removed pattern ${pattern}`).not.toContain(pattern);
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
  });
});

/** Agent guidance keeps a small procedural surface: authority in AGENTS.md/ARCHITECTURE.md, procedures in six skills. */
describe('agent guidance stays minimal', () => {
  it('exposes exactly the six intended active skills', () => {
    const active = readdirSync(agentsDir).filter((entry) => entry.startsWith('nara-')).sort();
    expect(active).toEqual([...ACTIVE_SKILLS].sort());
    for (const skill of ACTIVE_SKILLS) {
      expect(statSync(path.join(agentsDir, skill, 'SKILL.md')).isFile(), `${skill} needs a SKILL.md`).toBe(true);
    }
  });

  it('keeps archived skills out of the active path but preserved in history', () => {
    for (const archived of ARCHIVED_SKILLS) {
      expect(
        existsSync(path.join(agentsDir, archived)),
        `${archived} must not remain in the active retrieval path`,
      ).toBe(false);
      expect(
        existsSync(path.join(archivedSkillsDir, `${archived}.md`)),
        `${archived} history must be preserved in the skills archive`,
      ).toBe(true);
    }
  });

  it('references only active skills from AGENTS.md', () => {
    const agents = readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf-8');
    for (const skill of ACTIVE_SKILLS) {
      expect(agents, `AGENTS.md must reference active skill ${skill}`).toContain(skill);
    }
    for (const archived of ARCHIVED_SKILLS) {
      expect(agents, `AGENTS.md must not reference archived skill ${archived}`).not.toContain(archived);
    }
  });

  it('references only active skills from the skill index', () => {
    const index = readFileSync(path.join(agentsDir, 'README.md'), 'utf-8');
    for (const skill of ACTIVE_SKILLS) {
      expect(index, `skill index must reference active skill ${skill}`).toContain(skill);
    }
    for (const archived of ARCHIVED_SKILLS) {
      expect(index, `skill index must not reference archived skill ${archived}`).not.toContain(archived);
    }
    expect(index).toMatch(/smallest set of procedural skills/);
  });

  it('requires neither the dependency nor the pitfalls skill anywhere in active guidance', () => {
    for (const { file, content } of readActiveGuidanceDocuments()) {
      for (const archived of ARCHIVED_SKILLS) {
        expect(content, `${file} must not require archived skill ${archived}`).not.toContain(archived);
      }
    }
    for (const file of skillFiles()) {
      const content = readFileSync(file, 'utf-8');
      expect(content, `${file} must not retain a static banned-dependency table`).not.toMatch(/\| Banned \|/);
    }
  });

  it('teaches reusable Features to use host requirements instead of direct Auth coupling', () => {
    const auth = readFileSync(path.join(agentsDir, 'nara-auth-rbac', 'SKILL.md'), 'utf-8');
    expect(auth).toMatch(/host requirement/);
    expect(auth).toMatch(/binding/);
    expect(auth).toContain('UsersServerHost');
    expect(auth).toContain('src/app/bindings/users.server.ts');
    expect(auth).toMatch(/must NOT directly depend on Auth/);
    expect(auth).toMatch(/no DI container/i);
  });

  it('does not advertise contributor-only skills as a generated-app capability', () => {
    const homepage = readFileSync(path.join(projectRoot, 'src', 'app', 'pages', 'HomePage.vue'), 'utf-8');
    expect(homepage).not.toMatch(/loads skill:/);
  });
});
