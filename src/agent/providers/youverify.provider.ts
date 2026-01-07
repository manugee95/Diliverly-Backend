import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class YouverifyProvider {
  private baseUrl: string =
    process.env.YV_BASE_URL || 'https://api.sandbox.youverify.co';
  private apiKey: string = process.env.YV_API_KEY || '';

  constructor(
    /**
     * Inject HttpService for making HTTP requests
     */
    private readonly httpService: HttpService,
  ) {}

  /**
   * Verify identity via Youverify (NIN and BVN)
   * The body and endpoint depend on which identity you're verifying.
   */
  async verifyIdentity(
    identityType: 'nin' | 'ibvn' | string,
    identityValue: string,
  ): Promise<any> {
    const endpoint = `${this.baseUrl}/v1/identities/candidates/check`;

    const payload: any = {
      identity_type: identityType,
      identity_value: identityValue,
    };

    try {
      const response$ = this.httpService.post(endpoint, payload, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      const response = await firstValueFrom(response$);
      return response.data; // the raw Youverify response
    } catch (error) {
      console.error(
        'Youverify verifyIdentity error:',
        error.response?.data || error.message,
      );
      throw new InternalServerErrorException('Identity verification failed');
    }
  }
}
