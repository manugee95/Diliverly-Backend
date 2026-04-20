// import { MigrationInterface, QueryRunner } from 'typeorm';

// export class AddDashboardIndexes1776455591989 implements MigrationInterface {
//   name = 'AddDashboardIndexes1776455591989';

//   public async up(queryRunner: QueryRunner): Promise<void> {
//     await queryRunner.query(`
//   CREATE INDEX IF NOT EXISTS "idx_order_item_agent" ON "order_item" ("agentId")
// `);
//     await queryRunner.query(
//       `CREATE INDEX "idx_order_item_agent_status" ON "order_item" ("agentId", "status") `,
//     );
//     await queryRunner.query(
//       `CREATE INDEX "idx_order_vendor_status" ON "order" ("vendorId", "status") `,
//     );
//     await queryRunner.query(
//       `CREATE INDEX "idx_quote_request_status" ON "quote" ("requestId", "status") `,
//     );
//     await queryRunner.query(
//       `CREATE INDEX "idx_quote_status" ON "quote" ("status") `,
//     );
//     await queryRunner.query(
//       `CREATE INDEX "idx_quote_agent" ON "quote" ("agentId") `,
//     );
//     await queryRunner.query(
//       `CREATE INDEX "idx_delivery_request_assigned_agent" ON "delivery_request" ("assignedAgentId") `,
//     );
//     await queryRunner.query(
//       `CREATE INDEX "idx_delivery_request_status" ON "delivery_request" ("status") `,
//     );
//     await queryRunner.query(
//       `CREATE INDEX "idx_delivery_request_vendor" ON "delivery_request" ("vendorId") `,
//     );
//   }

//   public async down(queryRunner: QueryRunner): Promise<void> {
//     await queryRunner.query(
//       `DROP INDEX "public"."idx_delivery_request_vendor"`,
//     );
//     await queryRunner.query(
//       `DROP INDEX "public"."idx_delivery_request_status"`,
//     );
//     await queryRunner.query(
//       `DROP INDEX "public"."idx_delivery_request_assigned_agent"`,
//     );
//     await queryRunner.query(`DROP INDEX "public"."idx_quote_agent"`);
//     await queryRunner.query(`DROP INDEX "public"."idx_quote_status"`);
//     await queryRunner.query(`DROP INDEX "public"."idx_quote_request_status"`);
//     await queryRunner.query(`DROP INDEX "public"."idx_order_vendor_status"`);
//     await queryRunner.query(
//       `DROP INDEX "public"."idx_order_item_agent_status"`,
//     );
//     await queryRunner.query(`DROP INDEX "public"."idx_order_item_agent"`);
//   }
// }

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDashboardIndexes1776455591989 implements MigrationInterface {
  name = 'AddDashboardIndexes1776455591989';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_order_item_agent"
      ON "order_item" ("agentId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_order_item_agent_status"
      ON "order_item" ("agentId", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_order_vendor_status"
      ON "order" ("vendorId", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_quote_request_status"
      ON "quote" ("requestId", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_quote_status"
      ON "quote" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_quote_agent"
      ON "quote" ("agentId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_delivery_request_assigned_agent"
      ON "delivery_request" ("assignedAgentId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_delivery_request_status"
      ON "delivery_request" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_delivery_request_vendor"
      ON "delivery_request" ("vendorId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_delivery_request_vendor"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_delivery_request_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_delivery_request_assigned_agent"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_quote_agent"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_quote_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_quote_request_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_order_vendor_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_order_item_agent_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_order_item_agent"`);
  }
}
