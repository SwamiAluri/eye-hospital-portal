path = "src/components/examination/VisualAcuityMegaTab.tsx"
lines = open(path, encoding="utf-8").readlines()
out = []
skip = False
for line in lines:
    if "__REMOVE_KERA_LEGACY__" in line:
        skip = True
        continue
    if skip and "{/* Section 6: Color Vision" in line and "legacy" not in line:
        skip = False
    if skip and "legacy removed" in line:
        continue
    if not skip:
        out.append(line)
open(path, "w", encoding="utf-8").writelines(out)
print("removed legacy", len(lines) - len(out))
