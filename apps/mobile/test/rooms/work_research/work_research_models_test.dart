import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/rooms/work_research/work_research_models.dart';

void main() {
  test('parses server-owned Work room projection', () {
    final projection = WorkResearchRoomProjection.fromJson({
      'kind': 'work-business',
      'title': 'Work & Business',
      'subtitle': 'Get practical work done.',
      'quickStarts': [
        {
          'intentId': 'prepare-document',
          'label': 'Prepare a document',
          'description': 'Draft or improve a useful document.',
          'iconKey': 'document',
        }
      ],
      'items': [
        {
          'itemId': 'work-1',
          'title': 'Proposal draft',
          'summary': 'Preparing the first draft.',
          'status': 'working',
          'progress': 0.5,
          'artifacts': [
            {
              'artifactId': 'a-1',
              'label': 'Proposal.docx',
              'kind': 'document',
              'uri': 'https://files.example.test/proposal.docx',
            }
          ],
          'evidence': [],
        }
      ],
    });

    expect(projection.kind, WorkResearchRoomKind.workBusiness);
    expect(projection.quickStarts.single.intentId, 'prepare-document');
    expect(projection.items.single.progress, 0.5);
    expect(projection.items.single.artifacts.single.uri?.scheme, 'https');
  });

  test('parses source-aware Research evidence', () {
    final projection = WorkResearchRoomProjection.fromJson({
      'kind': 'research-answers',
      'title': 'Research & Answers',
      'subtitle': 'Answers with sources.',
      'quickStarts': [],
      'items': [
        {
          'itemId': 'research-1',
          'title': 'Market comparison',
          'summary': 'Comparing current public evidence.',
          'status': 'completed',
          'progress': 1,
          'artifacts': [],
          'evidence': [
            {
              'evidenceId': 'e-1',
              'title': 'Primary source',
              'sourceUri': 'https://example.test/source',
              'publisher': 'Example',
              'observedAt': '2026-10-06T08:00:00Z',
            }
          ],
        }
      ],
    });

    expect(projection.items.single.evidence.single.publisher, 'Example');
    expect(projection.items.single.evidence.single.sourceUri.scheme, 'https');
  });

  test('rejects insecure evidence and artifact links', () {
    expect(
      () => WorkResearchEvidence.fromJson({
        'evidenceId': 'e-1',
        'title': 'Bad source',
        'sourceUri': 'http://example.test/source',
      }),
      throwsFormatException,
    );

    expect(
      () => WorkResearchArtifact.fromJson({
        'artifactId': 'a-1',
        'label': 'Bad file',
        'kind': 'document',
        'uri': 'file:///tmp/report.docx',
      }),
      throwsFormatException,
    );
  });

  test('rejects out-of-range progress', () {
    expect(
      () => WorkResearchItem.fromJson({
        'itemId': 'work-1',
        'title': 'Broken',
        'summary': '',
        'status': 'working',
        'progress': 1.2,
        'artifacts': [],
        'evidence': [],
      }),
      throwsFormatException,
    );
  });
}
