import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSharedProjectsTable1752185454251 implements MigrationInterface {
    name = 'CreateSharedProjectsTable1752185454251'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create enum types
        await queryRunner.query(`
            CREATE TYPE "shared_projects_access_type_enum" AS ENUM(
                'public', 'authenticated', 'email_list'
            )
        `);
        
        await queryRunner.query(`
            CREATE TYPE "shared_projects_permission_enum" AS ENUM(
                'view', 'query', 'ai', 'export'
            )
        `);

        // Create shared_projects table
        await queryRunner.query(`
            CREATE TABLE "shared_projects" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "shareId" character varying(12) NOT NULL,
                "projectId" uuid NOT NULL,
                "workspaceId" uuid NOT NULL,
                "createdByUserId" uuid NOT NULL,
                "customSlug" character varying(50),
                "accessType" "shared_projects_access_type_enum" NOT NULL DEFAULT 'authenticated',
                "allowedEmails" text,
                "requireAuth" boolean NOT NULL DEFAULT true,
                "permissions" text NOT NULL DEFAULT 'view',
                "expiresAt" TIMESTAMP,
                "settings" jsonb,
                "viewCount" integer NOT NULL DEFAULT 0,
                "uniqueViewers" integer NOT NULL DEFAULT 0,
                "lastAccessedAt" TIMESTAMP,
                "accessLogs" jsonb NOT NULL DEFAULT '[]',
                "isActive" boolean NOT NULL DEFAULT true,
                "isPublic" boolean NOT NULL DEFAULT false,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_shared_projects" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_shared_projects_shareId" UNIQUE ("shareId"),
                CONSTRAINT "UQ_shared_projects_customSlug" UNIQUE ("customSlug")
            )
        `);

        // Create indexes
        await queryRunner.query(`CREATE INDEX "IDX_shared_projects_shareId" ON "shared_projects" ("shareId")`);
        await queryRunner.query(`CREATE INDEX "IDX_shared_projects_customSlug" ON "shared_projects" ("customSlug")`);
        await queryRunner.query(`CREATE INDEX "IDX_shared_projects_workspaceId" ON "shared_projects" ("workspaceId")`);
        await queryRunner.query(`CREATE INDEX "IDX_shared_projects_projectId" ON "shared_projects" ("projectId")`);

        // Add foreign keys
        await queryRunner.query(`
            ALTER TABLE "shared_projects" 
            ADD CONSTRAINT "FK_shared_projects_project" 
            FOREIGN KEY ("projectId") 
            REFERENCES "cloud_projects"("id") 
            ON DELETE CASCADE
        `);

        await queryRunner.query(`
            ALTER TABLE "shared_projects" 
            ADD CONSTRAINT "FK_shared_projects_workspace" 
            FOREIGN KEY ("workspaceId") 
            REFERENCES "workspaces"("id") 
            ON DELETE CASCADE
        `);

        await queryRunner.query(`
            ALTER TABLE "shared_projects" 
            ADD CONSTRAINT "FK_shared_projects_user" 
            FOREIGN KEY ("createdByUserId") 
            REFERENCES "users"("id") 
            ON DELETE SET NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign keys
        await queryRunner.query(`ALTER TABLE "shared_projects" DROP CONSTRAINT "FK_shared_projects_user"`);
        await queryRunner.query(`ALTER TABLE "shared_projects" DROP CONSTRAINT "FK_shared_projects_workspace"`);
        await queryRunner.query(`ALTER TABLE "shared_projects" DROP CONSTRAINT "FK_shared_projects_project"`);

        // Drop indexes
        await queryRunner.query(`DROP INDEX "IDX_shared_projects_projectId"`);
        await queryRunner.query(`DROP INDEX "IDX_shared_projects_workspaceId"`);
        await queryRunner.query(`DROP INDEX "IDX_shared_projects_customSlug"`);
        await queryRunner.query(`DROP INDEX "IDX_shared_projects_shareId"`);

        // Drop table
        await queryRunner.query(`DROP TABLE "shared_projects"`);

        // Drop enums
        await queryRunner.query(`DROP TYPE "shared_projects_permission_enum"`);
        await queryRunner.query(`DROP TYPE "shared_projects_access_type_enum"`);
    }
}