import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveUniqueforPin1779179916252 implements MigrationInterface {
    name = 'RemoveUniqueforPin1779179916252'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order_item" DROP CONSTRAINT "UQ_9fe0d7f2203af52bc2e0a34d227"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order_item" ADD CONSTRAINT "UQ_9fe0d7f2203af52bc2e0a34d227" UNIQUE ("deliveryPin")`);
    }

}
