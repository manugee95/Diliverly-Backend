import { Injectable } from '@nestjs/common';
import { Agent } from 'src/agent/agent.entity';

@Injectable()
export class TrustScoreProvider {
  public calculateTrustScore(agent: Agent): number {
    const deliveryScore = Math.min(agent.total_deliveries / 100, 1) * 100;

    const ratingScore = (agent.rating_avg / 5) * 100;

    const verificationScore = agent.isVerified ? 100 : 0;

    const trustScore =
      0.4 * deliveryScore + 0.4 * ratingScore + 0.2 * verificationScore;

    return Math.round(trustScore);
  }
}
