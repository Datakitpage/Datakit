import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateCloudProjectsToWorkspace1752185454250 implements MigrationInterface {
    name = 'UpdateCloudProjectsToWorkspace1752185454250'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add workspaceId column to cloud_projects
        await queryRunner.query(`ALTER TABLE "cloud_projects" ADD "workspaceId" uuid`);
        
        // Migrate existing user projects to their personal workspace
        // For each user with projects, find or create their personal workspace
        await queryRunner.query(`
            UPDATE cloud_projects cp
            SET "workspaceId" = w.id
            FROM workspaces w
            WHERE w."ownerId" = cp."userId"
            AND w."isPersonal" = true
        `);
        
        // Make workspaceId NOT NULL after migration
        await queryRunner.query(`ALTER TABLE "cloud_projects" ALTER COLUMN "workspaceId" SET NOT NULL`);
        
        // Add foreign key constraint
        await queryRunner.query(`
            ALTER TABLE "cloud_projects" 
            ADD CONSTRAINT "FK_cloud_projects_workspace" 
            FOREIGN KEY ("workspaceId") 
            REFERENCES "workspaces"("id") 
            ON DELETE CASCADE
        `);
        
        // Create index on workspaceId
        await queryRunner.query(`CREATE INDEX "IDX_cloud_projects_workspaceId" ON "cloud_projects" ("workspaceId")`);
        
        // Optionally remove userId column (or keep for audit)
        // await queryRunner.query(`ALTER TABLE "cloud_projects" DROP COLUMN "userId"`);
        
        // Keep userId but rename it to createdByUserId for audit trail
        await queryRunner.query(`ALTER TABLE "cloud_projects" RENAME COLUMN "userId" TO "createdByUserId"`);
        
        // Update cloud_files to track who uploaded (optional)
        await queryRunner.query(`ALTER TABLE "cloud_files" RENAME COLUMN "userId" TO "uploadedByUserId"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Reverse the changes
        await queryRunner.query(`ALTER TABLE "cloud_files" RENAME COLUMN "uploadedByUserId" TO "userId"`);
        await queryRunner.query(`ALTER TABLE "cloud_projects" RENAME COLUMN "createdByUserId" TO "userId"`);
        await queryRunner.query(`DROP INDEX "IDX_cloud_projects_workspaceId"`);
        await queryRunner.query(`ALTER TABLE "cloud_projects" DROP CONSTRAINT "FK_cloud_projects_workspace"`);
        await queryRunner.query(`ALTER TABLE "cloud_projects" DROP COLUMN "workspaceId"`);
    }
}