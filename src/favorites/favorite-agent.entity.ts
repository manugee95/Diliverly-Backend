import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { Vendor } from '../vendor/vendor.entity';
import { Agent } from '../agent/agent.entity';

@Entity()
@Unique(['vendor', 'agent'])
export class FavoriteAgent {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Vendor, (vendor) => vendor.favoriteAgents, {
    onDelete: 'CASCADE',
  })
  vendor: Vendor;

  @ManyToOne(() => Agent, (agent) => agent.favoriteByVendors, {
    onDelete: 'CASCADE',
  })
  agent: Agent;

  @CreateDateColumn()
  createdAt: Date;
}
