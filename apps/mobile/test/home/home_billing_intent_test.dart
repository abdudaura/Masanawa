import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/api/billing_models.dart';
import 'package:masanawa/src/screens/billing/billing_screen.dart';

void main() {
  const categories = [
    BillCategory(
      code: 'AIRTIME',
      name: 'Airtime',
      description: null,
      country: 'NG',
    ),
    BillCategory(
      code: 'MOBILE_DATA',
      name: 'Data Bundles',
      description: null,
      country: 'NG',
    ),
    BillCategory(
      code: 'ELECTRICITY',
      name: 'Electricity',
      description: null,
      country: 'NG',
    ),
    BillCategory(
      code: 'CABLE_TV',
      name: 'Cable TV',
      description: null,
      country: 'NG',
    ),
  ];

  test('only the data bundle intent is still available', () {
    expect(
      billingCategoryForHomeService(categories, 'data')?.code,
      'MOBILE_DATA',
    );
    expect(billingCategoryForHomeService(categories, 'airtime'), isNull);
    expect(billingCategoryForHomeService(categories, 'electricity'), isNull);
    expect(billingCategoryForHomeService(categories, 'tv'), isNull);
  });

  test('missing or unknown Home service cannot silently open a bill purchase', () {
    expect(billingCategoryForHomeService(categories, 'unknown'), isNull);
    expect(billingCategoryForHomeService(categories, null), isNull);
  });
}
