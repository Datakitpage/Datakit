import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDomainUsageTable1755122574878 implements MigrationInterface {
  name = 'CreateDomainUsageTable1755122574878';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "domain_usage" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "domain" character varying NOT NULL,
        "origin" character varying,
        "referer" character varying,
        "endpoint" character varying NOT NULL,
        "method" character varying NOT NULL,
        "userAgent" text,
        "ip" character varying,
        "requestCount" integer NOT NULL DEFAULT 1,
        "userId" uuid,
        "metadata" json,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "lastAccessAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_domain_usage_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_domain_usage_domain_userId" ON "domain_usage" ("domain", "userId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_domain_usage_domain_createdAt" ON "domain_usage" ("domain", "createdAt")
    `);

    await queryRunner.query(`
      ALTER TABLE "domain_usage" 
      ADD CONSTRAINT "FK_domain_usage_user" 
      FOREIGN KEY ("userId") 
      REFERENCES "users"("id") 
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "domain_usage" DROP CONSTRAINT "FK_domain_usage_user"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_domain_usage_domain_createdAt"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_domain_usage_domain_userId"`);
    await queryRunner.query(`DROP TABLE "domain_usage"`);
  }
}