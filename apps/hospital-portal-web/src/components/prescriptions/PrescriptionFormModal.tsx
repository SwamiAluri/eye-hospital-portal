'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, AlertTriangle, Search, Pill } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MedicationSearchCombobox } from './MedicationSearchCombobox';
import { prescriptionApi } from '@/lib/api/prescriptions.api';
import { useConfirmation } from '@/components/common/ConfirmationDialog';
import { useMasterListOptions } from '@/hooks/use-master-list-options';

interface Patient {
  id: string;
  name: string;
  mrn: string;
  dateOfBirth: Date;
  allergies?: string;
}

interface Medication {
  id: string;
  medicationName: string;
  genericName?: string;
  dosage: string;
  form: string;
  route: string;
  frequency: string;
  durationDays: number;
  quantity: number;
  instructions?: string;
  isCritical: boolean;
}

interface DrugInteraction {
  drug1Name: string;
  drug2Name: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  management: string;
}

interface Props {
  patients: Patient[];
  onClose: () => void;
  onSuccess: (prescription: any) => void;
}

const formOptions = [
  'Tablet',
  'Capsule',
  'Eye Drops',
  'Syrup',
  'Injection',
  'Ointment',
  'Gel',
];

const routeOptions = [
  'Oral',
  'Ocular',
  'Topical',
  'Intramuscular',
  'Intravenous',
  'Subcutaneous',
];

const frequencyOptions = [
  'Once daily',
  'Twice daily',
  'Three times daily',
  'Four times daily',
  'Every 6 hours',
  'Every 8 hours',
  'Every 12 hours',
  'As needed',
  'At bedtime',
];

export function PrescriptionFormModal({ patients, onClose, onSuccess }: Props) {
  const { labels: formLabels } = useMasterListOptions('pharmacy.drug_form', formOptions);
  const { labels: routeLabels } = useMasterListOptions('pharmacy.drug_route', routeOptions);
  const { labels: frequencyLabels } = useMasterListOptions('pharmacy.dosage_frequency', frequencyOptions);

  const [step, setStep] = useState(1);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [diagnosis, setDiagnosis] = useState('');
  const [instructions, setInstructions] = useState('');
  const [durationDays, setDurationDays] = useState('7');
  const [followUpDate, setFollowUpDate] = useState('');
  const [medications, setMedications] = useState<Medication[]>([]);
  const [currentMedication, setCurrentMedication] = useState<Partial<Medication>>({
    medicationName: '',
    dosage: '',
    form: 'Eye Drops',
    route: 'Ocular',
    frequency: 'Twice daily',
    durationDays: 7,
    quantity: 1,
    isCritical: false,
  });
  const [interactions, setInteractions] = useState<DrugInteraction[]>([]);
  const [allergyWarnings, setAllergyWarnings] = useState<string[]>([]);
  const [isCheckingInteractions, setIsCheckingInteractions] = useState(false);
  const [loading, setLoading] = useState(false);

  const { showConfirmation, ConfirmationComponent } = useConfirmation();

  const checkDrugInteractions = async () => {
    if (medications.length < 2 && !selectedPatient) return;

    setIsCheckingInteractions(true);
    try {
      const medicationNames = medications.map((m) => m.medicationName);
      
      const response = await prescriptionApi.checkInteractions({
        patientId: selectedPatient?.id,
        medicationNames,
      });

      setInteractions(response.data.drugInteractions.map(i => ({
        drug1Name: i.drug1Name,
        drug2Name: i.drug2Name,
        severity: i.severity,
        description: i.description,
        management: i.clinicalManagement,
      })));

      setAllergyWarnings(response.data.allergyWarnings);
    } catch (error) {
      console.error('Error checking interactions:', error);
      toast.error('Failed to check drug interactions');
    } finally {
      setIsCheckingInteractions(false);
    }
  };

  useEffect(() => {
    checkDrugInteractions();
  }, [medications]);

  const addMedication = () => {
    if (!currentMedication.medicationName || !currentMedication.dosage) {
      alert('Please fill in required medication fields');
      return;
    }

    const newMedication: Medication = {
      id: `MED-${Date.now()}`,
      medicationName: currentMedication.medicationName!,
      genericName: currentMedication.genericName,
      dosage: currentMedication.dosage!,
      form: currentMedication.form || 'Eye Drops',
      route: currentMedication.route || 'Ocular',
      frequency: currentMedication.frequency || 'Twice daily',
      durationDays: currentMedication.durationDays || 7,
      quantity: currentMedication.quantity || 1,
      instructions: currentMedication.instructions,
      isCritical: currentMedication.isCritical || false,
    };

    setMedications([...medications, newMedication]);
    setCurrentMedication({
      medicationName: '',
      dosage: '',
      form: 'Eye Drops',
      route: 'Ocular',
      frequency: 'Twice daily',
      durationDays: 7,
      quantity: 1,
      isCritical: false,
    });
  };

  const removeMedication = (id: string) => {
    setMedications(medications.filter((m) => m.id !== id));
  };

  const handleSubmit = async () => {
    if (!selectedPatient) {
      alert('Please select a patient');
      return;
    }

    if (!diagnosis.trim()) {
      alert('Please enter a diagnosis');
      return;
    }

    if (medications.length === 0) {
      alert('Please add at least one medication');
      return;
    }

    if (interactions.some((i) => i.severity === 'high')) {
      if (!confirm('HIGH SEVERITY drug interaction detected. Are you sure you want to continue?')) {
        return;
      }
    }

    if (allergyWarnings.length > 0) {
      showConfirmation({
        title: 'Allergy Warning',
        message: `Patient is allergic to ${allergyWarnings.join(', ')}. Continue anyway?`,
        variant: 'danger',
        confirmText: 'Continue Anyway',
        onConfirm: async () => {
          setLoading(true);
          try {
            const response = await prescriptionApi.create({
              patientId: selectedPatient.id,
              diagnosis,
              instructions,
              treatmentDurationDays: parseInt(durationDays) || undefined,
              followUpDate: followUpDate || undefined,
              medications: medications.map((m) => ({
                medicationName: m.medicationName,
                genericName: m.genericName,
                dosage: m.dosage,
                form: m.form,
                route: m.route,
                frequency: m.frequency,
                durationDays: m.durationDays,
                quantity: m.quantity,
                instructions: m.instructions,
                isCritical: m.isCritical,
              })),
            });

            toast.success('Prescription created successfully');
            onSuccess(response.data);
          } catch (error: any) {
            console.error('Error creating prescription:', error);
            const errorMessage = error.response?.data?.message || 'Failed to create prescription';
            toast.error(errorMessage);
          } finally {
            setLoading(false);
          }
        },
      });
      return;
    }

    setLoading(true);
    try {
      const response = await prescriptionApi.create({
        patientId: selectedPatient.id,
        diagnosis,
        instructions,
        treatmentDurationDays: parseInt(durationDays) || undefined,
        followUpDate: followUpDate || undefined,
        medications: medications.map((m) => ({
          medicationName: m.medicationName,
          genericName: m.genericName,
          dosage: m.dosage,
          form: m.form,
          route: m.route,
          frequency: m.frequency,
          durationDays: m.durationDays,
          quantity: m.quantity,
          instructions: m.instructions,
          isCritical: m.isCritical,
        })),
      });

      toast.success('Prescription created successfully');
      onSuccess(response.data);
    } catch (error: any) {
      console.error('Error creating prescription:', error);
      const errorMessage = error.response?.data?.message || 'Failed to create prescription';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const canProceedToStep2 = selectedPatient && diagnosis.trim();
  const canProceedToStep3 = medications.length > 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <ConfirmationComponent />
        <DialogHeader>
          <DialogTitle>New Prescription</DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
              1
            </div>
            <span className="text-sm font-medium">Patient & Diagnosis</span>
          </div>
          <div className="h-px flex-1 bg-gray-200" />
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
              2
            </div>
            <span className="text-sm font-medium">Medications</span>
          </div>
          <div className="h-px flex-1 bg-gray-200" />
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
              3
            </div>
            <span className="text-sm font-medium">Review & Submit</span>
          </div>
        </div>

        {/* Step 1: Patient & Diagnosis */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>Patient *</Label>
              <Select
                value={selectedPatient?.id}
                onValueChange={(id) => setSelectedPatient(patients.find((p) => p.id === id) || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select patient" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.name} (MRN: {patient.mrn})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPatient && (
              <Alert>
                <AlertDescription>
                  <div className="text-sm">
                    <strong>DOB:</strong> {selectedPatient.dateOfBirth.toLocaleDateString()}<br />
                    <strong>Allergies:</strong> {selectedPatient.allergies || 'None documented'}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div>
              <Label>Diagnosis *</Label>
              <Input
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="e.g., Acute Bacterial Conjunctivitis"
              />
            </div>

            <div>
              <Label>General Instructions</Label>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Additional instructions for the patient..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Treatment Duration (days)</Label>
                <Input
                  type="number"
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  min="1"
                />
              </div>
              <div>
                <Label>Follow-up Date</Label>
                <Input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Medications */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Allergy Warnings */}
            {allergyWarnings.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>ALLERGY WARNING:</strong> Patient is allergic to {allergyWarnings.join(', ')}
                </AlertDescription>
              </Alert>
            )}

            {/* Drug Interactions */}
            {interactions.length > 0 && (
              <Alert variant={interactions.some((i) => i.severity === 'high') ? 'destructive' : 'default'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Drug Interactions Detected:</strong>
                  <ul className="mt-2 space-y-2">
                    {interactions.map((interaction, idx) => (
                      <li key={idx} className="text-sm">
                        <Badge variant={interaction.severity === 'high' ? 'destructive' : 'default'}>
                          {interaction.severity}
                        </Badge>{' '}
                        {interaction.drug1Name} + {interaction.drug2Name}: {interaction.description}
                        <br />
                        <span className="text-xs italic">Management: {interaction.management}</span>
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Added Medications */}
            {medications.length > 0 && (
              <div className="border rounded-lg p-4 space-y-2">
                <h3 className="font-semibold text-sm">Added Medications ({medications.length})</h3>
                {medications.map((med) => (
                  <div key={med.id} className="flex items-start justify-between p-3 bg-gray-50 rounded">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Pill className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">{med.medicationName}</span>
                        {med.genericName && <span className="text-sm text-gray-500">({med.genericName})</span>}
                        {med.isCritical && <Badge variant="destructive" className="text-xs">Critical</Badge>}
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        {med.dosage} {med.form} - {med.frequency} for {med.durationDays} days (Qty: {med.quantity})
                      </div>
                      {med.instructions && <p className="mt-1 text-xs text-gray-500">{med.instructions}</p>}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMedication(med.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Medication */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold">Add Medication</h3>

              <MedicationSearchCombobox
                value={currentMedication.medicationName || ''}
                onChange={(medication) => {
                  setCurrentMedication({
                    ...currentMedication,
                    medicationName: medication.name,
                    genericName: medication.genericName,
                  });
                }}
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Dosage *</Label>
                  <Input
                    value={currentMedication.dosage}
                    onChange={(e) =>
                      setCurrentMedication({ ...currentMedication, dosage: e.target.value })
                    }
                    placeholder="e.g., 0.5%"
                  />
                </div>
                <div>
                  <Label>Form</Label>
                  <Select
                    value={currentMedication.form}
                    onValueChange={(value) =>
                      setCurrentMedication({ ...currentMedication, form: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {formLabels.map((form) => (
                        <SelectItem key={form} value={form}>
                          {form}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Route</Label>
                  <Select
                    value={currentMedication.route}
                    onValueChange={(value) =>
                      setCurrentMedication({ ...currentMedication, route: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {routeLabels.map((route) => (
                        <SelectItem key={route} value={route}>
                          {route}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Frequency</Label>
                  <Select
                    value={currentMedication.frequency}
                    onValueChange={(value) =>
                      setCurrentMedication({ ...currentMedication, frequency: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {frequencyLabels.map((freq) => (
                        <SelectItem key={freq} value={freq}>
                          {freq}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Duration (days)</Label>
                  <Input
                    type="number"
                    value={currentMedication.durationDays}
                    onChange={(e) =>
                      setCurrentMedication({
                        ...currentMedication,
                        durationDays: parseInt(e.target.value) || 0,
                      })
                    }
                    min="1"
                  />
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={currentMedication.quantity}
                    onChange={(e) =>
                      setCurrentMedication({
                        ...currentMedication,
                        quantity: parseInt(e.target.value) || 1,
                      })
                    }
                    min="1"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentMedication.isCritical}
                      onChange={(e) =>
                        setCurrentMedication({
                          ...currentMedication,
                          isCritical: e.target.checked,
                        })
                      }
                      className="h-4 w-4"
                    />
                    <span className="text-sm">Critical</span>
                  </label>
                </div>
              </div>

              <div>
                <Label>Special Instructions</Label>
                <Input
                  value={currentMedication.instructions}
                  onChange={(e) =>
                    setCurrentMedication({ ...currentMedication, instructions: e.target.value })
                  }
                  placeholder="e.g., Take with food, avoid alcohol"
                />
              </div>

              <Button onClick={addMedication} className="w-full gap-2">
                <Plus className="h-4 w-4" />
                Add Medication
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                <strong>Patient:</strong> {selectedPatient?.name}<br />
                <strong>Diagnosis:</strong> {diagnosis}<br />
                <strong>Medications:</strong> {medications.length} medication(s)
                {interactions.length > 0 && (
                  <>
                    <br />
                    <strong className="text-red-600">Interactions:</strong> {interactions.length} detected
                  </>
                )}
              </AlertDescription>
            </Alert>

            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">Prescription Summary</h3>
              <div className="space-y-3">
                {medications.map((med, idx) => (
                  <div key={med.id} className="border-l-2 border-blue-600 pl-3">
                    <div className="font-medium">
                      {idx + 1}. {med.medicationName}
                      {med.isCritical && <Badge variant="destructive" className="ml-2 text-xs">Critical</Badge>}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {med.dosage} {med.form}, {med.route}<br />
                      {med.frequency} for {med.durationDays} days (Qty: {med.quantity})
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <div className="flex gap-2">
              {step > 1 && (
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              )}
              {step < 3 ? (
                <Button
                  onClick={() => setStep(step + 1)}
                  disabled={
                    (step === 1 && !canProceedToStep2) ||
                    (step === 2 && !canProceedToStep3)
                  }
                >
                  Next
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? 'Creating...' : 'Create Prescription'}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
