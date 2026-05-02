import { MigrationInterface, QueryRunner } from "typeorm";

export class ReminderSent1777664817362 implements MigrationInterface {
    name = 'ReminderSent1777664817362'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order" ADD "lastReminderSentAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "order" ADD "deliveryDetailsProvided" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "deliveryDetailsProvided"`);
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "lastReminderSentAt"`);
    }

}
