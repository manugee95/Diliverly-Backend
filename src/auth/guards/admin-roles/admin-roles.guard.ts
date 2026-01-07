import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class AdminRolesGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('No user found in request.');
    }

    // Allow only super_admin and admin
    if (user.role !== 'super_admin' && user.role !== 'admin') {
      throw new ForbiddenException(
        'You do not have permission to perform this action.',
      );
    } else if (user.role === 'admin' || user.role === 'super_admin') {
      return true;
    }

    return false;
  }
}
