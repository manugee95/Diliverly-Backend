import { MigrationInterface, QueryRunner } from "typeorm";

export class OrderTimeframe1779176137795 implements MigrationInterface {
    name = 'OrderTimeframe1779176137795'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order" ADD "startedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "order" ADD "deliveryDeadline" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "order" ADD "remainingExtensionHours" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "order" ADD "isExtended" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "isExtended"`);
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "remainingExtensionHours"`);
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "deliveryDeadline"`);
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "startedAt"`);
    }

}
