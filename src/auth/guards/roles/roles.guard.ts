import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../../auth/decorators/roles.decorator';
import { UserRole } from '../../../users/enums/userRole.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no role restriction, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Get authenticated user from request
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not found in request');
    }

    if (!user.role) {
      throw new ForbiddenException('User role is missing');
    }

    // Check if user’s role is allowed
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Access denied: Requires one of [${requiredRoles.join(', ')}]`,
      );
    }

    return true;
  }
}
