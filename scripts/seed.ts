import Seeder from '@services/Seeder';

const result = Seeder.seed();
if (result.applied.length > 0) {
  console.log(`Applied ${result.applied.length} seed(s):`);
  result.applied.forEach(name => console.log(`  ✓ ${name}`));
} else {
  console.log('No seeds found.');
}
