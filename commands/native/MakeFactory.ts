/**
 * MakeFactory Command
 *
 * CLI command to generate new factory files.
 */
import * as fs from "fs";
import * as path from "path";
import { printSuccess, printError, printInfo, colors } from "../index";

const c = colors;

class MakeFactory {
  public args: string[] = [];
  public commandName = "make:factory";
  public description = "Create a new model factory";

  public run() {
    if (this.args.length < 2) {
      printError("Factory name is required.");
      console.log(`\n${c.dim}Usage: node nara make:factory <name>${c.reset}`);
      console.log(`${c.dim}Example: node nara make:factory UserFactory${c.reset}\n`);
      console.log(`${c.dim}Note: The 'Factory' suffix will be added automatically if not provided.${c.reset}\n`);
      return;
    }

    let name = this.args[1];

    // Handle help flag
    if (name === '--help' || name === '-h') {
      console.log(`\n${c.yellow}${c.bright}make:factory${c.reset} - Create a new model factory`);
      console.log(`\n${c.dim}Usage: node nara make:factory <name>${c.reset}`);
      console.log(`\n${c.yellow}Arguments:${c.reset}`);
      console.log(`  ${c.cyan}name${c.reset}    The name of the factory (e.g., User, Post)`);
      console.log(`\n${c.yellow}Examples:${c.reset}`);
      console.log(`  ${c.dim}node nara make:factory User${c.reset}`);
      console.log(`  ${c.dim}node nara make:factory PostFactory${c.reset}\n`);
      return;
    }

    // Clean up name and ensure proper casing
    name = name.replace(/factory$/i, "");
    const className = name.charAt(0).toUpperCase() + name.slice(1);
    const factoryName = className + "Factory";
    const modelName = className;
    const modelImport = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    const filename = factoryName + ".ts";
    const filepath = path.join("./database/factories/", filename);

    // Ensure factories directory exists
    if (!fs.existsSync("./database/factories")) {
      fs.mkdirSync("./database/factories", { recursive: true });
    }

    if (fs.existsSync(filepath)) {
      printError(`Factory already exists: ${filepath}`);
      return;
    }

    fs.writeFileSync(filepath, this.getTemplate(factoryName, modelName, modelImport));

    printSuccess(`Factory created: ${c.cyan}database/factories/${filename}${c.reset}`);
    printInfo(`Don't forget to export the factory in ${c.cyan}database/factories/index.ts${c.reset}`);
    console.log();
  }

  private getTemplate(factoryName: string, modelName: string, modelImport: string): string {
    return `/**
 * ${modelName} Factory
 *
 * Factory for creating ${modelName} model instances with fake data.
 */
import { faker } from "@faker-js/faker";
import { Factory } from "./Factory";
import { ${modelName} } from "@models/${modelName}";

/**
 * ${modelName} factory with predefined states
 */
export const ${factoryName} = Factory.define(${modelName}, (faker) => ({
  id: faker.string.uuid(),
  // TODO: Add fields based on your ${modelName} model
  created_at: Date.now(),
  updated_at: Date.now(),
}));

// Register states (optional)
${factoryName}
  .state("active", (data) => ({
    ...data,
    // TODO: Add active state transformation
  }))
  .state("inactive", (data) => ({
    ...data,
    // TODO: Add inactive state transformation
  }));

export default ${factoryName};
`;
  }
}

export default new MakeFactory();
