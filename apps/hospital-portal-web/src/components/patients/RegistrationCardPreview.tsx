'use client';

import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import QRCodeSVG from 'react-qr-code';
import JsBarcode from 'jsbarcode';
import toast from 'react-hot-toast';
import { openRegistrationCardPrint } from '@/lib/patients/registration-card-print';
import { resolvePatientPhotoUrl } from '@/lib/patients/patient-display-utils';

export interface RegistrationCardPatient {
  id?: string;
  medicalRecordNumber?: string | null;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  contactNumber?: string;
  bloodGroup?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  photoUrl?: string;
  address?: string;
}

interface RegistrationCardPreviewProps {
  patient: RegistrationCardPatient;
  /** @deprecated Prefer explicit Print click — auto SPA print removed for isolation. */
  autoPrint?: boolean;
}

export default function RegistrationCardPreview({
  patient,
}: RegistrationCardPreviewProps) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  // Resolve relative API photo paths so card + about:blank print can load the image.
  const resolvedPhotoUrl = resolvePatientPhotoUrl(patient.photoUrl);
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = Boolean(resolvedPhotoUrl) && !photoFailed;

  useEffect(() => {
    setPhotoFailed(false);
  }, [resolvedPhotoUrl]);

  useEffect(() => {
    if (barcodeRef.current && patient.medicalRecordNumber) {
      try {
        JsBarcode(barcodeRef.current, patient.medicalRecordNumber, {
          format: 'CODE128',
          width: 1.5,
          height: 40,
          displayValue: true,
          fontSize: 12,
          margin: 5,
        });
      } catch {
        // Barcode optional when MRN is malformed.
      }
    }
  }, [patient.medicalRecordNumber]);

  const handlePrint = () => {
    const result = openRegistrationCardPrint({
      patient: {
        id: patient.id,
        medicalRecordNumber: patient.medicalRecordNumber,
        firstName: patient.firstName,
        lastName: patient.lastName,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        contactNumber: patient.contactNumber,
        bloodGroup: patient.bloodGroup,
        emergencyContactName: patient.emergencyContactName,
        emergencyContactPhone: patient.emergencyContactPhone,
        // Absolute/browser-loadable URL for dedicated print document.
        photoUrl: showPhoto ? resolvedPhotoUrl : null,
      },
      cardElement: cardRef.current,
    });
    if (!result.opened) {
      toast.error('Unable to open print preview. Allow pop-ups for this site and try again.');
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="registration-card-container" data-testid="registration-card-preview">
      <div className="no-print mb-3 flex justify-end">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={handlePrint}
          data-testid="registration-card-print-action"
        >
          Print Registration Card
        </Button>
      </div>

      <div
        ref={cardRef}
        className="registration-card print-card mx-auto rounded-lg border-2 border-gray-300 bg-white p-4 shadow-lg"
        data-testid="registration-card-print-target"
      >
        <div className="grid h-full grid-cols-3 gap-3">
          <div className="flex flex-col items-center justify-between">
            {showPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolvedPhotoUrl!}
                alt={`${patient.firstName} ${patient.lastName}`}
                className="h-20 w-20 rounded-lg border-2 border-gray-300 object-cover"
                data-testid="registration-card-patient-photo"
                onError={() => setPhotoFailed(true)}
              />
            ) : (
              <div
                className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-gray-300 bg-gray-200"
                data-testid="registration-card-photo-fallback"
              >
                <span className="text-3xl text-gray-400" aria-hidden>
                  👤
                </span>
              </div>
            )}

            <div className="bg-white p-1">
              <QRCodeSVG
                value={patient.medicalRecordNumber || patient.id || 'UNKNOWN'}
                size={60}
              />
            </div>
          </div>

          <div className="col-span-2 flex flex-col justify-between">
            <div className="mb-1 border-b border-gray-300 pb-1">
              <h3 className="text-xs font-bold text-blue-900">HOSPITAL PORTAL</h3>
              <p className="text-[0.5rem] text-gray-600">Patient Registration Card</p>
            </div>

            <div className="flex-1 space-y-0.5">
              <div>
                <p className="text-xs font-bold leading-tight text-gray-900">
                  {patient.firstName} {patient.lastName}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-x-2 text-[0.55rem]">
                <div>
                  <span className="text-gray-600">MRN:</span>
                  <span className="ml-1 font-semibold">
                    {patient.medicalRecordNumber || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Blood:</span>
                  <span className="ml-1 font-semibold text-red-600">
                    {patient.bloodGroup || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">DOB:</span>
                  <span className="ml-1 font-medium">{formatDate(patient.dateOfBirth)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Gender:</span>
                  <span className="ml-1 font-medium">{patient.gender}</span>
                </div>
              </div>

              <div className="text-[0.55rem]">
                <span className="text-gray-600">Contact:</span>
                <span className="ml-1 font-medium">{patient.contactNumber || 'N/A'}</span>
              </div>

              {patient.emergencyContactName ? (
                <div className="mt-1 rounded bg-red-50 p-0.5 text-[0.5rem]">
                  <span className="font-semibold text-red-700">Emergency:</span>
                  <span className="ml-1 text-gray-800">{patient.emergencyContactName}</span>
                  {patient.emergencyContactPhone ? (
                    <span className="ml-1 text-gray-700">
                      ({patient.emergencyContactPhone})
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="mt-1 flex justify-center">
              <svg ref={barcodeRef} className="barcode-svg" />
            </div>
          </div>
        </div>

        <div className="mt-2 border-t border-gray-200 pt-1 text-center text-[0.45rem] text-gray-500">
          Keep this card safe. Present at every visit.
        </div>
      </div>

      <style jsx>{`
        .registration-card {
          width: 3.5in;
          height: 2in;
          box-sizing: border-box;
        }
        .barcode-svg {
          max-width: 100%;
          height: auto;
        }
      `}</style>
    </div>
  );
}
