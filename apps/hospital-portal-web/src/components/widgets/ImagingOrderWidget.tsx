/**
 * Imaging Order Widget — all 17 tariff items across 5 groups
 */
'use client';

import React, { useState } from 'react';
import {
  Activity, CheckCircle2, AlertCircle, Clock,
  X as XIcon, Plus, IndianRupee, Check,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { WidgetProps } from '@/lib/widgets/widget-types';
import { getApi } from '@/lib/api';

type Modality =
  | 'ConsultationCharges'
  | 'AScan' | 'BScan' | 'FundusPhoto' | 'OCT' | 'OCTMacula' | 'CCT' | 'OCTRNFL' | 'AsOct' | 'HVFFields'
  | 'BarrageLaser' | 'PRPLaser' | 'YagCapsulotomy' | 'YagPI'
  | 'Chalazion' | 'BCL';

type Eye = 'RE' | 'LE' | 'BOTH';
type Urgency = 'Routine' | 'Urgent' | 'STAT';
type ModalityGroup = 'Consultation' | 'Diagnostic Scans' | 'Laser Procedures' | 'Minor Procedures';

interface ModalityConfig {
  label: string; price: number; group: ModalityGroup;
  hasEyeSelection: boolean; remarks: string; apiType: string;
}

interface ImagingOrder {
  id?: string;
  modality: Modality; eye: Eye; urgency: Urgency;
  specialInstructions?: string; orderedAt: string;
  status: 'Pending' | 'InProgress' | 'Completed'; estimatedCost?: number;
}

const MODALITY_CONFIG: Record<Modality, ModalityConfig> = {
  ConsultationCharges: { label: 'Consultation Charges', price: 500,  group: 'Consultation',     hasEyeSelection: false, remarks: 'Per Visit',    apiType: 'Consultation Charges' },
  AScan:               { label: 'A-Scan',               price: 1500, group: 'Diagnostic Scans', hasEyeSelection: true,  remarks: 'Per Eye',      apiType: 'A-Scan' },
  BScan:               { label: 'B-Scan',               price: 1000, group: 'Diagnostic Scans', hasEyeSelection: true,  remarks: 'Per Eye',      apiType: 'B-Scan' },
  FundusPhoto:         { label: 'Fundus Photo',          price: 500,  group: 'Diagnostic Scans', hasEyeSelection: true,  remarks: 'Per Eye',      apiType: 'Fundus Photo' },
  OCT:                 { label: 'OCT',                   price: 1500, group: 'Diagnostic Scans', hasEyeSelection: true,  remarks: 'Per Eye',      apiType: 'OCT' },
  OCTMacula:           { label: 'OCT Macula',            price: 1500, group: 'Diagnostic Scans', hasEyeSelection: true,  remarks: 'Per Eye',      apiType: 'OCT Macula' },
  CCT:                 { label: 'CCT',                   price: 500,  group: 'Diagnostic Scans', hasEyeSelection: true,  remarks: 'Per Eye',      apiType: 'CCT' },
  OCTRNFL:             { label: 'OCT RNFL',              price: 1500, group: 'Diagnostic Scans', hasEyeSelection: true,  remarks: 'Per Eye',      apiType: 'OCT RNFL' },
  AsOct:               { label: 'AS OCT',                price: 1500, group: 'Diagnostic Scans', hasEyeSelection: true,  remarks: 'Per Eye',      apiType: 'AS OCT' },
  HVFFields:           { label: 'HVF Fields',            price: 1000, group: 'Diagnostic Scans', hasEyeSelection: true,  remarks: 'Per Eye',      apiType: 'HVF Fields' },
  BarrageLaser:        { label: 'Barrage Laser',         price: 5000, group: 'Laser Procedures', hasEyeSelection: true,  remarks: 'Per Eye',      apiType: 'Barrage Laser' },
  PRPLaser:            { label: 'PRP Laser',             price: 3500, group: 'Laser Procedures', hasEyeSelection: true,  remarks: 'Per Eye',      apiType: 'PRP Laser' },
  YagCapsulotomy:      { label: 'YAG Capsulotomy',       price: 2500, group: 'Laser Procedures', hasEyeSelection: true,  remarks: 'Per Eye',      apiType: 'YAG Capsulotomy' },
  YagPI:               { label: 'YAG PI',                price: 3000, group: 'Laser Procedures', hasEyeSelection: true,  remarks: 'Per Eye',      apiType: 'YAG PI' },
  Chalazion:           { label: 'Chalazion Excision',    price: 5000, group: 'Minor Procedures', hasEyeSelection: true,  remarks: 'Per Eye',      apiType: 'Chalazion Excision' },
  BCL:                 { label: 'BCL',                   price: 500,  group: 'Minor Procedures', hasEyeSelection: true,  remarks: 'Per Eye',      apiType: 'BCL (Bandage Contact Lens)' },
};

const GROUP_ORDER: ModalityGroup[] = ['Consultation', 'Diagnostic Scans', 'Laser Procedures', 'Minor Procedures'];
const MODALITIES_BY_GROUP: Record<ModalityGroup, Modality[]> = {
  'Consultation':     ['ConsultationCharges'],
  'Diagnostic Scans': ['AScan', 'BScan', 'FundusPhoto', 'OCT', 'OCTMacula', 'CCT', 'OCTRNFL', 'AsOct', 'HVFFields'],
  'Laser Procedures': ['BarrageLaser', 'PRPLaser', 'YagCapsulotomy', 'YagPI'],
  'Minor Procedures': ['Chalazion', 'BCL'],
};

const EYE_BADGE: Record<Eye, string> = {
  RE: 'bg-blue-100 text-blue-700', LE: 'bg-purple-100 text-purple-700', BOTH: 'bg-teal-100 text-teal-700',
};
const EYE_LABEL: Record<Eye, string> = { RE: 'Right Eye', LE: 'Left Eye', BOTH: 'Both Eyes' };

export default function ImagingOrderWidget({ patientId, sessionId, data, onDataChange }: WidgetProps) {
  const api = getApi();
  const queryClient = useQueryClient();
  const [selectedModality, setSelectedModality] = useState<Modality | null>(null);
  const [eye, setEye] = useState<Eye>('RE');
  const [urgency, setUrgency] = useState<Urgency>('Routine');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [orders, setOrders] = useState<ImagingOrder[]>((data as any)?.orders || []);

  const config = selectedModality ? MODALITY_CONFIG[selectedModality] : null;
  const estimatedCost = config
    ? config.hasEyeSelection ? config.price * (eye === 'BOTH' ? 2 : 1) : config.price
    : 0;

  const handleSelectModality = (mod: Modality) => {
    setSelectedModality(mod);
    if (MODALITY_CONFIG[mod].hasEyeSelection) setEye('RE');
  };

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await api.post('/imaging/order', orderData);
      return response.data;
    },
    onSuccess: (responseData: any) => {
      toast.success('Order added');
      queryClient.invalidateQueries({ queryKey: ['imaging-orders'] });
      const snap = { modality: selectedModality!, eye, urgency, instructions: specialInstructions };
      const newOrder: ImagingOrder = {
        id: responseData?.id || responseData?.data?.id || undefined,
        modality: snap.modality, eye: snap.eye, urgency: snap.urgency,
        specialInstructions: snap.instructions, orderedAt: new Date().toISOString(),
        status: 'Pending', estimatedCost,
      };
      setOrders(prev => { const updated = [...prev, newOrder]; onDataChange?.({ orders: updated }); return updated; });
      setSpecialInstructions('');
    },
    onError: (error: any) => { toast.error(error.response?.data?.message || 'Failed to add order'); },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => { await api.delete(`/imaging/order/${orderId}`); },
    onError: (error: any) => { toast.error(error.response?.data?.message || 'Failed to remove order'); },
  });

  const handleDeleteOrder = (index: number) => {
    const order = orders[index];
    const updated = orders.filter((_, i) => i !== index);
    setOrders(updated); onDataChange?.({ orders: updated });
    if (order.id) deleteOrderMutation.mutate(order.id);
  };

  const handleCreateOrder = () => {
    if (!selectedModality) { toast.error('Please select a procedure'); return; }
    if (!patientId) { toast.error('Patient context not available'); return; }
    const cfg = MODALITY_CONFIG[selectedModality];
    const lateralityMap: Record<Eye, string> = { RE: 'Right', LE: 'Left', BOTH: 'Both' };
    createOrderMutation.mutate({
      patientId, sessionId, imagingType: cfg.apiType,
      laterality: cfg.hasEyeSelection ? lateralityMap[eye] : undefined,
      urgency, clinicalIndication: specialInstructions || undefined,
    });
  };

  const totalCost = orders.reduce((sum, o) => sum + (o.estimatedCost ?? 0), 0);

  return (
    <div className="flex gap-3 h-full p-3">
      {/* LEFT: Procedure selection */}
      <div className="w-1/2 flex flex-col gap-3 overflow-y-auto hide-scrollbar min-h-0">
        <h4 className="text-sm font-semibold text-gray-900 flex-shrink-0">Select Procedure / Test</h4>
        <div className="space-y-4 flex-1">
          {GROUP_ORDER.map(group => (
            <div key={group}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1 mb-1.5">{group}</p>
              <div className="space-y-1">
                {MODALITIES_BY_GROUP[group].map(mod => {
                  const cfg = MODALITY_CONFIG[mod];
                  const isSelected = selectedModality === mod;
                  return (
                    <button key={mod} type="button" onClick={() => handleSelectModality(mod)}
                      className={cn('w-full text-left px-3 py-2.5 rounded-lg border-2 transition-all',
                        isSelected ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200' : 'border-gray-200 bg-white hover:border-indigo-300')}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 leading-tight">{cfg.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{cfg.remarks}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs font-semibold text-green-700 flex items-center gap-0.5">
                            <IndianRupee className="w-3 h-3" />{cfg.price.toLocaleString('en-IN')}
                          </span>
                          {isSelected && <Check className="h-4 w-4 text-indigo-600" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Controls — appear after selection */}
        {selectedModality && config && (
          <div className="flex-shrink-0 border-t border-gray-200 pt-3 space-y-3">
            {config.hasEyeSelection && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Eye Selection <span className="text-red-400">*</span></label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['RE', 'LE', 'BOTH'] as Eye[]).map(e => (
                    <button key={e} type="button" onClick={() => setEye(e)}
                      className={cn('px-2 py-2 rounded-lg border-2 text-xs font-medium transition-all',
                        eye === e
                          ? e === 'RE' ? 'border-blue-500 bg-blue-50 text-blue-800'
                            : e === 'LE' ? 'border-purple-500 bg-purple-50 text-purple-800'
                            : 'border-teal-500 bg-teal-50 text-teal-800'
                          : 'border-gray-200 bg-white hover:border-gray-300 text-gray-600')}>
                      {EYE_LABEL[e]}
                    </button>
                  ))}
                </div>
                {config.price > 0 && (
                  <div className="mt-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg flex justify-between text-xs">
                    <span className="text-indigo-700">{eye === 'BOTH' ? `₹${config.price.toLocaleString('en-IN')} × 2 eyes` : `₹${config.price.toLocaleString('en-IN')} × 1 eye`}</span>
                    <span className="font-bold text-indigo-900">Est. ₹{estimatedCost.toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Urgency</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['Routine', 'Urgent', 'STAT'] as Urgency[]).map(u => (
                  <button key={u} type="button" onClick={() => setUrgency(u)}
                    className={cn('px-2 py-1.5 rounded-lg border-2 text-xs font-medium transition-all',
                      urgency === u
                        ? u === 'STAT' ? 'border-red-500 bg-red-50 text-red-800'
                          : u === 'Urgent' ? 'border-orange-500 bg-orange-50 text-orange-800'
                          : 'border-green-500 bg-green-50 text-green-800'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300')}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Instructions <span className="text-gray-400">(Optional)</span></label>
              <textarea value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)}
                placeholder="Special instructions for the technician..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none" rows={2} />
            </div>
            <button onClick={handleCreateOrder} disabled={createOrderMutation.isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm">
              {createOrderMutation.isPending
                ? <><Activity className="h-4 w-4 animate-spin" />Adding...</>
                : <><Plus className="h-4 w-4" />Add {config.label}</>}
            </button>
          </div>
        )}
      </div>

      {/* RIGHT: Ordered items + Confirm */}
      <div className="w-1/2 flex flex-col gap-3">
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-3 overflow-y-auto hide-scrollbar flex flex-col gap-2 min-h-0">
          <h4 className="text-sm font-semibold text-gray-900 flex-shrink-0">Ordered Items</h4>
          {orders.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
              <Activity className="h-8 w-8 text-gray-200 mb-2" />
              <p className="text-sm font-medium text-gray-400">No items ordered yet</p>
              <p className="text-xs text-gray-300 mt-1">Select a procedure on the left and tap Add</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {orders.map((order, index) => {
                  const cfg = MODALITY_CONFIG[order.modality];
                  return (
                    <div key={index} className="flex items-start justify-between p-2.5 bg-white rounded-lg border border-gray-200 gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-900 leading-tight">{cfg?.label ?? order.modality}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {cfg?.hasEyeSelection && (
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', EYE_BADGE[order.eye])}>{EYE_LABEL[order.eye]}</span>
                          )}
                          {order.urgency !== 'Routine' && (
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium',
                              order.urgency === 'STAT' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700')}>{order.urgency}</span>
                          )}
                          <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {new Date(order.orderedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {(order.estimatedCost ?? 0) > 0 && (
                          <span className="text-xs font-bold text-green-700">₹{order.estimatedCost!.toLocaleString('en-IN')}</span>
                        )}
                        <button onClick={() => handleDeleteOrder(index)} disabled={deleteOrderMutation.isPending}
                          title="Remove" className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
                          <XIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {totalCost > 0 && (
                <div className="pt-2 border-t border-gray-200 flex justify-between items-center flex-shrink-0">
                  <span className="text-xs font-medium text-gray-600">Total Estimated</span>
                  <span className="text-sm font-bold text-indigo-700">₹{totalCost.toLocaleString('en-IN')}</span>
                </div>
              )}
            </>
          )}
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2 flex-shrink-0">
          <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800">
            <span className="font-semibold">Imaging Department: </span>
            The imaging department will be notified automatically. Patient can proceed after counseling or on surgery day.
          </p>
        </div>
        <button onClick={() => onDataChange?.({ orders, confirmed: true })}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold text-sm flex-shrink-0">
          <CheckCircle2 className="h-4 w-4" />
          {orders.length > 0 ? `Confirm Imaging Orders (${orders.length})` : 'Confirm — No Imaging Needed'}
        </button>
      </div>
    </div>
  );
}
