import path from "path";

import type { default as Knex, Migration, MigrationSource } from "knex";

import type { Obj } from "../../../utils";

interface PixelbinMigration extends Migration {
  readonly name: string;
}

class ModuleMigration implements PixelbinMigration {
  protected module: Obj | undefined;
  public readonly name: string;

  public constructor(protected readonly spec: string, name?: string) {
    this.name = name ?? path.basename(spec);
  }

  protected async loadModule(): Promise<Migration> {
    if (!this.module) {
      this.module = await import(this.spec) as Obj;
    }

    return this.module as Migration;
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

class InnerModuleMigration extends ModuleMigration {
  public constructor(spec: string, protected readonly property: string, name?: string) {
    super(spec, name ?? `${path.basename(spec)}#${property}`);
  }

  protected async loadModule(): Promise<Migration> {
    if (!this.module) {
      this.module = await import(this.spec) as Obj;
    }

    return this.module[this.property] as Migration;
  }
}

export default class PixelbinMigrationSource implements MigrationSource<PixelbinMigration> {
  private _migrations: PixelbinMigration[] | undefined;

  private get migrations(): PixelbinMigration[] {
    if (!this._migrations) {
      this._migrations = [
        new ModuleMigration("./base"),
        new InnerModuleMigration("./incremental", "takenZone"),
        new InnerModuleMigration("./incremental", "alternates"),
        new InnerModuleMigration("./incremental", "text"),
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
