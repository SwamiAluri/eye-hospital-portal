import re

path = "src/components/examination/VisualAcuityMegaTab.tsx"
text = open(path, encoding="utf-8").read()

va_table = """
        <VaBilateralTable
          distanceVision={distanceVision}
          nearVision={nearVision}
          priorVisit={priorVisit}
          canEdit={canEdit}
          onDistanceChange={(eye, field, value) => {
            setDistanceVision({ ...distanceVision, [eye]: { ...distanceVision[eye], [field]: value } });
            markDirty();
          }}
          onNearChange={(eye, field, value) => {
            setNearVision({ ...nearVision, [eye]: { ...nearVision[eye], [field]: value } });
            markDirty();
          }}
        />
        <p className="text-xs font-semibold text-gray-700 mt-4 mb-2">Projection of Rays (when VA is HM or PL)</p>
"""

# Distance card: insert table and strip ExamSelect unaided/aided blocks before PR
text = re.sub(
    r'(title="Distance Vision"[^>]*>\s*)<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">\s*<div className="space-y-4">\s*<h4[^>]*>Right Eye \(OD\)</h4>\s*)<ExamSelect\s+label="Unaided"[\s\S]*?</ExamSelect>\s*',
    r'\1' + va_table + r'<div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><div className="space-y-4">',
    text,
    count=1,
)

# Remove aided selects before PR (OD unaided PR already past)
text = re.sub(
    r'<ExamSelect\s+label="Aided \(Corrected\)"[\s\S]*?</ExamSelect>\s*(?=\{/\* Projection of Rays \(PR\) - Unaided OD \*/\})',
    '',
    text,
    count=1,
)

# Remove OS column unaided/aided before OS PR - find OS h4 and selects until OS PR
text = re.sub(
    r'<div className="space-y-4">\s*<h4[^>]*>Left Eye \(OS\)</h4>\s*<ExamSelect\s+label="Unaided"[\s\S]*?</ExamSelect>\s*<ExamSelect\s+label="Aided \(Corrected\)"[\s\S]*?</ExamSelect>\s*(?=\{/\* Projection of Rays \(PR\) - Unaided OS|\s*</div>\s*</div>\s*</ExamCard>)',
    '<div className="space-y-4">',
    text,
    count=1,
)

# Remove Section 4 Near Vision
text = re.sub(
    r'\s*\{/\* Section 4: Near Vision \*/\}.*?</ExamCard>\s*(?=\{/\* Section 5)',
    '\n',
    text,
    count=1,
    flags=re.DOTALL,
)

# Keratometry
kera_new = '''      <ExamCard
        dense
        title="Keratometry"
        icon={<Eye className="w-5 h-5" />}
        infoTooltip="Measures corneal curvature for contact lens fitting and astigmatism assessment. Normal: 42-44D."
      >
        <KeratometryBilateralTable
          keratometry={keratometry}
          priorVisit={priorVisit}
          canEdit={canEdit}
          calculateAverageK={calculateAverageK}
          calculateAstigmatism={calculateAstigmatism}
          onChange={(eye, field, value) => {
            setKeratometry({ ...keratometry, [eye]: { ...keratometry[eye], [field]: value } });
            markDirty();
          }}
        />
      </ExamCard>'''

text = re.sub(
    r'      <ExamCard\s+title="Keratometry".*?</ExamCard>\s*(?=\{/\* Section 6)',
    kera_new + '\n',
    text,
    count=1,
    flags=re.DOTALL,
)

# Fix missing closing ExamCard for section 1
text = text.replace('        />\n</ExamCard>', '        />\n      </ExamCard>', 1)

text = text.replace('title="Distance Vision"', 'dense\n        title="Distance & Near Vision"', 1)

open(path, "w", encoding="utf-8").write(text)
print("done2")
