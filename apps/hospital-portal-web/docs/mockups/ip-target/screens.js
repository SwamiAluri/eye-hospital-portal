/* Screen inventory shared by index.html and every screen mockup.
   Mirrors section 20.4 of ip-ward-ot-billing-coverage-target-architecture.md.
   `covers` lists every sub-view rendered inside that screen's file, so the
   inventory doubles as a completeness checklist. */

window.IP_SCREENS = [
  {
    id: 'S-01', file: 's-01-ip-census.html', title: 'IP Census',
    route: '/dashboard/ip-management', persona: 'IP coordinator', shell: 'Shell A',
    status: 'Modify', tasks: 'IP-001, IP-010',
    covers: [
      'Default board', 'Tab: Ready for OT', 'Tab: In OT', 'Tab: Ready for discharge', 'Tab: Cancelled',
      'Loading', 'Empty (filtered)', 'Error with stale data', 'Realtime down',
      'Responsive 1024-1280', 'Responsive <1024', 'Permission behaviour',
      'Row click: option comparison', 'Row click: overlay vs docked', 'Row click: six changes',
      'Row click: content zones', 'ID banner: right eye', 'ID banner: left eye',
      'ID banner: laterality not set', 'Row click: responsive rules',
    ],
  },
  {
    id: 'S-02', file: 's-02-patient-context-rail.html', title: 'Patient Context Rail',
    route: 'PatientContextRail (replaces PatientQuickPanel)', persona: 'All personas', shell: 'Rail / Sheet',
    status: 'Rebuild', tasks: 'IP-002',
    covers: [
      'Persona: ward / coordinator', 'Persona: cashier', 'Persona: surgeon / clinical', 'Persona: admin',
      'Docked in census', 'Sheet <1280', 'No selection', 'Loading', 'Partial failure', 'Clear / actionable',
      'Persona visibility matrix', 'Shared identification banner',
    ],
  },
  {
    id: 'S-03', file: 's-03-collect-payment.html', title: 'Collect Payment Drawer',
    route: 'CollectPaymentDrawer', persona: 'Cashier', shell: 'Shell C',
    status: 'New', tasks: 'FE-004, BILL-033',
    covers: [
      'Ledger append rows', 'Idempotency + receipt format', 'Messages', 
      'Bill exists', 'No bill yet', 'Success / receipt', 'Duplicate submit', 'Bill finalized',
      '409 concurrent cashier', 'Billing down', 'No permission',
    ],
  },
  {
    id: 'S-04', file: 's-04-ward-board.html', title: 'Ward Board',
    route: '/dashboard/ip-management/ward', persona: 'Ward nurse', shell: 'Shell A',
    status: 'Modify', tasks: 'UX-090',
    covers: [
      'Add observation + log', 'Add nursing note', 'Add progress note', 'Correcting a reading', 
      'Board + drawer', 'Transfer bed', 'Record vitals', "Cancel today's surgery", 'Cancel admission',
      'Rebook surgery', 'Send to OT', 'Empty ward', 'Loading', 'Bed conflict',
    ],
  },
  {
    id: 'S-05', file: 's-05-preop-workspace.html', title: 'Pre-Op Workspace',
    route: 'WardPreOpWorkspaceModal', persona: 'Ward nurse', shell: 'Shell B',
    status: 'Keep', tasks: '\u2014',
    covers: [
      'Bed history', 'Observation log + add', 'Consent history + documents', 'Result activity', 'Anaesthesia pre-op review', 'Clearance request trail', 'Add drug / record dose', 'Receipts (read-only)', 'Messages', 
      'Shell', 'Step 1 admission & bed', 'Step 2 clinical evaluation', 'Step 3 consent', 'Step 4 investigations',
      'Step 5 PAC assessment', 'Step 6 department clearance', 'Step 7 fasting & medication',
      'Step 8 coverage & finance', 'Footer: hard stops', 'Footer: warnings', 'Footer: clear',
    ],
  },
  {
    id: 'S-06', file: 's-06-ot-board.html', title: 'OT Board',
    route: '/dashboard/ip-management/operation-theatre', persona: 'OT coordinator', shell: 'Shell A',
    status: 'Modify', tasks: 'OT-020, UX-090',
    covers: [
      'Anaesthesia monitoring readings', 'Messages', 
      'Board', 'Pre-completion reconciliation', 'Accept into theatre', 'WHO sign in', 'WHO time out',
      'Intra-op note', 'WHO sign out', 'Cancel in theatre', 'List complete', 'Nobody ready', 'Overrunning case',
    ],
  },
  {
    id: 'S-07', file: 's-07-implant-scan.html', title: 'OT Implant Scan',
    route: 'ImplantScanPanel', persona: 'Surgeon / OT nurse', shell: 'Shell C',
    status: 'New', tasks: 'OT-020',
    covers: [
      'Items recorded for this case', 
      'Scan and confirm', 'Hard block: laterality', 'Hard block: power', 'Implanted / charged',
      'Opened not used (write-off)', 'Unopened return', 'Correction after charging', 'Manual entry fallback',
      'Consumables', 'Validation rules',
    ],
  },
  {
    id: 'S-08', file: 's-08-postop-workspace.html', title: 'Post-Op / Recovery',
    route: 'WardPostOpWorkspaceModal', persona: 'Recovery nurse', shell: 'Shell B',
    status: 'Modify', tasks: 'UX-090',
    covers: [
      'Returns & write-offs log', 'Record return dialog', 'Surgeon checklist', 'Messages', 
      'Shell', 'Step 1 recovery vitals', 'Step 2 nurse checklist', 'Step 3 IOL sticker & returns',
      'Step 4 post-op instructions', 'Step 5 follow-up & handover', 'Footer: incomplete',
      'Footer: complication', 'Footer: complete',
    ],
  },
  {
    id: 'S-09', file: 's-09-discharge-workspace.html', title: 'Discharge Workspace',
    route: 'WardDischargeWorkspaceModal', persona: 'Ward nurse', shell: 'Shell B',
    status: 'Modify', tasks: 'UX-090',
    covers: [
      'Summary history', 'Note templates', 'Add medication', 'Messages', 
      'Shell', 'Step 1 clearance', 'Step 2 discharge summary', 'Step 3 medications', 'Step 4 follow-up',
      'Step 5 confirm & discharge', 'All clear', 'Clinical block', 'Against medical advice',
    ],
  },
  {
    id: 'S-10', file: 's-10-journey-detail.html', title: 'Journey Detail',
    route: '/dashboard/ip-management/journey/[id]', persona: 'Coordinator / auditor', shell: 'Full page',
    status: 'Modify', tasks: 'FE-005',
    covers: [
      'Messages', 
      'Shell + 9-state lifecycle rail', 'Tab overview', 'Tab ward', 'Tab pre-op', 'Tab billing (read-only)',
      'Tab implants (new)', 'Tab OT', 'Tab post-op', 'Tab discharge', 'Tab audit',
    ],
  },
  {
    id: 'S-11', file: 's-11-ip-billing-dashboard.html', title: 'IP Billing Dashboard',
    route: '/dashboard/ip-management/billing', persona: 'Finance / billing', shell: 'Full page',
    status: 'Modify', tasks: 'SEC-041',
    covers: [
      'Refund queue', 'Messages', 
      'Default dashboard', 'Scope: finance', 'Scope: cashier', 'Scope: no permission',
      'Tab outstanding', 'Tab refunds pending', 'Tab unbilled implants', 'Tab claims unsent',
      'Loading', 'Nothing outstanding', 'Figures unavailable',
    ],
  },
  {
    id: 'S-12', file: 's-12-bill-detail.html', title: 'Bill Detail',
    route: '/dashboard/billing/opd', persona: 'Billing executive', shell: 'Full page',
    status: 'Modify', tasks: 'FE-003, BILL-030',
    covers: [
      'Ledger view', 'Refund: request', 'Refund: approve', 'Refund: pay out', 'Messages', 
      'Open bill', 'Add charge line', 'Apply discount', 'Credit note / reversal', 'Refund request',
      'Refund approve', 'Finalize', 'Finalized / locked', 'Claim rejected', 'Concurrent edit',
    ],
  },
  {
    id: 'S-13', file: 's-13-slot-board.html', title: 'Day-Care Slot Board',
    route: '/dashboard/ip-management/slots', persona: 'IP / OT coordinator', shell: 'Shell A',
    status: 'New', tasks: 'IP-013',
    covers: [
      'Messages', 
      'Slot board', 'Assign slot', 'Slot conflict', 'Re-sequence list', 'Release slot',
      'No list scheduled', 'Overbooked', 'Loading',
    ],
  },
  {
    id: 'S-14', file: 's-14-charge-mapping.html', title: 'Charge Exception & Catalog Mapping',
    route: '/dashboard/admin/charge-mapping', persona: 'Billing admin', shell: 'Full page',
    status: 'New', tasks: 'MD-055',
    covers: [
      'Mapping history', 'Messages', 
      'Unmapped items', 'Package component mapping', 'Create mapping', 'Backfill missed charges',
      'Change rate', 'Mark non-chargeable', 'All mapped', 'New items detected', 'Inventory unreachable',
    ],
  },
  {
    id: 'S-15', file: 's-15-reconciliation.html', title: 'Reconciliation & Wastage',
    route: '/dashboard/admin/charge-reconciliation', persona: 'Finance / stores', shell: 'Full page',
    status: 'New', tasks: 'INV-051',
    covers: [
      'Messages', 
      'Exception summary', 'Bucket 1 implanted not charged', 'Bucket 2 charged not implanted',
      'Bucket 3 stock out no usage', 'Bucket 4 package overlap', 'Bucket 5 unmapped',
      'Requeue', 'Adjustment on finalized bill', 'Clean run', 'Wastage report',
    ],
  },
  {
    id: 'S-16', file: 's-16-integration-health.html', title: 'Integration Health',
    route: '/dashboard/admin/integration-health', persona: 'IT admin', shell: 'Full page',
    status: 'New', tasks: 'OPS-070',
    covers: [
      'Two outboxes', 'Messages', 
      'Health board', 'Inspect event', 'Requeue', 'Bulk requeue', 'Abandon event',
      'All healthy', 'Backlog growing', 'Consumer down',
    ],
  },
  {
    id: 'S-17', file: 's-17-reason-confirm.html', title: 'Reason-Required Confirmation',
    route: 'ReasonConfirmDialog (shared)', persona: 'All personas', shell: 'Shell C',
    status: 'New', tasks: 'IP-011, UX-090',
    covers: [
      'Consumer matrix (verified)', 
      'Reverse clinical state', 'Destructive (releases bed)', 'Admin override', 'Emergency FC',
      'Reverse charged implant', 'Refund request', 'Cancel admission', 'Reason too short',
      'Submitting', 'Server rejected',
    ],
  },
  {
    id: 'S-18', file: 's-18-coverage-context.html', title: 'Coverage Context Block',
    route: 'CoverageContextBlock', persona: 'Coordinator / TPA', shell: 'Embedded block',
    status: 'Modify', tasks: 'IP-002',
    covers: [
      'Approved', 'Pending', 'Partially approved', 'Rejected', 'Self-pay', 'CCMS unreachable',
    ],
  },
];
