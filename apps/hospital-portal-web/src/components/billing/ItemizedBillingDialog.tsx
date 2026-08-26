'use client';

import { useState, useEffect } from 'react';
import { serviceCatalogApi, ServiceCatalogItem } from '@/lib/api/service-catalog.api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Plus, Trash2, Search, IndianRupee, AlertCircle } from 'lucide-react';
import { toast } from '@/lib/toast';
import { useBillItemTypes } from '@/hooks/use-billing-masters';

export interface BillItem {
  serviceCatalogId: string;
  serviceCode: string;
  serviceName: string;
  itemTypeCode?: string;
  itemTypeLabel?: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string;
}

interface ItemizedBillingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (items: BillItem[], summary: BillSummary) => void;
  initialItems?: BillItem[];
  patientName?: string;
}

export interface BillSummary {
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
}

export const ItemizedBillingDialog: React.FC<ItemizedBillingDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  initialItems = [],
  patientName,
}) => {
  const [items, setItems] = useState<BillItem[]>(initialItems);
  const { types: billItemTypes } = useBillItemTypes();
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [servicePopoverOpen, setServicePopoverOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceCatalogItem | null>(null);

  // New item form
  const [newItem, setNewItem] = useState({
    quantity: 1,
    discountPercent: 0,
    notes: '',
    itemTypeCode: '',
  });

  useEffect(() => {
    if (isOpen) {
      loadServices();
    }
  }, [isOpen]);

  useEffect(() => {
    if (billItemTypes.length > 0 && !newItem.itemTypeCode) {
      setNewItem((prev) => ({ ...prev, itemTypeCode: billItemTypes[0].value }));
    }
  }, [billItemTypes, newItem.itemTypeCode]);

  const loadServices = async () => {
    try {
      setLoading(true);
      const data = await serviceCatalogApi.getAll({ isActive: true });
      setServices(data);
    } catch (error) {
      console.error('Error loading services:', error);
      toast.error('Failed to load service catalog');
    } finally {
      setLoading(false);
    }
  };

  const searchServices = async (query: string) => {
    if (!query.trim()) {
      loadServices();
      return;
    }
    try {
      const results = await serviceCatalogApi.search(query);
      setServices(results);
    } catch (error) {
      console.error('Error searching services:', error);
    }
  };

  const calculateItemTotal = (
    price: number,
    quantity: number,
    discountPercent: number,
    taxRate: number
  ) => {
    const subtotal = price * quantity;
    const discountAmount = (subtotal * discountPercent) / 100;
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = (afterDiscount * taxRate) / 100;
    const total = afterDiscount + taxAmount;

    return {
      subtotal,
      discountAmount,
      taxAmount,
      total,
    };
  };

  const handleAddItem = () => {
    if (!selectedService) {
      toast.error('Please select a service');
      return;
    }

    if (newItem.quantity < 1) {
      toast.error('Quantity must be at least 1');
      return;
    }

    if (newItem.discountPercent < 0 || newItem.discountPercent > 100) {
      toast.error('Discount must be between 0% and 100%');
      return;
    }

    if (
      selectedService.discountAllowed === false &&
      newItem.discountPercent > 0
    ) {
      toast.error('Discount not allowed for this service');
      return;
    }

    if (newItem.discountPercent > selectedService.maxDiscountPercent) {
      toast.error(
        `Maximum discount allowed: ${selectedService.maxDiscountPercent}%`
      );
      return;
    }

    const calculation = calculateItemTotal(
      selectedService.basePrice,
      newItem.quantity,
      newItem.discountPercent,
      selectedService.taxRate
    );

    const itemType =
      billItemTypes.find((t) => t.value === newItem.itemTypeCode) ?? billItemTypes[0];

    const billItem: BillItem = {
      serviceCatalogId: selectedService.id,
      serviceCode: selectedService.code,
      serviceName: selectedService.name,
      itemTypeCode: itemType?.value,
      itemTypeLabel: itemType?.label,
      quantity: newItem.quantity,
      unitPrice: selectedService.basePrice,
      discountPercent: newItem.discountPercent,
      discountAmount: calculation.discountAmount,
      taxRate: selectedService.taxRate,
      taxAmount: calculation.taxAmount,
      totalAmount: calculation.total,
      notes: newItem.notes || undefined,
    };

    setItems([...items, billItem]);

    // Reset form
    setSelectedService(null);
    setNewItem({
      quantity: 1,
      discountPercent: 0,
      notes: '',
      itemTypeCode: billItemTypes[0]?.value ?? '',
    });
    setServicePopoverOpen(false);
    toast.success('Item added to bill');
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    toast.success('Item removed from bill');
  };

  const handleUpdateItemQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return;

    const item = items[index];
    const calculation = calculateItemTotal(
      item.unitPrice,
      quantity,
      item.discountPercent,
      item.taxRate
    );

    const updatedItems = [...items];
    updatedItems[index] = {
      ...item,
      quantity,
      discountAmount: calculation.discountAmount,
      taxAmount: calculation.taxAmount,
      totalAmount: calculation.total,
    };

    setItems(updatedItems);
  };

  const handleUpdateItemDiscount = (index: number, discountPercent: number) => {
    if (discountPercent < 0 || discountPercent > 100) return;

    const item = items[index];
    const calculation = calculateItemTotal(
      item.unitPrice,
      item.quantity,
      discountPercent,
      item.taxRate
    );

    const updatedItems = [...items];
    updatedItems[index] = {
      ...item,
      discountPercent,
      discountAmount: calculation.discountAmount,
      taxAmount: calculation.taxAmount,
      totalAmount: calculation.total,
    };

    setItems(updatedItems);
  };

  const calculateSummary = (): BillSummary => {
    const subtotal = items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );
    const totalDiscount = items.reduce((sum, item) => sum + item.discountAmount, 0);
    const totalTax = items.reduce((sum, item) => sum + item.taxAmount, 0);
    const grandTotal = items.reduce((sum, item) => sum + item.totalAmount, 0);

    return {
      subtotal,
      totalDiscount,
      totalTax,
      grandTotal,
    };
  };

  const handleSave = () => {
    if (items.length === 0) {
      toast.error('Please add at least one item to the bill');
      return;
    }

    const summary = calculateSummary();
    onSave(items, summary);
  };

  const summary = calculateSummary();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Itemized Billing</DialogTitle>
          <DialogDescription>
            {patientName
              ? `Create itemized bill for ${patientName}`
              : 'Add services and calculate bill'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add Service Section */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Service
            </h3>

            <div className="grid grid-cols-12 gap-4">
              {/* Service Selector */}
              <div className="col-span-5">
                <Label>Service</Label>
                <Popover open={servicePopoverOpen} onOpenChange={setServicePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {selectedService ? selectedService.name : 'Select service...'}
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0">
                    <Command>
                      <CommandInput
                        placeholder="Search services..."
                        onValueChange={(value) => {
                          setSearchQuery(value);
                          searchServices(value);
                        }}
                      />
                      <CommandList>
                        <CommandEmpty>No services found.</CommandEmpty>
                        <CommandGroup>
                          {services.map((service) => (
                            <CommandItem
                              key={service.id}
                              value={service.id}
                              onSelect={() => {
                                setSelectedService(service);
                                setServicePopoverOpen(false);
                              }}
                            >
                              <div className="flex flex-col flex-1">
                                <div className="font-medium">{service.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {service.code} • ₹{service.basePrice.toFixed(2)}
                                  {service.category && ` • ${service.category}`}
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {selectedService && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Base Price: ₹{selectedService.basePrice.toFixed(2)} • Tax:{' '}
                    {selectedService.taxRate}%
                  </p>
                )}
              </div>

              {/* Item Type */}
              <div className="col-span-3">
                <Label>Item Type</Label>
                <Select
                  value={newItem.itemTypeCode || billItemTypes[0]?.value}
                  onValueChange={(v) => setNewItem({ ...newItem, itemTypeCode: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select item type" />
                  </SelectTrigger>
                  <SelectContent>
                    {billItemTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quantity */}
              <div className="col-span-1">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={newItem.quantity}
                  onChange={(e) =>
                    setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })
                  }
                />
              </div>

              {/* Discount */}
              <div className="col-span-1">
                <Label>Discount %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={newItem.discountPercent}
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      discountPercent: parseFloat(e.target.value) || 0,
                    })
                  }
                  disabled={selectedService && !selectedService.discountAllowed}
                />
              </div>

              {/* Add Button */}
              <div className="col-span-2 flex items-end">
                <Button onClick={handleAddItem} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Additional notes for this service..."
                value={newItem.notes}
                onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          {/* Bill Items Table */}
          <div className="border rounded-lg">
            <div className="p-4 border-b bg-muted/50">
              <h3 className="font-semibold">Bill Items ({items.length})</h3>
            </div>

            {items.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No items added yet. Add services above to create the bill.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Discount %</TableHead>
                    <TableHead className="text-right">Discount Amt</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.serviceName}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.serviceCode}
                          </div>
                          {item.notes && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Note: {item.notes}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {item.itemTypeLabel ?? '—'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        ₹{item.unitPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateItemQuantity(
                              index,
                              parseInt(e.target.value) || 1
                            )
                          }
                          className="w-16 text-center"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={item.discountPercent}
                          onChange={(e) =>
                            handleUpdateItemDiscount(
                              index,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-20 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        ₹{item.discountAmount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        ₹{item.taxAmount.toFixed(2)}
                        <span className="text-xs text-muted-foreground ml-1">
                          ({item.taxRate}%)
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{item.totalAmount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Summary */}
          {items.length > 0 && (
            <div className="border rounded-lg p-4 bg-muted/30">
              <h3 className="font-semibold mb-3">Bill Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>₹{summary.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-green-600">
                  <span>Total Discount:</span>
                  <span>- ₹{summary.totalDiscount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total Tax:</span>
                  <span>+ ₹{summary.totalTax.toFixed(2)}</span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Grand Total:</span>
                    <span className="flex items-center">
                      <IndianRupee className="h-5 w-5 mr-1" />
                      {summary.grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={items.length === 0}>
            Save Bill ({items.length} items)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
