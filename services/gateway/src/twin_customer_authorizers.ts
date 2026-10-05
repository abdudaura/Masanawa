import type { PlatformCustomerSessionAuthorizer } from "./customer_auth.js";
import type { MyTwinAuthorizer } from "./my_twin_projection.js";
import type { TwinDirectoryAuthorizer } from "./twin_directory.js";
import type { TwinActivityAuthorizer } from "./twin_activity.js";
import type { WalletAuthorizer } from "./wallet_projection.js";

export interface TwinCustomerAuthorizers {
  readonly myTwin: MyTwinAuthorizer;
  readonly directory: TwinDirectoryAuthorizer;
  readonly activity: TwinActivityAuthorizer;
  readonly wallet: WalletAuthorizer;
}

export function createTwinCustomerAuthorizers(input: {
  readonly sessions: PlatformCustomerSessionAuthorizer;
}): TwinCustomerAuthorizers {
  async function identity(authorizationHeader: string | undefined) {
    const session = await input.sessions.authorize({ authorizationHeader });
    return Object.freeze({
      tenantId: session.tenantId,
      userId: session.userId,
    });
  }

  return Object.freeze({
    myTwin: Object.freeze({
      async authorize(request) {
        return identity(request.authorizationHeader);
      },
    }),
    directory: Object.freeze({
      async authorize(request) {
        return identity(request.authorizationHeader);
      },
    }),
    activity: Object.freeze({
      async authorize(request) {
        return identity(request.authorizationHeader);
      },
    }),
    wallet: Object.freeze({
      async authorize(request) {
        return identity(request.authorizationHeader);
      },
    }),
  });
}
