import path from "path";

import type { default as Knex, Migration, MigrationSource } from "knex";

interface PixelbinMigration extends Migration {
  readonly name: string;
}

class ModuleMigration implements PixelbinMigration {
  private module: Migration | undefined;
  public readonly name: string;

  public constructor(private readonly spec: string, name?: string) {
    this.name = name ?? path.basename(spec);
  }

  private async loadModule(): Promise<Migration> {
    if (!this.module) {
      this.module = await import(this.spec) as Migration;
    }

    return this.module;
  }

  public async up(knex: Knex): Promise<void> {
    let { up } = await this.loadModule();
    return up(knex);
  }

  public async down(knex: Knex): Promise<void> {
    let { down } = await this.loadModule();
    if (down) {
      return down(knex);
    }
  }
}

export default class PixelbinMigrationSource implements MigrationSource<PixelbinMigration> {
  private _migrations: PixelbinMigration[] | undefined;

  private get migrations(): PixelbinMigration[] {
    if (!this._migrations) {
      this._migrations = [
        new ModuleMigration("./base"),
      ];
    }

    return this._migrations;
  }

  public async getMigrations(): Promise<PixelbinMigration[]> {
    return this.migrations;
  }

  public getMigrationName(migration: PixelbinMigration): string {
    return migration.name;
  }

  public getMigration(migration: PixelbinMigration): Migration {
    return migration;
  }
}
