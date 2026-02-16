import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Wallet } from '../entities/wallet.entity';

@Injectable()
export class WalletsService {
  constructor(private readonly dataSource: DataSource) {}

  async getOrCreateWallet(userId: number, manager?: EntityManager) {
    const repo = manager
      ? manager.getRepository(Wallet)
      : this.dataSource.getRepository(Wallet);
    let wallet = await repo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
    if (!wallet) {
      wallet = repo.create({
        user: { id: userId } as any,
        availableBalance: '0.00',
        escrowBalance: '0.00',
      });
      wallet = await repo.save(wallet);
    }
    return wallet;
  }

  // Locks wallet row for safe mutation
  async lockWallet(userId: number, manager?: EntityManager) {
    const repo = (manager ?? this.dataSource.manager).getRepository(Wallet);

    // 1) Try to lock existing wallet row
    let wallet = await repo.findOne({
      where: { user: { id: userId } },
      lock: { mode: 'pessimistic_write' },
    });

    if (wallet) return wallet;

    // 2) Create wallet if missing (handles cases where wallets weren't pre-created)
    // Wrap in try/catch to handle race-condition (two requests create same wallet)
    try {
      wallet = repo.create({
        user: { id: userId } as any,
        availableBalance: '0.00',
        escrowBalance: '0.00',
      });
      wallet = await repo.save(wallet);

      // Lock it after creation
      return await repo.findOneOrFail({
        where: { id: wallet.id },
        lock: { mode: 'pessimistic_write' },
      });
    } catch (e: any) {
      // If another transaction created it first, re-fetch + lock
      const existing = await repo.findOne({
        where: { user: { id: userId } },
        lock: { mode: 'pessimistic_write' },
      });
      if (existing) return existing;
      throw e;
    }
  }
}
