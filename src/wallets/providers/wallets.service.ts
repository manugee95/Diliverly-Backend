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
  async lockWallet(userId: number, manager: EntityManager) {
    const repo = manager.getRepository(Wallet);
    const wallet = await repo.findOne({
      where: { user: { id: userId } },
      lock: { mode: 'pessimistic_write' },
    });
    if (!wallet) throw new Error('Wallet not found');
    return wallet;
  }
}
