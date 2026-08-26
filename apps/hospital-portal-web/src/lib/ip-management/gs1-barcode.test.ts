import { describe, expect, it } from 'vitest';
import {
  GS1_UNREADABLE_MESSAGE,
  formatGs1Expiry,
  isManualIolSerial,
  parseGs1Barcode,
} from './gs1-barcode';

const MOCKUP = '01089012345678902188213101728063010B2291';
const PARENS = '(01)08901234567890(21)88213(10)B2291(17)280630';
const FNC1 = '01089012345678902188213\u001d10B2291\u001d17280630';
const DATAMATRIX = ']d201089012345678901728063010B22912188213';

describe('parseGs1Barcode', () => {
  it('parses parenthesized 01+21+10+17', () => {
    const r = parseGs1Barcode(PARENS);
    expect(r.parsed).toBe(true);
    expect(r.gtin).toBe('08901234567890');
    expect(r.serial).toBe('88213');
    expect(r.lot).toBe('B2291');
    expect(r.expiry).toBe('2028-06-30');
  });

  it('parses FNC1-separated 01+21+10+17', () => {
    const r = parseGs1Barcode(FNC1);
    expect(r.parsed).toBe(true);
    expect(r.serial).toBe('88213');
    expect(r.lot).toBe('B2291');
    expect(r.expiry).toBe('2028-06-30');
  });

  it('parses DataMatrix concatenated 01+17+10+21', () => {
    const r = parseGs1Barcode(DATAMATRIX);
    expect(r.parsed).toBe(true);
    expect(r.symbology).toBe('gs1-datamatrix');
    expect(r.gtin).toBe('08901234567890');
    expect(r.serial).toBe('88213');
    expect(r.lot).toBe('B2291');
  });

  it('recovers the W-07 mockup concatenated string', () => {
    const r = parseGs1Barcode(MOCKUP);
    expect(r.parsed).toBe(true);
    expect(r.gtin).toBe('08901234567890');
    expect(r.serial).toBe('88213');
    expect(r.lot).toBe('B2291');
    expect(formatGs1Expiry(r.expiry)).toMatch(/30 Jun 2028/);
  });

  it('marks invalid GS1 unreadable', () => {
    const r = parseGs1Barcode('01XX');
    expect(r.parsed).toBe(false);
    expect(r.unreadable).toBe(true);
    expect(GS1_UNREADABLE_MESSAGE).toBe(
      'This barcode could not be read. Enter the serial from the pack. Do not guess the power.',
    );
  });

  it('keeps a non-GS1 serial ≥5 as manual/raw', () => {
    expect(isManualIolSerial('88213')).toBe(true);
    const r = parseGs1Barcode('88213');
    expect(r.parsed).toBe(false);
    expect(r.unreadable).toBe(false);
    expect(r.symbology).toBe('raw');
  });
});
