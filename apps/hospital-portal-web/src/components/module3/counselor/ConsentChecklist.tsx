'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { SignatureCanvas } from './SignatureCanvas';
import { useConsents, useRenderConsent, useSignConsent } from '@/hooks/use-consents';
import { useConsentTemplates } from '@/hooks/use-consents';
import { FileCheck, FileX, FileClock, Loader2, Eye, Pen, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from '@/lib/toast';
import type { PatientConsent, ConsentTemplate } from '@/types/counselor';

interface ConsentChecklistProps {
  sessionId: string;
  patientId: string;
  packageId?: string;
  onConsentStatusChange?: () => void;
}

export function ConsentChecklist({ sessionId, patientId, packageId, onConsentStatusChange }: ConsentChecklistProps) {
  const [viewingConsent, setViewingConsent] = useState<PatientConsent | null>(null);
  const [signingConsent, setSigningConsent] = useState<PatientConsent | null>(null);

  // Signature states
  const [patientSignature, setPatientSignature] = useState<string | null>(null);
  const [witnessName, setWitnessName] = useState('');
  const [witnessSignature, setWitnessSignature] = useState<string | null>(null);
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelation, setGuardianRelation] = useState('');
  const [guardianSignature, setGuardianSignature] = useState<string | null>(null);

  // Fetch templates and session consents
  const { data: templatesData } = useConsentTemplates();
  const { data: consentsData, isLoading: consentsLoading } = useConsents(sessionId);

  // Mutations
  const renderConsentMutation = useRenderConsent();
  const signConsentMutation = useSignConsent();

  const templates = templatesData || [];
  const consents = consentsData?.consents || [];

  const getConsentStatus = (templateId: string): 'not-rendered' | 'draft' | 'signed' | 'revoked' => {
    const consent = consents.find((c) => c.templateId === templateId);
    if (!consent) return 'not-rendered';
    if (consent.consentStatus === 'Revoked') return 'revoked';
    if (consent.consentStatus === 'FullySigned') return 'signed';
    return 'draft';
  };

  const getConsentForTemplate = (templateId: string): PatientConsent | undefined => {
    return consents.find((c) => c.templateId === templateId);
  };

  const handleRenderConsent = async (template: ConsentTemplate) => {
    try {
      await renderConsentMutation.mutateAsync({
        templateId: template.id,
        sessionId,
        patientId,
        placeholderValues: {},
      });

      toast.success(`${template.templateName} is ready for review and signature.`);

      onConsentStatusChange?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to render consent form.');
    }
  };

  const handleViewConsent = (consent: PatientConsent) => {
    setViewingConsent(consent);
  };

  const handleStartSigning = (consent: PatientConsent) => {
    setSigningConsent(consent);
    // Reset signature states
    setPatientSignature(null);
    setWitnessName('');
    setWitnessSignature(null);
    setGuardianName('');
    setGuardianRelation('');
    setGuardianSignature(null);
  };

  const handleSubmitSignatures = async () => {
    if (!signingConsent) return;

    // Find the template to check requirements
    const template = templates.find((t) => t.id === signingConsent.templateId);
    if (!template) return;

    // Validate required signatures
    if (template.requiresPatientSignature && !patientSignature) {
      toast.error('Please provide patient signature.');
      return;
    }

    if (template.requiresWitnessSignature && (!witnessName || !witnessSignature)) {
      toast.error('Please provide witness name and signature.');
      return;
    }

    if (template.requiresGuardianSignature && (!guardianName || !guardianSignature)) {
      toast.error('Please provide guardian name and signature.');
      return;
    }

    try {
      await signConsentMutation.mutateAsync({
        id: signingConsent.id,
        signatureData: {
          signatureType: 'Patient',
          signatureData: patientSignature || '',
          signerName: 'Patient',
        },
      });

      // If witness signature provided, submit it
      if (witnessSignature && witnessName) {
        await signConsentMutation.mutateAsync({
          id: signingConsent.id,
          signatureData: {
            signatureType: 'Witness',
            signatureData: witnessSignature,
            signerName: witnessName,
          },
        });
      }

      // If guardian signature provided, submit it
      if (guardianSignature && guardianName) {
        await signConsentMutation.mutateAsync({
          id: signingConsent.id,
          signatureData: {
            signatureType: 'Guardian',
            signatureData: guardianSignature,
            signerName: guardianName,
          },
        });
      }

      toast.success('Signatures captured successfully.');

      setSigningConsent(null);
      onConsentStatusChange?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to capture signatures.');
    }
  };

  if (consentsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const allRequiredSigned = templates
    .filter((t) => t.isActive)
    .every((t) => getConsentStatus(t.id) === 'signed');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Consent Forms</h3>
        {allRequiredSigned ? (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="w-4 h-4 mr-1" />
            All Consents Signed
          </Badge>
        ) : (
          <Badge variant="secondary">
            <FileClock className="w-4 h-4 mr-1" />
            Pending Signatures
          </Badge>
        )}
      </div>

      <div className="grid gap-3">
        {templates
          .filter((t) => t.isActive)
          .map((template) => {
            const status = getConsentStatus(template.id);
            const consent = getConsentForTemplate(template.id);

            return (
              <Card key={template.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{template.templateName}</h4>
                      {status === 'signed' && (
                        <Badge variant="default" className="bg-green-500">
                          <FileCheck className="w-3 h-3 mr-1" />
                          Signed
                        </Badge>
                      )}
                      {status === 'draft' && (
                        <Badge variant="secondary">
                          <FileClock className="w-3 h-3 mr-1" />
                          Draft
                        </Badge>
                      )}
                      {status === 'revoked' && (
                        <Badge variant="destructive">
                          <FileX className="w-3 h-3 mr-1" />
                          Revoked
                        </Badge>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                    )}
                    <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                      {template.requiresPatientSignature && <span>• Patient Signature</span>}
                      {template.requiresWitnessSignature && <span>• Witness Signature</span>}
                      {template.requiresGuardianSignature && <span>• Guardian Signature</span>}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {status === 'not-rendered' && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleRenderConsent(template)}
                        disabled={renderConsentMutation.isPending}
                      >
                        {renderConsentMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Eye className="w-4 h-4 mr-1" />
                            Prepare
                          </>
                        )}
                      </Button>
                    )}

                    {status === 'draft' && consent && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => handleViewConsent(consent)}>
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Button size="sm" variant="default" onClick={() => handleStartSigning(consent)}>
                          <Pen className="w-4 h-4 mr-1" />
                          Sign
                        </Button>
                      </>
                    )}

                    {status === 'signed' && consent && (
                      <Button size="sm" variant="outline" onClick={() => handleViewConsent(consent)}>
                        <Eye className="w-4 h-4 mr-1" />
                        View Signed
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
      </div>

      {/* View Consent Dialog */}
      <Dialog open={!!viewingConsent} onOpenChange={() => setViewingConsent(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Consent Form</DialogTitle>
          </DialogHeader>
          {viewingConsent && (
            <div className="space-y-4">
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: viewingConsent.renderedHtml }}
              />
              {viewingConsent.consentStatus === 'FullySigned' && (
                <div className="pt-4 border-t space-y-3">
                  <h4 className="font-semibold">Signatures</h4>
                  {viewingConsent.patientSignedAt && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Patient Signed:</span>{' '}
                      {new Date(viewingConsent.patientSignedAt).toLocaleString()}
                    </div>
                  )}
                  {viewingConsent.witnessSignedAt && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Witness Signed:</span>{' '}
                      {new Date(viewingConsent.witnessSignedAt).toLocaleString()}
                    </div>
                  )}
                  {viewingConsent.guardianSignedAt && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Guardian Signed:</span>{' '}
                      {new Date(viewingConsent.guardianSignedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Sign Consent Dialog */}
      <Dialog open={!!signingConsent} onOpenChange={() => setSigningConsent(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sign Consent Form</DialogTitle>
          </DialogHeader>
          {signingConsent && (
            <div className="space-y-6">
              {/* Consent HTML */}
              <div
                className="prose prose-sm max-w-none p-4 bg-gray-50 rounded-md border"
                dangerouslySetInnerHTML={{ __html: signingConsent.renderedHtml }}
              />

              <Separator />

              {/* Signatures Section */}
              <div className="space-y-6">
                <h4 className="font-semibold">Signatures</h4>

                {/* Patient Signature */}
                {templates.find((t) => t.id === signingConsent.templateId)?.requiresPatientSignature && (
                  <SignatureCanvas
                    label="Patient Signature"
                    required
                    onSignatureChange={setPatientSignature}
                    width={400}
                    height={150}
                  />
                )}

                {/* Witness Signature */}
                {templates.find((t) => t.id === signingConsent.templateId)?.requiresWitnessSignature && (
                  <div className="space-y-3">
                    <Label>Witness Details</Label>
                    <Input
                      placeholder="Witness Name"
                      value={witnessName}
                      onChange={(e) => setWitnessName(e.target.value)}
                      required
                    />
                    <SignatureCanvas
                      label="Witness Signature"
                      required
                      onSignatureChange={setWitnessSignature}
                      width={400}
                      height={150}
                    />
                  </div>
                )}

                {/* Guardian Signature */}
                {templates.find((t) => t.id === signingConsent.templateId)?.requiresGuardianSignature && (
                  <div className="space-y-3">
                    <Label>Guardian Details</Label>
                    <Input
                      placeholder="Guardian Name"
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                      required
                    />
                    <Input
                      placeholder="Relationship (e.g., Parent, Spouse)"
                      value={guardianRelation}
                      onChange={(e) => setGuardianRelation(e.target.value)}
                      required
                    />
                    <SignatureCanvas
                      label="Guardian Signature"
                      required
                      onSignatureChange={setGuardianSignature}
                      width={400}
                      height={150}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSigningConsent(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitSignatures}
                  disabled={signConsentMutation.isPending}
                >
                  {signConsentMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  Submit Signatures
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
