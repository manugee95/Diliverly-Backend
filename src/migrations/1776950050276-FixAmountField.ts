import { MigrationInterface, QueryRunner } from "typeorm";

export class FixAmountField1776950050276 implements MigrationInterface {
    name = 'FixAmountField1776950050276'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "wallet" ADD "currency" character varying NOT NULL DEFAULT 'NGN'`);
        await queryRunner.query(`ALTER TABLE "wallet" DROP COLUMN "availableBalance"`);
        await queryRunner.query(`ALTER TABLE "wallet" ADD "availableBalance" bigint NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "wallet" DROP COLUMN "escrowBalance"`);
        await queryRunner.query(`ALTER TABLE "wallet" ADD "escrowBalance" bigint NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "escrow" DROP COLUMN "amount"`);
        await queryRunner.query(`ALTER TABLE "escrow" ADD "amount" bigint NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TYPE "public"."wallet_funding_status_enum" RENAME TO "wallet_funding_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."wallet_funding_status_enum" AS ENUM('PENDING', 'SUCCESS', 'FAILED', 'PROCESSING')`);
        await queryRunner.query(`ALTER TABLE "wallet_funding" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "wallet_funding" ALTER COLUMN "status" TYPE "public"."wallet_funding_status_enum" USING "status"::"text"::"public"."wallet_funding_status_enum"`);
        await queryRunner.query(`ALTER TABLE "wallet_funding" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."wallet_funding_status_enum_old"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0b12a144bdc7678b6ddb0b913f" ON "transaction" ("reference") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_0b12a144bdc7678b6ddb0b913f"`);
        await queryRunner.query(`CREATE TYPE "public"."wallet_funding_status_enum_old" AS ENUM('PENDING', 'SUCCESS', 'FAILED')`);
        await queryRunner.query(`ALTER TABLE "wallet_funding" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "wallet_funding" ALTER COLUMN "status" TYPE "public"."wallet_funding_status_enum_old" USING "status"::"text"::"public"."wallet_funding_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "wallet_funding" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."wallet_funding_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."wallet_funding_status_enum_old" RENAME TO "wallet_funding_status_enum"`);
        await queryRunner.query(`ALTER TABLE "escrow" DROP COLUMN "amount"`);
        await queryRunner.query(`ALTER TABLE "escrow" ADD "amount" numeric(12,2) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "wallet" DROP COLUMN "escrowBalance"`);
        await queryRunner.query(`ALTER TABLE "wallet" ADD "escrowBalance" numeric(12,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "wallet" DROP COLUMN "availableBalance"`);
        await queryRunner.query(`ALTER TABLE "wallet" ADD "availableBalance" numeric(12,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "wallet" DROP COLUMN "currency"`);
    }

}
