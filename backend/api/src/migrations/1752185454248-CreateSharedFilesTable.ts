import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSharedFilesTable1752185454248 implements MigrationInterface {
    name = 'CreateSharedFilesTable1752185454248'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TYPE "public"."shared_files_accesstype_enum" AS ENUM('public', 'email_list')
        `);
        
        await queryRunner.query(`
            CREATE TABLE "shared_files" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "shareId" character varying(12) NOT NULL,
                "userId" uuid,
                "fileName" character varying NOT NULL,
                "fileSize" bigint NOT NULL,
                "compressedSize" bigint,
                "mimeType" character varying,
                "r2Key" character varying(500) NOT NULL,
                "accessType" "public"."shared_files_accesstype_enum" NOT NULL DEFAULT 'public',
                "allowedEmails" text,
                "requireAuth" boolean NOT NULL DEFAULT true,
                "fileMetadata" jsonb,
                "accessCount" integer NOT NULL DEFAULT '0',
                "accessLogs" jsonb NOT NULL DEFAULT '[]',
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "expiresAt" TIMESTAMP,
                "lastAccessedAt" TIMESTAMP,
                CONSTRAINT "UQ_share_id" UNIQUE ("shareId"),
                CONSTRAINT "PK_shared_files" PRIMARY KEY ("id")
            )
        `);
        
        await queryRunner.query(`
            CREATE INDEX "idx_share_id" ON "shared_files" ("shareId")
        `);
        
        await queryRunner.query(`
            CREATE INDEX "idx_user_id" ON "shared_files" ("userId")
        `);
        
        await queryRunner.query(`
            CREATE INDEX "idx_expires_at" ON "shared_files" ("expiresAt")
        `);
        
        await queryRunner.query(`
            ALTER TABLE "shared_files" 
            ADD CONSTRAINT "FK_shared_files_user" 
            FOREIGN KEY ("userId") 
            REFERENCES "users"("id") 
            ON DELETE CASCADE 
            ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "shared_files" DROP CONSTRAINT "FK_shared_files_user"`);
        await queryRunner.query(`DROP INDEX "public"."idx_expires_at"`);
        await queryRunner.query(`DROP INDEX "public"."idx_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_share_id"`);
        await queryRunner.query(`DROP TABLE "shared_files"`);
        await queryRunner.query(`DROP TYPE "public"."shared_files_accesstype_enum"`);
    }
}