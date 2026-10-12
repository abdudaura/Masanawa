# Incoming Masana calls

Owner-directed continuation of merged AF11. Contacts remain current platform Masana only; no personal Twins or human consumer calling. Preserve all main history, group and paid-voice contracts.

Use durable tenant/account-scoped incoming records with ringing, accepted, declined, cancelled and missed states. Timeout is server-clock driven; terminal states never revive. Initiation and cancellation require dedicated server runtime authorization, never ordinary consumer bearer authority. Initiation is idempotent with a request identity and current visible platform roster validation. Expiry creates missed history even without a mobile client. Push delivery uses existing account push registrations, metadata only, a durable retry outbox and no token/audio persistence.

Consumer endpoints list/get ringing invitations and atomically accept or decline using existing session authorization and persona scope. Media issuance is separate after explicit accept, with existing paid-voice admission and token service. Preserve one incoming history identity; connected/end client reports remain informational. Late/duplicate actions and concurrent cancellation/acceptance must have deterministic behavior; provider failures must not resurrect ringing.

Flutter receives foreground/opened/initial push hints and resumes via an incoming call destination. It fetches authoritative account-scoped state, offers accept/decline, obtains the existing quote and explicit consent before token/media setup, and uses the existing live voice cleanup and billing recovery. Poll/resume catches cancellation/timeout and dropped pushes. Account changes dispose pending operations and media. No background auto-accept or token persistence. Expired hints show terminal/missed state without ringing.

Source/local verification, signed device/provider qualification, and deployment claims are separate. Tests cover auth/tenant/persona denial, races/replay/timeout/history, push failure recovery and mobile account/lifecycle handling. No production provider calls or spending in source verification.
