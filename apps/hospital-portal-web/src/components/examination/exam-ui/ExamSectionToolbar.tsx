'use client';



import { Button } from '@/components/ui/button';

import { confirmMarkAllNormal } from '@/lib/optometry/exam-section-confirm';



interface ExamSectionToolbarProps {

  canEdit?: boolean;

  sectionTitle?: string;

  hasExistingValues?: boolean;

  onMarkNormalOd?: () => void;

  onMarkNormalOs?: () => void;

  onMarkNormalBoth?: () => void;

  onCopyOdToOs?: () => void;

  showCopy?: boolean;

}



function wrapMark(

  sectionTitle: string | undefined,

  hasExistingValues: boolean,

  action?: () => void,

): (() => void) | undefined {

  if (!action) return undefined;

  return () => {

    if (!confirmMarkAllNormal(sectionTitle ?? 'This section', hasExistingValues)) return;

    action();

  };

}



export function ExamSectionToolbar({

  canEdit = true,

  sectionTitle,

  hasExistingValues = false,

  onMarkNormalOd,

  onMarkNormalOs,

  onMarkNormalBoth,

  onCopyOdToOs,

  showCopy = true,

}: ExamSectionToolbarProps) {

  if (!canEdit) return null;

  const markOd = wrapMark(sectionTitle, hasExistingValues, onMarkNormalOd);

  const markOs = wrapMark(sectionTitle, hasExistingValues, onMarkNormalOs);

  const markBoth = wrapMark(sectionTitle, hasExistingValues, onMarkNormalBoth);



  return (

    <div className="flex flex-wrap gap-2 mb-3 pb-2 border-b border-slate-100">

      {markOd && (

        <Button type="button" size="sm" variant="outline" onClick={markOd}>

          Mark all normal — OD

        </Button>

      )}

      {markOs && (

        <Button type="button" size="sm" variant="outline" onClick={markOs}>

          Mark all normal — OS

        </Button>

      )}

      {markBoth && (

        <Button type="button" size="sm" variant="outline" onClick={markBoth}>

          Mark all normal — Both

        </Button>

      )}

      {showCopy && onCopyOdToOs && (

        <Button type="button" size="sm" variant="secondary" onClick={onCopyOdToOs}>

          Copy OD → OS

        </Button>

      )}

    </div>

  );

}

