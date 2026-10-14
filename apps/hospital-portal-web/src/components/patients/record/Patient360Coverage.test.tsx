import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Patient360CoverageView } from '@/components/patients/record/Patient360Coverage';
import { Patient360SectionNav } from '@/components/patients/record/Patient360SectionNav';

const profile = {
  id: 'p1',
  providerName: 'Apex Health',
  policyNumber: 'POL-1',
  groupNumber: 'G-9',
  policyType: 'primary',
  planName: null,
  subscriberName: 'Ada',
  subscriberId: 'MEM-4',
  subscriberRelation: 'self',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  status: 'active',
  copayAmount: '200',
  deductibleAmount: '1000',
  deductibleMet: '250',
  outOfPocketMax: '5000',
  outOfPocketMet: '250',
  deletedAt: null,
};

const noBills = { state: 'ready' as const, rows: [] };

describe('patient 360 coverage insurance profile', () => {
  it('renders the profile as policy values beside the financial source', () => {
    const html = renderToStaticMarkup(
      <>
        <Patient360SectionNav active="coverage" onSelect={() => undefined} />
        <Patient360CoverageView
          insurance={{ state: 'ready', rows: [profile] }}
          financial={noBills}
        />
      </>,
    );

    expect(html).toContain('>Coverage<');
    expect(html).toContain('>OPD billing<');
    expect(html).toContain('>Financial<');
    expect(html).toContain('Source: OPD bills');
    expect(html).toContain('No billing records found.');
    expect(html).toContain('>Insurance Profile<');
    expect(html).toContain('Source: Patient Insurance Profile');
    expect(html).toContain('>Payer<');
    expect(html).toContain('Apex Health');
    expect(html).toContain('Policy number');
    expect(html).toContain('POL-1');
    expect(html).toContain('Policy copay');
    expect(html).toContain('200');
    expect(html).toContain('Policy deductible');
    expect(html).toContain('Out-of-pocket maximum');
    expect(html).toContain('Status');
    expect(html).toContain('active');
    expect(html.match(/role="tab"/g)).toHaveLength(7);
    expect(html).not.toMatch(/Amount due|Outstanding|Patient balance|Account balance|Verify|Add Insurance|Current Insurance/i);
  });

  it('shows a deleted timestamp without calling the row current insurance', () => {
    const html = renderToStaticMarkup(
      <Patient360CoverageView
        insurance={{ state: 'ready', rows: [{ ...profile, deletedAt: '2026-03-01' }] }}
        financial={noBills}
      />,
    );
    expect(html).toContain('Deleted at');
    expect(html).toContain('2026-03-01');
    expect(html).toContain('active');
    expect(html).not.toMatch(/Current Insurance/i);
  });

  it('uses an empty sentence only after a successful empty read', () => {
    const empty = renderToStaticMarkup(
      <Patient360CoverageView insurance={{ state: 'ready', rows: [] }} financial={noBills} />,
    );
    const denied = renderToStaticMarkup(
      <Patient360CoverageView insurance={{ state: 'unauthorized', rows: [] }} financial={noBills} />,
    );
    const failed = renderToStaticMarkup(
      <Patient360CoverageView insurance={{ state: 'unavailable', rows: [] }} financial={noBills} />,
    );
    expect(empty).toContain('No insurance profile recorded.');
    expect(denied).toContain('Insurance profile is not available to this sign-in.');
    expect(denied).not.toContain('No insurance profile recorded.');
    expect(failed).toContain('Insurance profile is not available in Patient 360.');
    expect(failed).not.toContain('No insurance profile recorded.');
    expect(failed).not.toMatch(/No coverage/i);
  });
});

const bill = {
  id: 'b1',
  billNumber: 'OPD-1',
  billDate: '01 Sep 2026',
  status: 'Pending',
  netAmount: '₹1000.00',
  amountPaid: '₹400.00',
  balanceDue: '₹600.00',
  isFreeVisit: false,
};

describe('patient 360 coverage financial bills', () => {
  it('renders each stored bill and keeps an empty list distinct from failure', () => {
    const ready = renderToStaticMarkup(
      <Patient360CoverageView
        insurance={null}
        financial={{
          state: 'ready',
          rows: [bill, { ...bill, id: 'b2', billNumber: 'OPD-2', status: 'Paid', balanceDue: '₹0.00' }],
        }}
      />,
    );
    expect(ready).toContain('OPD-1');
    expect(ready).toContain('OPD-2');
    expect(ready).toContain('Pending');
    expect(ready).toContain('Paid');
    expect(ready).toContain('Net amount');
    expect(ready).toContain('₹1000.00');
    expect(ready).toContain('Balance due');
    expect(ready).toContain('₹600.00');
    expect(ready).not.toMatch(/Payment|Refund|Create Bill|Outstanding balance/i);

    const empty = renderToStaticMarkup(
      <Patient360CoverageView insurance={null} financial={{ state: 'ready', rows: [] }} />,
    );
    const denied = renderToStaticMarkup(
      <Patient360CoverageView insurance={null} financial={{ state: 'unauthorized', rows: [] }} />,
    );
    const failed = renderToStaticMarkup(
      <Patient360CoverageView insurance={null} financial={{ state: 'unavailable', rows: [] }} />,
    );
    expect(empty).toContain('No billing records found.');
    expect(denied).toContain('Financial information is not available to this sign-in.');
    expect(denied).not.toContain('No billing records found.');
    expect(failed).toContain('Financial information is not available in Patient 360.');
    expect(failed).not.toContain('No billing records found.');
  });
});

const coverageCase = {
  id: 'c1',
  caseNumber: 'CCMS-2526-000001',
  currentState: 'DRAFT',
  payerType: 'insurance',
  insurerName: 'Apex Assurance',
  paymentType: 'Insurance',
  preAuthNumber: 'PA-9',
  approvedAmount: '₹1500.00',
};

describe('patient 360 coverage cases', () => {
  it('renders coverage case fields separately from the insurance profile and financial bills', () => {
    const html = renderToStaticMarkup(
      <Patient360CoverageView
        insurance={{ state: 'ready', rows: [profile] }}
        financial={{ state: 'ready', rows: [bill] }}
        coverageCases={{ state: 'ready', rows: [coverageCase] }}
      />,
    );
    expect(html).toContain('>Coverage Cases<');
    expect(html).toContain('Source: CCMS Coverage Cases');
    expect(html).toContain('CCMS-2526-000001');
    expect(html).toContain('DRAFT');
    expect(html).toContain('Payer type');
    expect(html).toContain('insurance');
    expect(html).toContain('Pre-auth number');
    expect(html).toContain('PA-9');
    expect(html).toContain('Approved amount');
    expect(html).toContain('₹1500.00');
    expect(html).toContain('>Insurance Profile<');
    expect(html).toContain('Source: Patient Insurance Profile');
    expect(html).toContain('Apex Health');
    expect(html).toContain('Source: OPD bills');
    expect(html).toContain('OPD-1');
    expect(html).not.toMatch(/Create Coverage|Edit|Delete|Verify Eligibility|Upload|Approve Claim/i);
  });

  it('keeps an empty collection distinct from denial and server failure', () => {
    const empty = renderToStaticMarkup(
      <Patient360CoverageView
        insurance={null}
        financial={noBills}
        coverageCases={{ state: 'ready', rows: [] }}
      />,
    );
    const denied = renderToStaticMarkup(
      <Patient360CoverageView
        insurance={null}
        financial={noBills}
        coverageCases={{ state: 'unauthorized', rows: [coverageCase] }}
      />,
    );
    const failed = renderToStaticMarkup(
      <Patient360CoverageView
        insurance={null}
        financial={noBills}
        coverageCases={{ state: 'unavailable', rows: [coverageCase] }}
      />,
    );
    expect(empty).toContain('No coverage cases recorded.');
    expect(denied).toContain('Coverage information is not available to this sign-in.');
    expect(denied).not.toContain('CCMS-2526-000001');
    expect(denied).not.toContain('No coverage cases recorded.');
    expect(failed).toContain('Coverage information is unavailable.');
    expect(failed).not.toContain('CCMS-2526-000001');
    expect(failed).not.toContain('No coverage cases recorded.');
  });
});

const authorization = {
  id: 'a1',
  authorizationType: 'preauth',
  preAuthNumber: 'PA-1',
  processStatus: 'pending',
  requestedAmount: '₹1000.00',
  approvedAmount: '₹0.00',
  submittedAt: '2026-09-01',
  receivedAt: null,
  validFrom: null,
  validTo: null,
  tpaReferenceNumber: 'TPA-8',
  rejectionReason: null,
};

const secondAuthorization = {
  ...authorization,
  id: 'a2',
  authorizationType: 'enhancement',
  preAuthNumber: 'PA-2',
  processStatus: 'query_raised',
};

describe('patient 360 authorizations', () => {
  it('renders each authorization without collapsing them into one current record', () => {
    const html = renderToStaticMarkup(
      <Patient360CoverageView
        insurance={{ state: 'ready', rows: [profile] }}
        financial={{ state: 'ready', rows: [bill] }}
        coverageCases={{ state: 'ready', rows: [coverageCase] }}
        authorizations={{ state: 'ready', rows: [authorization, secondAuthorization] }}
      />,
    );
    expect(html).toContain('>Authorizations<');
    expect(html).toContain('Source: CCMS Authorization');
    expect(html).toContain('PA-1');
    expect(html).toContain('PA-2');
    expect(html).toContain('preauth');
    expect(html).toContain('enhancement');
    expect(html).toContain('pending');
    expect(html).toContain('query_raised');
    expect(html).toContain('Requested');
    expect(html).toContain('₹1000.00');
    expect(html).toContain('TPA reference');
    expect(html).toContain('TPA-8');
    expect(html).toContain('>Coverage Cases<');
    expect(html).toContain('CCMS-2526-000001');
    expect(html).toContain('>Insurance Profile<');
    expect(html).toContain('Apex Health');
    expect(html).toContain('Source: OPD bills');
    expect(html).toContain('OPD-1');
    expect(html).not.toMatch(/Current authorization|Create Authorization|Submit Authorization|Approve Authorization/i);
  });

  it('keeps an empty authorization collection distinct from denial and server failure', () => {
    const empty = renderToStaticMarkup(
      <Patient360CoverageView
        insurance={null}
        financial={noBills}
        authorizations={{ state: 'ready', rows: [] }}
      />,
    );
    const denied = renderToStaticMarkup(
      <Patient360CoverageView
        insurance={null}
        financial={noBills}
        authorizations={{ state: 'unauthorized', rows: [authorization] }}
      />,
    );
    const failed = renderToStaticMarkup(
      <Patient360CoverageView
        insurance={null}
        financial={noBills}
        authorizations={{ state: 'unavailable', rows: [authorization] }}
      />,
    );
    expect(empty).toContain('No authorizations recorded.');
    expect(denied).toContain('Authorization information is not available to this sign-in.');
    expect(denied).not.toContain('PA-1');
    expect(denied).not.toContain('No authorizations recorded.');
    expect(failed).toContain('Authorization information is unavailable.');
    expect(failed).not.toContain('PA-1');
    expect(failed).not.toContain('No authorizations recorded.');
    expect(empty).toContain('Source: OPD bills');
    expect(empty).toContain('Source: CCMS Coverage Cases');
  });
});

const eligibilityCheck = {
  id: 'e1',
  policyNumber: 'POL-1',
  membershipId: 'MEM-1',
  checkMethod: 'manual',
  responseCode: 'manual_entry',
  eligible: 'Eligible',
  checkedAt: '2026-09-01',
};

const secondEligibilityCheck = {
  ...eligibilityCheck,
  id: 'e2',
  policyNumber: 'POL-2',
  checkMethod: 'portal',
  eligible: 'Ineligible',
  checkedAt: '2026-08-01',
};

describe('patient 360 eligibility', () => {
  it('renders each eligibility check without collapsing them into one current record', () => {
    const html = renderToStaticMarkup(
      <Patient360CoverageView
        insurance={{ state: 'ready', rows: [profile] }}
        financial={{ state: 'ready', rows: [bill] }}
        coverageCases={{ state: 'ready', rows: [coverageCase] }}
        authorizations={{ state: 'ready', rows: [authorization] }}
        eligibility={{ state: 'ready', rows: [eligibilityCheck, secondEligibilityCheck] }}
      />,
    );
    expect(html).toContain('>Eligibility<');
    expect(html).toContain('Source: CCMS Eligibility');
    expect(html).toContain('POL-1');
    expect(html).toContain('POL-2');
    expect(html).toContain('MEM-1');
    expect(html).toContain('manual');
    expect(html).toContain('portal');
    expect(html).toContain('Eligible');
    expect(html).toContain('Ineligible');
    expect(html).toContain('Checked at');
    expect(html).toContain('>Authorizations<');
    expect(html).toContain('PA-1');
    expect(html).toContain('>Coverage Cases<');
    expect(html).toContain('CCMS-2526-000001');
    expect(html).toContain('>Insurance Profile<');
    expect(html).toContain('Apex Health');
    expect(html).toContain('Source: OPD bills');
    expect(html).toContain('OPD-1');
    expect(html).not.toMatch(/Current Eligibility|Record Eligibility|createEligibilityCheck/i);
  });

  it('keeps an empty eligibility collection distinct from denial and server failure', () => {
    const empty = renderToStaticMarkup(
      <Patient360CoverageView
        insurance={null}
        financial={noBills}
        eligibility={{ state: 'ready', rows: [] }}
      />,
    );
    const denied = renderToStaticMarkup(
      <Patient360CoverageView
        insurance={null}
        financial={noBills}
        eligibility={{ state: 'unauthorized', rows: [eligibilityCheck] }}
      />,
    );
    const failed = renderToStaticMarkup(
      <Patient360CoverageView
        insurance={null}
        financial={noBills}
        eligibility={{ state: 'unavailable', rows: [eligibilityCheck] }}
      />,
    );
    expect(empty).toContain('No eligibility records recorded.');
    expect(denied).toContain('Eligibility information is not available to this sign-in.');
    expect(denied).not.toContain('POL-1');
    expect(denied).not.toContain('No eligibility records recorded.');
    expect(failed).toContain('Eligibility information is unavailable.');
    expect(failed).not.toContain('POL-1');
    expect(failed).not.toContain('No eligibility records recorded.');
    expect(empty).toContain('Source: CCMS Authorization');
    expect(empty).toContain('Source: CCMS Coverage Cases');
  });
});

const claim = {
  id: 'cl1',
  claimNumber: 'CLM-1',
  claimType: 'cashless',
  status: 'active',
  queryStatus: 'none',
  submissionMode: 'manual',
  claimedAmount: '₹1000.00',
  submittedAt: '2026-09-01',
  acknowledgedAt: null,
  tpaClaimNumber: 'TPA-CLM-1',
  expectedSettlementDate: '2026-10-01',
};

const secondClaim = {
  ...claim,
  id: 'cl2',
  claimNumber: 'CLM-2',
  claimType: 'reimbursement',
  status: 'active',
  queryStatus: 'open',
};

describe('patient 360 claims', () => {
  it('renders each claim without collapsing them into one current record', () => {
    const html = renderToStaticMarkup(
      <Patient360CoverageView
        insurance={{ state: 'ready', rows: [profile] }}
        financial={{ state: 'ready', rows: [bill] }}
        coverageCases={{ state: 'ready', rows: [coverageCase] }}
        authorizations={{ state: 'ready', rows: [authorization] }}
        eligibility={{ state: 'ready', rows: [eligibilityCheck] }}
        claims={{ state: 'ready', rows: [claim, secondClaim] }}
      />,
    );
    expect(html).toContain('>Claims<');
    expect(html).toContain('Source: CCMS Claims');
    expect(html).toContain('CLM-1');
    expect(html).toContain('CLM-2');
    expect(html).toContain('cashless');
    expect(html).toContain('reimbursement');
    expect(html).toContain('Claimed amount');
    expect(html).toContain('₹1000.00');
    expect(html).toContain('Query status');
    expect(html).toContain('none');
    expect(html).toContain('open');
    expect(html).toContain('>Eligibility<');
    expect(html).toContain('POL-1');
    expect(html).toContain('>Authorizations<');
    expect(html).toContain('PA-1');
    expect(html).toContain('>Coverage Cases<');
    expect(html).toContain('CCMS-2526-000001');
    expect(html).toContain('>Insurance Profile<');
    expect(html).toContain('Apex Health');
    expect(html).toContain('Source: OPD bills');
    expect(html).toContain('OPD-1');
    expect(html).not.toMatch(/Current Claim|Create Claim|Submit Claim|Approve Claim|Adjudicate/i);
  });

  it('keeps an empty claim collection distinct from denial and server failure', () => {
    const empty = renderToStaticMarkup(
      <Patient360CoverageView
        insurance={null}
        financial={noBills}
        claims={{ state: 'ready', rows: [] }}
      />,
    );
    const denied = renderToStaticMarkup(
      <Patient360CoverageView
        insurance={null}
        financial={noBills}
        claims={{ state: 'unauthorized', rows: [claim] }}
      />,
    );
    const failed = renderToStaticMarkup(
      <Patient360CoverageView
        insurance={null}
        financial={noBills}
        claims={{ state: 'unavailable', rows: [claim] }}
      />,
    );
    expect(empty).toContain('No claims recorded.');
    expect(denied).toContain('Claims information is not available to this sign-in.');
    expect(denied).not.toContain('CLM-1');
    expect(denied).not.toContain('No claims recorded.');
    expect(failed).toContain('Claims information is unavailable.');
    expect(failed).not.toContain('CLM-1');
    expect(failed).not.toContain('No claims recorded.');
    expect(empty).toContain('Source: CCMS Eligibility');
    expect(empty).toContain('Source: OPD bills');
  });
});

describe('patient 360 coverage pagination', () => {
  it('shows page controls only when the server reports more than one page', () => {
    const paged = renderToStaticMarkup(
      <Patient360CoverageView
        insurance={null}
        financial={noBills}
        coverageCases={{ state: 'ready', rows: [coverageCase], totalCount: 21, pageNumber: 1, pageSize: 20 }}
        authorizations={{ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
        onCoverageCasesPageChange={() => undefined}
        onAuthorizationsPageChange={() => undefined}
      />,
    );
    expect(paged).toContain('CCMS-2526-000001');
    expect(paged).toContain('Showing 1–20 of 21');
    expect(paged).toContain('Coverage cases pagination');
    expect(paged).toContain('Source: CCMS Coverage Cases');
    expect(paged).not.toContain('Authorizations pagination');
    expect(paged).not.toContain('patients');

    const empty = renderToStaticMarkup(
      <Patient360CoverageView
        insurance={null}
        financial={noBills}
        coverageCases={{ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
        onCoverageCasesPageChange={() => undefined}
      />,
    );
    expect(empty).toContain('No coverage cases recorded.');
    expect(empty).not.toContain('Coverage cases pagination');

    const denied = renderToStaticMarkup(
      <Patient360CoverageView
        insurance={null}
        financial={noBills}
        claims={{ state: 'unauthorized', rows: [], totalCount: 0 }}
        onClaimsPageChange={() => undefined}
      />,
    );
    expect(denied).toContain('Claims information is not available to this sign-in.');
    expect(denied).not.toContain('Claims pagination');
  });
});

const settlement = {
  id: 's1',
  settlementNumber: 'STL-1',
  settlementType: 'partial',
  caseNumber: 'CC-1',
  claimNumber: 'CLM-1',
  settledAmount: '₹4000.00',
  claimAmount: '₹5000.00',
  paymentMode: 'NEFT',
  paymentReference: 'UTR-1',
  paymentDate: '2026-09-02',
  settledAt: '2026-09-02',
  reconciliationStatus: 'pending',
  createdAt: '2026-09-02',
};

describe('patient 360 settlement', () => {
  it('renders stored settlement fields without mutation controls', () => {
    const html = renderToStaticMarkup(
      <Patient360CoverageView
        insurance={{ state: 'ready', rows: [profile] }}
        financial={{ state: 'ready', rows: [bill] }}
        claims={{ state: 'ready', rows: [claim] }}
        settlements={{ state: 'ready', rows: [settlement], totalCount: 1, pageNumber: 1, pageSize: 20 }}
      />,
    );
    expect(html).toContain('>Financial<');
    expect(html).toContain('>Insurance<');
    expect(html).toContain('>Settlement<');
    expect(html).toContain('Source: CCMS Settlement');
    expect(html).toContain('STL-1');
    expect(html).toContain('partial');
    expect(html).toContain('CC-1');
    expect(html).toContain('CLM-1');
    expect(html).toContain('₹4000.00');
    expect(html).toContain('₹5000.00');
    expect(html).toContain('pending');
    expect(html).toContain('OPD-1');
    expect(html).toContain('Apex Health');
    expect(html).not.toMatch(/Record Payment|Reconcile|Reject|Refund|secret-bank|bankReference/i);
  });

  it('keeps empty settlement distinct from denial and server failure', () => {
    const empty = renderToStaticMarkup(
      <Patient360CoverageView
        insurance={null}
        financial={noBills}
        settlements={{ state: 'ready', rows: [] }}
      />,
    );
    const denied = renderToStaticMarkup(
      <Patient360CoverageView
        insurance={null}
        financial={noBills}
        settlements={{ state: 'unauthorized', rows: [] }}
      />,
    );
    const failed = renderToStaticMarkup(
      <Patient360CoverageView
        insurance={null}
        financial={noBills}
        settlements={{ state: 'unavailable', rows: [], totalCount: 40, pageNumber: 1, pageSize: 20 }}
        onSettlementsPageChange={() => undefined}
      />,
    );
    expect(empty).toContain('No settlement records found.');
    expect(denied).toContain('Settlement records are not available to this sign-in.');
    expect(denied).not.toContain('No settlement records found.');
    expect(failed).toContain('Settlement records are not available in Patient 360.');
    expect(failed).not.toContain('No settlement records found.');
    expect(failed).not.toContain('Settlements pagination');
  });

  it('pages a ready settlement list', () => {
    const html = renderToStaticMarkup(
      <Patient360CoverageView
        insurance={null}
        financial={noBills}
        settlements={{ state: 'ready', rows: [settlement], totalCount: 40, pageNumber: 1, pageSize: 20 }}
        onSettlementsPageChange={() => undefined}
      />,
    );
    expect(html).toContain('Settlements pagination');
  });
});
