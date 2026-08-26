import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GroupedBillItems } from '@/components/billing/GroupedBillItems';
import {
  type ChargeLineItem,
  displayGroup,
  groupBillItems,
} from './group-bill-items';

function line(
  id: string,
  name: string,
  sourceType: string | null,
  amount: number,
  qty = 1,
): ChargeLineItem {
  return {
    id,
    serviceName: name,
    quantity: qty,
    unitPrice: amount,
    totalAmount: amount * qty,
    sourceType,
  };
}

function twentyLineCataractBill(): ChargeLineItem[] {
  return [
    line('p1', 'Phaco surgery', 'Package', 62000),
    line('p2', 'IOL — package allowance', 'Package', 18000),
    line('p3', 'OT charges', 'Package', 12000),
    line('p4', 'Day-care bed', 'Package', 8000),
    line('p5', 'Package discount', 'PackageDiscount', 0),
    line('i1', 'Alcon SN60WF +21.0 D', 'Implant', 14000),
    line('c1', 'Viscoelastic', 'Consumable', 1200),
    line('c2', 'Phaco cassette', 'Consumable', 1800),
    line('c3', 'Trypan blue', 'Consumable', 400),
    line('c4', 'BSS 500 ml', 'Consumable', 350),
    line('c5', 'Speculum', 'Consumable', 150),
    line('c6', 'Drape pack', 'Consumable', 2100),
    line('pr1', 'YAG capsulotomy (unrelated)', 'Procedure', 3500),
    line('r1', 'Day-care extra hour', 'Room', 800),
    line('m1', 'Counsellor add-on counselling', 'Manual', 500),
    line('m2', 'Manual suture', 'Manual', 200),
    line('m3', ' unnamed source', null, 100),
    line('m4', 'legacy blank', '', 50),
    line('pr2', 'Fundus photo', 'Procedure', 700),
    line('i2', 'Premium IOL upgrade', 'Implant', 8000),
  ];
}

describe('groupBillItems', () => {
  it('groups a 20-line cataract bill by source with package discount inside Package', () => {
    const groups = groupBillItems(twentyLineCataractBill());
    expect(groups.map((g) => g.sourceType)).toEqual([
      'Package',
      'Implant',
      'Consumable',
      'Procedure',
      'Room',
      'Manual',
    ]);
    expect(groups.find((g) => g.sourceType === 'Package')?.items).toHaveLength(5);
    expect(displayGroup('PackageDiscount')).toBe('Package');
    expect(groups.find((g) => g.sourceType === 'Package')?.subtotal).toBe(100000);
    expect(groups.find((g) => g.sourceType === 'Implant')?.subtotal).toBe(22000);
    expect(groups.find((g) => g.sourceType === 'Consumable')?.items).toHaveLength(6);
    expect(groups.find((g) => g.sourceType === 'Manual')?.items).toHaveLength(4);
    expect(groups.reduce((n, g) => n + g.items.length, 0)).toBe(20);
  });

  it('renders grouped sections with subtotals (snapshot)', () => {
    const html = renderToStaticMarkup(
      <GroupedBillItems items={twentyLineCataractBill()} />,
    );
    expect(html).toContain('data-source-group="Package"');
    expect(html).toContain('data-source-group="Implant"');
    expect(html).toContain('data-source-group="Consumable"');
    expect(html).toContain('Package discount');
    expect(html).toContain('Alcon SN60WF');
    expect(html).toContain('data-source-group="Manual"');
    expect((html.match(/data-source-group=/g) ?? []).length).toBe(6);
  });

  it('detail layout exposes charge columns for the billing workstation', () => {
    const html = renderToStaticMarkup(
      <GroupedBillItems items={twentyLineCataractBill()} layout="detail" />,
    );
    expect(html).toContain('Package');
    expect(html).toContain('Extra');
    expect(html).toContain('Description');
    expect(html).toContain('Phaco surgery');
  });
});
