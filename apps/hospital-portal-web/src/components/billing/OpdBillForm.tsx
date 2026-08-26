'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, Plus, Trash2, Save, Printer, Calculator } from 'lucide-react';
import { getApi } from '@/lib/api';

interface BillItem {
  id: string;
  category: string;
  description: string;
  quantity: number;
  unitPrice: number;
  grossPrice: number;
  discountType: 'percentage' | 'amount' | 'none';
  discountValue: number;
  discountReason: string;
  netPrice: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalWithGst: number;
}

interface OpdBillFormProps {
  patientId: string;
  patientName: string;
  appointmentId?: string;
  onClose: () => void;
  onSuccess?: (billId: string) => void;
}

const ITEM_CATEGORIES = [
  'Consultation',
  'Diagnostic',
  'Lab Test',
  'Radiology',
  'Procedure',
  'Medicine',
  'Supplies',
  'Other'
];

const PREDEFINED_SERVICES = {
  'Consultation': [
    { name: 'General Consultation', price: 500 },
    { name: 'Specialist Consultation', price: 1000 },
    { name: 'Follow-up Consultation', price: 300 },
    { name: 'Emergency Consultation', price: 1500 },
  ],
  'Diagnostic': [
    { name: 'ECG', price: 300 },
    { name: 'X-Ray', price: 500 },
    { name: 'Ultrasound', price: 1000 },
    { name: 'CT Scan', price: 3000 },
    { name: 'MRI', price: 5000 },
  ],
  'Lab Test': [
    { name: 'Complete Blood Count (CBC)', price: 400 },
    { name: 'Blood Sugar', price: 150 },
    { name: 'Lipid Profile', price: 800 },
    { name: 'Liver Function Test', price: 600 },
    { name: 'Kidney Function Test', price: 600 },
  ],
  'Procedure': [
    { name: 'Dressing', price: 200 },
    { name: 'Injection', price: 100 },
    { name: 'Nebulization', price: 150 },
  ],
};

const GST_RATES = [
  { value: 0, label: '0% (Exempt)' },
  { value: 5, label: '5%' },
  { value: 12, label: '12%' },
  { value: 18, label: '18%' },
];

const INVOICE_TEMPLATES = [
  { id: 'general', name: 'General OPD' },
  { id: 'lab-preop', name: 'Lab Pre-OP' },
  { id: 'consultation', name: 'Consultation Only' },
  { id: 'diagnostic', name: 'Diagnostic Package' },
];

export default function OpdBillForm({ patientId, patientName, appointmentId, onClose, onSuccess }: OpdBillFormProps) {
  const api = getApi();

  // Bill state
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [invoiceType, setInvoiceType] = useState<'cash' | 'credit'>('cash');
  const [isInterState, setIsInterState] = useState(false);
  const [gstNumber, setGstNumber] = useState('27AABCU9603R1ZM'); // Hospital GST number
  
  // Discount & remarks
  const [additionalDiscount, setAdditionalDiscount] = useState(0);
  const [offerDiscount, setOfferDiscount] = useState(0);
  const [roundOffAmount, setRoundOffAmount] = useState(0);
  const [customerRemarks, setCustomerRemarks] = useState('');
  const [internalComments, setInternalComments] = useState('');
  
  // Payment
  const [payments, setPayments] = useState<any[]>([]);
  const [amountPaid, setAmountPaid] = useState(0);
  
  // Status
  const [saving, setSaving] = useState(false);
  const [billStatus, setBillStatus] = useState<'draft' | 'final' | 'paid'>('draft');

  // Add initial consultation fee if appointment exists
  useEffect(() => {
    if (appointmentId && billItems.length === 0) {
      const grossPrice = 1 * 1000;
      const newItem: BillItem = {
        id: Date.now().toString(),
        category: 'Consultation',
        description: 'Consultation Fee (CFEE)',
        quantity: 1,
        unitPrice: 1000,
        grossPrice,
        discountType: 'none',
        discountValue: 0,
        discountReason: '',
        netPrice: grossPrice,
        gstRate: 5,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalWithGst: grossPrice,
      };
      
      calculateItemTax(newItem);
      setBillItems([newItem]);
    }
  }, [appointmentId, billItems.length]);

  const addBillItem = (category: string, description: string, quantity: number, unitPrice: number, gstRate: number) => {
    const grossPrice = quantity * unitPrice;
    const newItem: BillItem = {
      id: Date.now().toString(),
      category,
      description,
      quantity,
      unitPrice,
      grossPrice,
      discountType: 'none',
      discountValue: 0,
      discountReason: '',
      netPrice: grossPrice,
      gstRate,
      cgst: 0,
      sgst: 0,
      igst: 0,
      totalWithGst: grossPrice,
    };
    
    calculateItemTax(newItem);
    setBillItems([...billItems, newItem]);
  };

  const calculateItemTax = (item: BillItem) => {
    // Calculate discount
    let discountAmount = 0;
    if (item.discountType === 'percentage') {
      discountAmount = (item.grossPrice * item.discountValue) / 100;
    } else if (item.discountType === 'amount') {
      discountAmount = item.discountValue;
    }
    
    item.netPrice = item.grossPrice - discountAmount;
    
    // Calculate GST
    const taxableAmount = item.netPrice;
    const gstAmount = (taxableAmount * item.gstRate) / 100;
    
    if (isInterState) {
      item.igst = gstAmount;
      item.cgst = 0;
      item.sgst = 0;
    } else {
      item.cgst = gstAmount / 2;
      item.sgst = gstAmount / 2;
      item.igst = 0;
    }
    
    item.totalWithGst = taxableAmount + gstAmount;
  };

  const updateBillItem = (index: number, updates: Partial<BillItem>) => {
    const newItems = [...billItems];
    newItems[index] = { ...newItems[index], ...updates };
    
    // Recalculate gross price if quantity or unit price changed
    if (updates.quantity !== undefined || updates.unitPrice !== undefined) {
      newItems[index].grossPrice = newItems[index].quantity * newItems[index].unitPrice;
    }
    
    calculateItemTax(newItems[index]);
    setBillItems(newItems);
  };

  const removeBillItem = (index: number) => {
    setBillItems(billItems.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const grossTotal = billItems.reduce((sum, item) => sum + item.grossPrice, 0);
    const itemDiscounts = billItems.reduce((sum, item) => {
      if (item.discountType === 'percentage') {
        return sum + (item.grossPrice * item.discountValue) / 100;
      } else if (item.discountType === 'amount') {
        return sum + item.discountValue;
      }
      return sum;
    }, 0);
    
    const subtotal = grossTotal - itemDiscounts - additionalDiscount - offerDiscount;
    
    const totalCgst = billItems.reduce((sum, item) => sum + item.cgst, 0);
    const totalSgst = billItems.reduce((sum, item) => sum + item.sgst, 0);
    const totalIgst = billItems.reduce((sum, item) => sum + item.igst, 0);
    const totalGst = totalCgst + totalSgst + totalIgst;
    
    const netTotal = subtotal + totalGst + roundOffAmount;
    const amountRemaining = netTotal - amountPaid;
    
    return {
      grossTotal,
      itemDiscounts,
      additionalDiscount,
      offerDiscount,
      totalDiscounts: itemDiscounts + additionalDiscount + offerDiscount,
      subtotal,
      totalCgst,
      totalSgst,
      totalIgst,
      totalGst,
      roundOffAmount,
      netTotal: Math.round(netTotal),
      amountPaid,
      amountRemaining: Math.round(amountRemaining),
    };
  };

  const totals = calculateTotals();

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const billData = {
        patientId,
        appointmentId,
        invoiceType,
        items: billItems,
        grossTotal: totals.grossTotal,
        totalDiscounts: totals.totalDiscounts,
        totalGst: totals.totalGst,
        netTotal: totals.netTotal,
        customerRemarks,
        internalComments,
        payments,
        status: 'draft',
      };
      
      const response = await api.post('/opdbills', billData);
      console.log('Bill saved as draft:', response.data);
      alert('Bill saved as draft successfully!');
      
      if (onSuccess) onSuccess(response.data.id);
    } catch (error: any) {
      console.error('Failed to save bill:', error);
      alert(error.response?.data?.message || 'Failed to save bill');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFinalBill = async () => {
    if (totals.amountRemaining > 0) {
      alert('Cannot finalize bill. Payment pending!');
      return;
    }
    
    setSaving(true);
    try {
      const billData = {
        patientId,
        appointmentId,
        invoiceType,
        items: billItems,
        grossTotal: totals.grossTotal,
        totalDiscounts: totals.totalDiscounts,
        totalGst: totals.totalGst,
        netTotal: totals.netTotal,
        customerRemarks,
        internalComments,
        payments,
        status: 'final',
      };
      
      const response = await api.post('/opdbills/finalize', billData);
      console.log('Bill finalized:', response.data);
      setBillStatus('paid');
      alert('Bill finalized successfully!');
      
      if (onSuccess) onSuccess(response.data.id);
    } catch (error: any) {
      console.error('Failed to finalize bill:', error);
      alert(error.response?.data?.message || 'Failed to finalize bill');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-xl w-full h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">OPD Bill</h2>
          <p className="text-sm text-gray-600">
            Patient: <span className="font-medium">{patientName}</span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-gray-500">GST No:</p>
            <p className="text-sm font-mono font-medium">{gstNumber}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Invoice Settings */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Type</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="cash"
                  checked={invoiceType === 'cash'}
                  onChange={(e) => setInvoiceType(e.target.value as 'cash')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm">Cash</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="credit"
                  checked={invoiceType === 'credit'}
                  onChange={(e) => setInvoiceType(e.target.value as 'credit')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm">Credit</span>
              </label>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Template</label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Template</option>
              {INVOICE_TEMPLATES.map(template => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="flex items-center gap-2 mt-8">
              <input
                type="checkbox"
                checked={isInterState}
                onChange={(e) => {
                  setIsInterState(e.target.checked);
                  // Recalculate all items
                  billItems.forEach((item, index) => {
                    calculateItemTax(item);
                  });
                  setBillItems([...billItems]);
                }}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm font-medium text-gray-700">Inter-State Supply (IGST)</span>
            </label>
          </div>
        </div>

        {/* Bill Items Table */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Billable Items</h3>
          <div className="border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price (₹)</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gross (₹)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discount</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net (₹)</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">GST %</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total (₹)</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {billItems.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <select
                        value={item.category}
                        onChange={(e) => updateBillItem(index, { category: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                      >
                        {ITEM_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateBillItem(index, { description: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        placeholder="Service description"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateBillItem(index, { quantity: parseInt(e.target.value) || 1 })}
                        className="w-16 px-2 py-1 text-sm text-center border border-gray-300 rounded"
                        min="1"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => updateBillItem(index, { unitPrice: parseFloat(e.target.value) || 0 })}
                        className="w-24 px-2 py-1 text-sm text-right border border-gray-300 rounded"
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{item.grossPrice.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <select
                          value={item.discountType}
                          onChange={(e) => updateBillItem(index, { discountType: e.target.value as any })}
                          className="px-2 py-1 text-xs border border-gray-300 rounded"
                        >
                          <option value="none">None</option>
                          <option value="percentage">%</option>
                          <option value="amount">₹</option>
                        </select>
                        {item.discountType !== 'none' && (
                          <>
                            <input
                              type="number"
                              value={item.discountValue}
                              onChange={(e) => updateBillItem(index, { discountValue: parseFloat(e.target.value) || 0 })}
                              className="w-16 px-2 py-1 text-xs text-right border border-gray-300 rounded"
                              min="0"
                            />
                            <input
                              type="text"
                              value={item.discountReason}
                              onChange={(e) => updateBillItem(index, { discountReason: e.target.value })}
                              className="w-20 px-2 py-1 text-xs border border-gray-300 rounded"
                              placeholder="Reason"
                            />
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{item.netPrice.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <select
                        value={item.gstRate}
                        onChange={(e) => updateBillItem(index, { gstRate: parseFloat(e.target.value) })}
                        className="w-20 px-2 py-1 text-xs text-center border border-gray-300 rounded"
                      >
                        {GST_RATES.map(rate => (
                          <option key={rate.value} value={rate.value}>{rate.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-blue-600">{item.totalWithGst.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => removeBillItem(index)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <button
            onClick={() => addBillItem('Consultation', '', 1, 0, 5)}
            className="mt-3 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 flex items-center gap-2 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Line Item
          </button>
        </div>

        {/* Remarks */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Remarks for Customer</label>
            <textarea
              value={customerRemarks}
              onChange={(e) => setCustomerRemarks(e.target.value)}
              rows={3}
              placeholder="Comments visible to customer..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Internal Comments <span className="text-xs text-gray-500">(Will not appear in print)</span>
            </label>
            <textarea
              value={internalComments}
              onChange={(e) => setInternalComments(e.target.value)}
              rows={3}
              placeholder="Internal notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Bill Summary */}
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="grid grid-cols-2 gap-8">
            {/* Left: Payment Details */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">PAYMENT RECEIVED DETAILS</h3>
              <div className="space-y-2">
                {payments.map((payment, index) => (
                  <div key={payment.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {index + 1}. {payment.paymentMode.toUpperCase()} ({new Date(payment.timestamp).toLocaleTimeString()})
                    </span>
                    <span className="font-medium text-gray-900">₹{payment.amount.toFixed(2)}</span>
                  </div>
                ))}
                {payments.length === 0 && (
                  <p className="text-sm text-gray-500 italic">No payments recorded</p>
                )}
              </div>
              
              <button
                type="button"
                disabled
                className="mt-4 w-full px-4 py-2 bg-gray-300 text-gray-700 rounded-lg flex items-center justify-center gap-2 text-sm font-medium cursor-not-allowed"
              >
                Collect is not available on this form
              </button>
              <p className="mt-2 text-xs text-gray-600">
                After this bill exists on the OpdBill ledger, collect from{' '}
                <Link href="/dashboard/billing/opd" className="underline font-medium text-blue-700">
                  Billing workstation
                </Link>
                {' '}using Collect payment. Do not use a second payment dialog.
              </p>
            </div>

            {/* Right: Bill Totals */}
            <div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Gross Bill Total:</span>
                  <span className="font-medium text-gray-900">{totals.grossTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Discount on Items:</span>
                  <span className="font-medium text-red-600">-{totals.itemDiscounts.toFixed(2)}</span>
                </div>
                
                {/* Additional Discounts */}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Additional Discount on Bill:</span>
                  <input
                    type="number"
                    value={additionalDiscount}
                    onChange={(e) => setAdditionalDiscount(parseFloat(e.target.value) || 0)}
                    className="w-24 px-2 py-1 text-sm text-right border border-gray-300 rounded"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Offer Discount on Bill:</span>
                  <input
                    type="number"
                    value={offerDiscount}
                    onChange={(e) => setOfferDiscount(parseFloat(e.target.value) || 0)}
                    className="w-24 px-2 py-1 text-sm text-right border border-gray-300 rounded"
                    min="0"
                    step="0.01"
                  />
                </div>
                
                <div className="flex justify-between text-sm font-medium border-t border-gray-300 pt-2">
                  <span className="text-gray-700">Total of all Discounts:</span>
                  <span className="text-red-600">-{totals.totalDiscounts.toFixed(2)}</span>
                </div>

                {/* GST Breakdown */}
                {!isInterState ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">CGST:</span>
                      <span className="font-medium text-gray-900">{totals.totalCgst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">SGST:</span>
                      <span className="font-medium text-gray-900">{totals.totalSgst.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">IGST:</span>
                    <span className="font-medium text-gray-900">{totals.totalIgst.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Round (+/-):</span>
                  <input
                    type="number"
                    value={roundOffAmount}
                    onChange={(e) => setRoundOffAmount(parseFloat(e.target.value) || 0)}
                    className="w-24 px-2 py-1 text-sm text-right border border-gray-300 rounded"
                    step="0.01"
                  />
                </div>

                <div className="flex justify-between text-lg font-bold border-t-2 border-gray-400 pt-2">
                  <span className="text-gray-900">Net Bill Total:</span>
                  <span className="text-blue-600">₹{totals.netTotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-sm font-medium bg-yellow-50 px-3 py-2 rounded">
                  <span className="text-gray-700">Amount Remaining:</span>
                  <span className={totals.amountRemaining > 0 ? 'text-red-600' : 'text-green-600'}>
                    ₹{totals.amountRemaining.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Note */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-800">
            <strong>Note:</strong> Once a final bill is saved you will no longer be able to remove items or make changes to the transactions saved.
          </p>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="border-t border-gray-200 px-6 py-4 flex justify-between items-center bg-gray-50">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 flex items-center gap-2 text-sm font-medium"
        >
          <Printer className="w-4 h-4" />
          Print Bill
        </button>
        
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium"
          >
            Close
          </button>
          <button
            onClick={handleSaveDraft}
            disabled={saving || billStatus === 'final' || billStatus === 'paid'}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 flex items-center gap-2 font-medium"
          >
            <Save className="w-4 h-4" />
            Save Draft
          </button>
          <button
            onClick={handleSaveFinalBill}
            disabled={saving || totals.amountRemaining > 0 || billStatus === 'final' || billStatus === 'paid'}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 flex items-center gap-2 font-medium"
          >
            <Calculator className="w-4 h-4" />
            Save Final Bill
          </button>
        </div>
      </div>
    </div>
  );
}
