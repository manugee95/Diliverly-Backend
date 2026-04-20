import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPickUpAddress1776695466379 implements MigrationInterface {
    name = 'AddPickUpAddress1776695466379'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "delivery_request" ADD "pickUpAddress" character varying(512) NOT NULL DEFAULT 'a'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "delivery_request" DROP COLUMN "pickUpAddress"`);
    }

}
