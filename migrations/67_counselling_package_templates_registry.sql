-- Register counselling_package_templates in master.entity_type_registry (B4 manifest parity).
-- Table + seed data live in 65_counselling_package_templates.sql; this adds the missing registry row.

INSERT INTO master.entity_type_registry (entity_type, group_key, display_name, tab_label, sort_order)
VALUES (
    'counselling_package_templates',
    'counsellor',
    'Counselling Packages',
    'Packages',
    5
)
ON CONFLICT (entity_type) DO NOTHING;
