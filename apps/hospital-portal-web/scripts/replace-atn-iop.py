import re

path = "src/components/examination/IOPMegaTab.tsx"
text = open(path, encoding="utf-8").read()

atn_new = '''      <ExamCard
        dense
        title="Applanation Tonometry (ATN)"
        icon={<Gauge className="w-5 h-5" />}
        infoTooltip="Gold standard for IOP measurement. More accurate than NCT, requires anesthetic drops and fluorescein dye."
      >
        <IopMeasurementGrid
          title="Before Dilatation"
          od={atn.beforeDilatation.OD}
          os={atn.beforeDilatation.OS}
          canEdit={canEdit}
          getIOPStatus={getIOPStatus}
          onChange={(eye, field, value) => {
            setAtn({
              ...atn,
              beforeDilatation: {
                ...atn.beforeDilatation,
                [eye]: { ...atn.beforeDilatation[eye], [field]: value },
              },
            });
            markDirty();
          }}
        />
        <IopMeasurementGrid
          title="After Dilatation"
          od={atn.afterDilatation.OD}
          os={atn.afterDilatation.OS}
          canEdit={canEdit}
          getIOPStatus={getIOPStatus}
          onChange={(eye, field, value) => {
            setAtn({
              ...atn,
              afterDilatation: {
                ...atn.afterDilatation,
                [eye]: { ...atn.afterDilatation[eye], [field]: value },
              },
            });
            markDirty();
          }}
        />
      </ExamCard>'''

text = re.sub(
    r'      \{/\* Section 2: Applanation Tonometry \(ATN\) \*/\}.*?</ExamCard>\s*(?=\{/\* Section 3)',
    atn_new + '\n',
    text,
    count=1,
    flags=re.DOTALL,
)

open(path, "w", encoding="utf-8").write(text)
print("atn done")
