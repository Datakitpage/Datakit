import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    // Add your custom authentication logic here
    // for example, call super.canActivate(context) to run the standard JWT authentication
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    // Don't throw an error if the user is not authenticated
    // Just return null/undefined which will be available as req.user
    if (err || !user) {
      return null;
    }
    return user;
  }
}