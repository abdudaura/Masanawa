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

  test('Home quick-service intents select the matching billing category', () {
    expect(
      billingCategoryForHomeService(categories, 'data')?.code,
      'MOBILE_DATA',
    );
    expect(
      billingCategoryForHomeService(categories, 'airtime')?.code,
      'AIRTIME',
    );
    expect(
      billingCategoryForHomeService(categories, 'electricity')?.code,
      'ELECTRICITY',
    );
    expect(
      billingCategoryForHomeService(categories, 'tv')?.code,
      'CABLE_TV',
    );
  });

  test('unknown Home service does not guess a billing category', () {
    expect(billingCategoryForHomeService(categories, 'unknown'), isNull);
    expect(billingCategoryForHomeService(categories, null), isNull);
  });
}
