import { Injectable } from '@nestjs/common';
import { VirtualAccountService } from '../../virtual-account/providers/virtual-account.service';
import { WalletFundingService } from '../../wallets/providers/wallet-funding.service';

@Injectable()
export class WebhookService {
  constructor(
    private readonly walletService: WalletFundingService,
    private readonly vaService: VirtualAccountService,
  ) {}

  async process(event: string, payload: any) {
    switch (event) {
      case 'charge.success':
        return this.walletService.handleSuccessfulCharge(payload);

    //   case 'transfer.success':
    //     return this.transferService.handleTransferSuccess(payload);

      case 'dedicatedaccount.assign.success':
        return this.vaService.handleSuccessfulCharge(payload);
    }
  }
}
