import { MigrationInterface, QueryRunner } from "typeorm";

export class TimeFrameDefault1779175155588 implements MigrationInterface {
    name = 'TimeFrameDefault1779175155588'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "delivery" ADD "estimatedCompletionHours" integer NOT NULL DEFAULT '24'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "delivery" DROP COLUMN "estimatedCompletionHours"`);
    }

}
