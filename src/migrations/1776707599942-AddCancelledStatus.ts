import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCancelledStatus1776707599942 implements MigrationInterface {
    name = 'AddCancelledStatus1776707599942'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."delivery_request_status_enum" RENAME TO "delivery_request_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."delivery_request_status_enum" AS ENUM('open', 'assigned', 'closed', 'declined', 'cancelled')`);
        await queryRunner.query(`ALTER TABLE "delivery_request" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "delivery_request" ALTER COLUMN "status" TYPE "public"."delivery_request_status_enum" USING "status"::"text"::"public"."delivery_request_status_enum"`);
        await queryRunner.query(`ALTER TABLE "delivery_request" ALTER COLUMN "status" SET DEFAULT 'open'`);
        await queryRunner.query(`DROP TYPE "public"."delivery_request_status_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."delivery_request_status_enum_old" AS ENUM('open', 'assigned', 'closed')`);
        await queryRunner.query(`ALTER TABLE "delivery_request" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "delivery_request" ALTER COLUMN "status" TYPE "public"."delivery_request_status_enum_old" USING "status"::"text"::"public"."delivery_request_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "delivery_request" ALTER COLUMN "status" SET DEFAULT 'open'`);
        await queryRunner.query(`DROP TYPE "public"."delivery_request_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."delivery_request_status_enum_old" RENAME TO "delivery_request_status_enum"`);
    }

}
