import re

path = "src/components/examination/VisualAcuityMegaTab.tsx"
text = open(path, encoding="utf-8").read()

# Remove hidden old/new block
text = re.sub(
    r'\s*<div className="hidden grid-cols-1 lg:grid-cols-2 gap-6">.*?</div>\s*(?=</ExamCard>\s*\n\s*\{/\* Section 2)',
    "\n",
    text,
    count=1,
    flags=re.DOTALL,
)

# Replace refraction section body
refraction_new = '''      <ExamCard
        dense
        title="Refraction (Subjective/Objective)"
        icon={<Eye className="w-5 h-5" />}
      >
        <RefractionBilateralTable
          refraction={refraction}
          priorVisit={priorVisit}
          canEdit={canEdit}
          onChange={(eye, field, value) => {
            setRefraction({ ...refraction, [eye]: { ...refraction[eye], [field]: value } });
            markDirty();
          }}
        />
      </ExamCard>'''

text = re.sub(
    r'      <ExamCard\s+title="Refraction \(Subjective/Objective\)".*?</ExamCard>',
    refraction_new,
    text,
    count=1,
    flags=re.DOTALL,
)

open(path, "w", encoding="utf-8").write(text)
print("done")
