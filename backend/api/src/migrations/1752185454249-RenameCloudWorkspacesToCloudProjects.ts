import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameCloudWorkspacesToCloudProjects1752185454249 implements MigrationInterface {
    name = 'RenameCloudWorkspacesToCloudProjects1752185454249'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Rename table
        await queryRunner.query(`ALTER TABLE "cloud_workspaces" RENAME TO "cloud_projects"`);
        
        // Rename foreign key in cloud_files table
        await queryRunner.query(`ALTER TABLE "cloud_files" RENAME COLUMN "workspaceId" TO "projectId"`);
        
        // Update indexes if needed
        await queryRunner.query(`ALTER INDEX "IDX_cloud_workspaces_userId" RENAME TO "IDX_cloud_projects_userId"`);
        
        // Rename enum type if it exists
        await queryRunner.query(`ALTER TYPE "cloud_workspaces_type_enum" RENAME TO "cloud_projects_type_enum"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Reverse the changes
        await queryRunner.query(`ALTER TABLE "cloud_projects" RENAME TO "cloud_workspaces"`);
        await queryRunner.query(`ALTER TABLE "cloud_files" RENAME COLUMN "projectId" TO "workspaceId"`);
        await queryRunner.query(`ALTER INDEX "IDX_cloud_projects_userId" RENAME TO "IDX_cloud_workspaces_userId"`);
        await queryRunner.query(`ALTER TYPE "cloud_projects_type_enum" RENAME TO "cloud_workspaces_type_enum"`);
    }
}