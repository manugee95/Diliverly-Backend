import { MigrationInterface, QueryRunner } from "typeorm";

export class TimeFrame1779175615445 implements MigrationInterface {
    name = 'TimeFrame1779175615445'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "delivery" DROP COLUMN "estimatedCompletionHours"`);
        await queryRunner.query(`ALTER TABLE "delivery_request" ADD "estimatedCompletionHours" integer NOT NULL DEFAULT '24'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "delivery_request" DROP COLUMN "estimatedCompletionHours"`);
        await queryRunner.query(`ALTER TABLE "delivery" ADD "estimatedCompletionHours" integer NOT NULL`);
    }

}
