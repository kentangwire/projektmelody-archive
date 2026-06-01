import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prisma } from '../prisma';
import { buildImportPlan } from './importPlan';

function parseArgs(argv: string[]) {
  const out: { file: string; origin: string; dryRun: boolean } = {
    file: process.env.SOURCE_JSON || 'public/videos.json',
    origin: process.env.PAGES_ORIGIN || 'https://projektmelody.cc',
    dryRun: process.env.DRY_RUN === '1'
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    if (a === '--file' && argv[i + 1]) out.file = argv[++i];
    if (a === '--origin' && argv[i + 1]) out.origin = argv[++i];
  }

  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const filePath = resolve(process.cwd(), args.file);
  const jsonText = await readFile(filePath, 'utf8');
  const source = JSON.parse(jsonText);
  if (!Array.isArray(source)) throw new Error('source json must be an array');

  const plan = buildImportPlan(source, { pagesOrigin: args.origin });
  if (args.dryRun) {
    process.stdout.write(
      `DRY RUN: ${plan.videos.length} videos, ${plan.tagNames.length} tags (origin=${args.origin}, file=${args.file})\n`
    );
    process.stdout.write(`${JSON.stringify({ sample: plan.videos.slice(0, 3), tagNames: plan.tagNames }, null, 2)}\n`);
    return;
  }

  process.stdout.write(`Importing: ${plan.videos.length} videos, ${plan.tagNames.length} tags\n`);

  const tagIdByName = new Map<string, string>();
  for (const name of plan.tagNames.slice().sort()) {
    const tag = await prisma.tag.upsert({
      where: { name },
      create: { name },
      update: {}
    });
    tagIdByName.set(name, tag.id);
  }

  for (const v of plan.videos) {
    if (!v.id || !v.title || !v.hlsMasterUrl) continue;
    await prisma.video.upsert({
      where: { id: v.id },
      create: {
        id: v.id,
        title: v.title,
        description: v.description,
        hlsMasterUrl: v.hlsMasterUrl,
        createdAt: new Date(v.createdAtIso)
      },
      update: {
        title: v.title,
        description: v.description,
        hlsMasterUrl: v.hlsMasterUrl
      }
    });

    const joinData = v.tagNames
      .map(name => {
        const tagId = tagIdByName.get(name);
        if (!tagId) return null;
        return { videoId: v.id, tagId };
      })
      .filter(Boolean) as Array<{ videoId: string; tagId: string }>;

    if (joinData.length > 0) {
      await prisma.videoTag.createMany({
        data: joinData,
        skipDuplicates: true
      });
    }
  }

  process.stdout.write('Import complete\n');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async err => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
