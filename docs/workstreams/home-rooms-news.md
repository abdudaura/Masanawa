# Home/Rooms Lane N — News

Owner/window: ChatGPT Lane N implementation window
Branch: `work/home-rooms-news-20261006`
Base: `docs/home-rooms-launch-20261006` @ `f3aea97a1cf74736c567950ca3091eef91806406`
PR: #200
Task references: `docs/HOME-ROOMS-LAUNCH.md`, `docs/HOME-ROOMS-MULTI-WINDOW.md` Lane N
Last update: 2026-10-06

## Ownership

Exact owned paths:
- `apps/mobile/lib/src/rooms/news/news_models.dart`
- `apps/mobile/lib/src/rooms/news/news_room.dart`
- `apps/mobile/test/news_room_test.dart`
- `docs/workstreams/home-rooms-news.md`

Explicitly not owned:
- Gateway composition/router/main
- mobile app router/chat/transport
- Commerce/Event migrations
- production environment/configuration
- Story Radio, Home shell, Work/Research, Teaching, billing or admin control-plane paths

## Completed implementation

- Read-only `NewsRoomProjection` contract with admin-projected category order,
  visibility, featured item, pinning and room update time.
- Source-aware `NewsItem` article projection with title/summary/body, publish time,
  optional image, evidence references and optional audio presentation reference.
- Fail-closed rendering rule: every visible News item must carry at least one HTTPS
  source. Unsourced current-news projections throw before UI rendering.
- Hidden categories and their items are removed from the consumer projection.
- Optional audio assets are HTTPS-only and remain presentation references; this lane
  does not introduce a second playback/runtime engine.
- `NewsRoomView` with category filtering, featured story, pinned indicator,
  source metadata, listen callback and empty state.
- `NewsArticleView` with readable/selectable detail, source list, source-open callback
  and optional listen action.
- Widget/model tests cover source enforcement, hidden-category filtering, optional
  audio parsing and navigation delegation.

## Integration contract for #136

The shared transport owner should deserialize a server-owned projection shaped as:

```json
{
  "updatedAt": "2026-10-06T09:00:00Z",
  "featuredItemId": "news-item-id",
  "categories": [
    {"id": "world", "label": "World", "order": 0, "visible": true}
  ],
  "items": [
    {
      "id": "news-item-id",
      "title": "Headline",
      "summary": "Short sourced summary",
      "body": "Readable article/detail projection",
      "categoryId": "world",
      "publishedAt": "2026-10-06T08:30:00Z",
      "visible": true,
      "pinned": true,
      "evidenceRefs": ["opaque-evidence-ref"],
      "sources": [
        {
          "label": "Source title",
          "publisher": "Publisher",
          "url": "https://source.example/item"
        }
      ],
      "audio": {
        "assetUrl": "https://cdn.example/item.m4a",
        "durationSeconds": 65
      }
    }
  ]
}
```

Router/deep-link composition, network transport, source opening and reuse of the approved
audio player remain shared-owner work.

## Verification

- PR diff is limited to the four owned files above.
- PR #200 is mergeable relative to the Home/Rooms docs branch and is 0 commits behind.
- Foundation CI run `37444153192`: failed before checkout; job had zero steps.
- Mobile Build run `37444153306`: failed before checkout; job had zero steps.
- Those runs provide no application test result and match the repository's existing
  runner-allocation failure pattern.
- Manual compile-surface review completed after replacing an invalid font-weight token
  and ordering projected categories by the admin `order` field.
- No Flutter SDK is installed in the available execution container, so a genuine local
  `flutter test apps/mobile/test/news_room_test.dart` could not be executed here.

## Remaining dependencies

Only shared/integration ownership remains:
1. #136: provide the News projection transport, route/deep link and universal-room entry.
2. Authorized admin publishing lane / PR #129 coordination: create category/pinning/
   visibility commands; no direct DB shortcut.
3. Evidence-capable acquisition/research tooling: produce sourced current-news truth.
4. Shared approved audio system: bind `NewsAudioPresentation.assetUrl` to playback.
5. Run Flutter test/analyze once a working runner or Flutter toolchain is available.

## Status

Claim: COMPLETE — retained until integration/merge
Implementation: complete for isolated Lane N
Verification: code-level checks complete; hosted runner blocked before checkout
Deployment: not owned
