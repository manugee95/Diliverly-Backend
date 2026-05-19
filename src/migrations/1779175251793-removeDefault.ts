import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveDefault1779175251793 implements MigrationInterface {
    name = 'RemoveDefault1779175251793'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "delivery" ALTER COLUMN "estimatedCompletionHours" DROP DEFAULT`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "delivery" ALTER COLUMN "estimatedCompletionHours" SET DEFAULT '24'`);
    }

}
