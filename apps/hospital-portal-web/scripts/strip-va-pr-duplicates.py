import re

path = "src/components/examination/VisualAcuityMegaTab.tsx"
text = open(path, encoding="utf-8").read()

# Remove ExamSelect unaided/aided and eye h4 before PR blocks inside distance grid
text = re.sub(
    r'<h4 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">\s*Right Eye \(OD\)\s*</h4>\s*<ExamSelect\s+label="Unaided"[\s\S]*?</ExamSelect>\s*',
    '',
    text,
    count=1,
)
text = re.sub(
    r'<ExamSelect\s+label="Aided \(Corrected\)"[\s\S]*?</ExamSelect>\s*(?=\{/\* Projection of Rays \(PR\) - Unaided OD)',
    '',
    text,
    count=1,
)
text = re.sub(
    r'<h4 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">\s*Left Eye \(OS\)\s*</h4>\s*<ExamSelect\s+label="Unaided"[\s\S]*?</ExamSelect>\s*<ExamSelect\s+label="Aided \(Corrected\)"[\s\S]*?</ExamSelect>\s*',
    '',
    text,
    count=1,
)

open(path, "w", encoding="utf-8").write(text)
print("stripped")
