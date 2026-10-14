# Slice 3A — Canonical Document Identity Foundation

**Goal:** One hospital-wide resolver: tenant + patient + SHA-256 → one CanonicalDocument, 0..N associations, no duplicate blobs.

**Out of scope:** Full CCMS adapter, Lab/Imaging/IP, Insurance upload from 360.

## Tasks
1. Failing identity tests + migration + resolver
2. Wire General upload/delete
3. Wire Counselling upload + delete semantics
4. Patient 360 All dedupe (FE)
5. Run suite; report; STOP for Manual UAT
