/**
 * Enterprise LMS permission codes (Variant B+).
 *
 * Workspace gate (L0): `lms.view`
 * Catalogue (L-CAT-01B, PD-CAT-01/04 closure): view / manage / approve
 *
 * Do not seed/grant catalogue codes into production roles without PD-CAT-02.
 * Intentionally distinct from Pathology `laboratory.view`.
 */

export const LMS_VIEW = 'lms.view';

/** PD-CAT-01 / PD-CAT-04 — catalogue capability keys (not seeded in L-CAT-01A). */
export const LMS_CATALOGUE_PERMISSIONS = {
  view: 'lms.catalogue.view',
  manage: 'lms.catalogue.manage',
  approve: 'lms.catalogue.approve',
} as const;

/** PD-ORD-15 — order capability keys (definitions seeded; no role grants). */
export const LMS_ORDERS_PERMISSIONS = {
  view: 'lms.orders.view',
  create: 'lms.orders.create',
  manage: 'lms.orders.manage',
} as const;

/** PD-COL-17 — collection capability keys (definitions seeded; no role grants). */
export const LMS_COLLECTION_PERMISSIONS = {
  view: 'lms.collection.view',
  manage: 'lms.collection.manage',
  collect: 'lms.collection.collect',
} as const;

/** PD-COL-SPC-16 / L-COL-01E — specimen capability keys (definitions seeded; no role grants). */
export const LMS_SPECIMENS_PERMISSIONS = {
  view: 'lms.specimens.view',
  manage: 'lms.specimens.manage',
  receive: 'lms.specimens.receive',
  barcodeView: 'lms.specimens.barcode.view',
  labelPrint: 'lms.specimens.label.print',
  labelReprint: 'lms.specimens.label.reprint',
} as const;

/** L-TST-01A / L-VER-01 — testing capability keys (definitions seeded; no role grants). */
export const LMS_TESTING_PERMISSIONS = {
  view: 'lms.testing.view',
  manage: 'lms.testing.manage',
  result: 'lms.testing.result',
  verify: 'lms.testing.verify',
} as const;

/** L-AUTH-01 — Clinical Authorization (definition seeded; no role grants). */
export const LMS_RESULTS_PERMISSIONS = {
  authorize: 'lms.results.authorize',
} as const;

/** L-CRT-01 — Critical Results (definitions seeded; no role grants). */
export const LMS_CRITICAL_PERMISSIONS = {
  view: 'lms.results.critical.view',
  manage: 'lms.results.critical.manage',
  acknowledge: 'lms.results.critical.acknowledge',
} as const;

/**
 * LMS Reports (definitions seeded; no role grants).
 * generate is L-REP-03 CUT B; download is L-REP-03 CUT C (no role grants).
 */
export const LMS_REPORTS_PERMISSIONS = {
  view: 'lms.reports.view',
  manage: 'lms.reports.manage',
  finalize: 'lms.reports.finalize',
  release: 'lms.reports.release',
  download: 'lms.reports.download',
  assignNumber: 'lms.reports.assign_number',
  generate: 'lms.reports.generate',
} as const;

/** Planned area codes — future slices; not used as page gates yet. */
export const LMS_PLANNED_PERMISSIONS = {
  ordersView: LMS_ORDERS_PERMISSIONS.view,
  ordersCreate: LMS_ORDERS_PERMISSIONS.create,
  ordersManage: LMS_ORDERS_PERMISSIONS.manage,
  collectionView: LMS_COLLECTION_PERMISSIONS.view,
  collectionManage: LMS_COLLECTION_PERMISSIONS.manage,
  collectionCollect: LMS_COLLECTION_PERMISSIONS.collect,
  specimensView: LMS_SPECIMENS_PERMISSIONS.view,
  specimensManage: LMS_SPECIMENS_PERMISSIONS.manage,
  specimensReceive: LMS_SPECIMENS_PERMISSIONS.receive,
  specimensBarcodeView: LMS_SPECIMENS_PERMISSIONS.barcodeView,
  specimensLabelPrint: LMS_SPECIMENS_PERMISSIONS.labelPrint,
  specimensLabelReprint: LMS_SPECIMENS_PERMISSIONS.labelReprint,
  testingView: LMS_TESTING_PERMISSIONS.view,
  testingManage: LMS_TESTING_PERMISSIONS.manage,
  testingResult: LMS_TESTING_PERMISSIONS.result,
  resultsView: 'lms.results.view',
  resultsAuthorize: LMS_RESULTS_PERMISSIONS.authorize,
  authorizationView: 'lms.authorization.view',
  reportsView: LMS_REPORTS_PERMISSIONS.view,
  reportsManage: LMS_REPORTS_PERMISSIONS.manage,
  referralsView: 'lms.referrals.view',
  qualityView: 'lms.quality.view',
  billingView: 'lms.billing.view',
  analyticsView: 'lms.analytics.view',
  configurationView: 'lms.configuration.view',
  administrationView: 'lms.administration.view',
  ...LMS_CATALOGUE_PERMISSIONS,
  ...LMS_ORDERS_PERMISSIONS,
  ...LMS_COLLECTION_PERMISSIONS,
  ...LMS_SPECIMENS_PERMISSIONS,
  ...LMS_TESTING_PERMISSIONS,
} as const;

export type LmsPlannedPermission =
  (typeof LMS_PLANNED_PERMISSIONS)[keyof typeof LMS_PLANNED_PERMISSIONS];

/** Existing Pathology Laboratory module — do not reuse for Enterprise LMS gates. */
export const LEGACY_LABORATORY_VIEW = 'laboratory.view';
