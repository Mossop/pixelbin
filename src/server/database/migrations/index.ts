import path from "path";

import type { default as Knex, Migration, MigrationSource } from "knex";

import type { Logger, Obj } from "../../../utils";
import { Level } from "../../../utils";

interface PixelbinMigration extends Migration {
  readonly name: string;
}

interface LoggedMigration {
  up: (knex: Knex, logger: Logger) => Promise<void>;
  down?: (kenx: Knex, logger: Logger) => Promise<void>;
}

class ModuleMigration implements PixelbinMigration {
  protected module: Obj | undefined;
  public readonly name: string;

  public constructor(protected logger: Logger, protected readonly spec: string, name?: string) {
    this.name = name ?? path.basename(spec);
  }

  protected async loadModule(): Promise<LoggedMigration> {
    if (!this.module) {
      this.module = await import(this.spec) as Obj;
    }

    return this.module as LoggedMigration;
  }

  public async up(knex: Knex): Promise<void> {
    let { up } = await this.loadModule();
    await this.logger.child(this.name).time(
      () => up(knex, this.logger),
      Level.Info,
      "Applied migration.",
    );
  }

  public async down(knex: Knex): Promise<void> {
    let { down } = await this.loadModule();
    if (down) {
      let downFn = down;
      await this.logger.child(this.name).time(
        () => downFn(knex, this.logger),
        Level.Info,
        "Rolled back migration.",
      );
    }
  }
}

class InnerModuleMigration extends ModuleMigration {
  public constructor(
    protected logger: Logger,
    spec: string,
    protected readonly property: string,
    name?: string,
  ) {
    super(logger, spec, name ?? `${path.basename(spec)}#${property}`);
  }

  protected async loadModule(): Promise<LoggedMigration> {
    if (!this.module) {
      this.module = await import(this.spec) as Obj;
    }

    return this.module[this.property] as LoggedMigration;
  }
}

export default class PixelbinMigrationSource implements MigrationSource<PixelbinMigration> {
  private _migrations: PixelbinMigration[] | undefined;
  public constructor(private logger: Logger) {
  }

  private get migrations(): PixelbinMigration[] {
    if (!this._migrations) {
      this._migrations = [
        new ModuleMigration(this.logger, "./base"),
        new InnerModuleMigration(this.logger, "./incremental", "takenZone"),
        new InnerModuleMigration(this.logger, "./incremental", "alternates"),
        new InnerModuleMigration(this.logger, "./incremental", "text"),
        new InnerModuleMigration(this.logger, "./incremental", "localThumbs"),
        new ModuleMigration(this.logger, "./simplified"),
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
