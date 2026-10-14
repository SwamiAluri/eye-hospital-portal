import { test, expect } from "@playwright/test";
import { apiLogin, seedBrowserAuth } from "./helpers/auth";
import {
  ensureHubPatients,
  expectHubTable,
  expectPreviewVisible,
  gotoPatientHub,
  openFirstHubRow,
  openFirstPatientRecord,
  seedHubPreviewMode,
} from "./helpers/patient-hub";
import { patientLookupTestIds } from "../src/lib/patients/patient-lookup-test-ids";

test.describe("Patient Hub @patient-hub", () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page, request }) => {
    const login = await apiLogin(request);
    await ensureHubPatients(request, login, 1);
    await seedBrowserAuth(page, login);
  });

  test("hub loads with search and classification tabs", async ({ page }) => {
    await page.goto("/dashboard/patients", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId(patientLookupTestIds.page)).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page.getByTestId(patientLookupTestIds.searchInput),
    ).toBeVisible();
    await expect(
      page.getByTestId(patientLookupTestIds.tab("all")),
    ).toBeVisible();
    await expect(
      page.getByTestId(patientLookupTestIds.tab("current")),
    ).toBeVisible();
    await expect(
      page.getByTestId(patientLookupTestIds.branchSwitcher),
    ).toBeVisible();
  });

  test("filter sheet opens and export button is visible", async ({ page }) => {
    await page.goto("/dashboard/patients", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(patientLookupTestIds.page)).toBeVisible({
      timeout: 60_000,
    });

    await page.getByRole("button", { name: /^Filters/i }).click();
    await expect(
      page.getByTestId(patientLookupTestIds.filterSheet),
    ).toBeVisible();
    await expect(
      page.getByTestId(patientLookupTestIds.exportCsv),
    ).toBeVisible();
  });

  test("row click opens preview with profile link", async ({ page }) => {
    await gotoPatientHub(page);
    await expectHubTable(page);

    await openFirstHubRow(page);
    await expectPreviewVisible(page);
    await expect(
      page.getByTestId(patientLookupTestIds.previewOpenProfile),
    ).toBeVisible();
    await expect(
      page.getByTestId(patientLookupTestIds.previewCheckIn),
    ).toBeVisible();
  });

  test("search filters the worklist without a suggestion list", async ({ page }) => {
    await page.goto("/dashboard/patients", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(patientLookupTestIds.page)).toBeVisible({
      timeout: 60_000,
    });

    const search = page.getByTestId(patientLookupTestIds.searchInput);
    await search.fill("E2E");
    await expect(page.getByTestId(patientLookupTestIds.autosuggestList)).toHaveCount(0);
    await expect(page).toHaveURL(/q=E2E/, { timeout: 15_000 });
    await expect(search).toBeVisible();
  });

  test("filter sheet apply updates URL with gender filter", async ({ page }) => {
    await page.goto("/dashboard/patients", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(patientLookupTestIds.page)).toBeVisible({
      timeout: 60_000,
    });

    await page.getByRole("button", { name: /^Filters/i }).click();
    await expect(
      page.getByTestId(patientLookupTestIds.filterSheet),
    ).toBeVisible();

    await page.getByLabel(/^Gender/i).selectOption("Female");
    await page.getByTestId(patientLookupTestIds.filterApply).click();

    await expect(page).toHaveURL(/gender=female/i);
  });

  test("directory hides favorite, assigned, and merge chrome", async ({ page }) => {
    await page.goto("/dashboard/patients", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(patientLookupTestIds.table)).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByTestId(patientLookupTestIds.favoritesToggle)).toHaveCount(0);
    await expect(page.getByTestId(patientLookupTestIds.assignedToMeToggle)).toHaveCount(0);
    await expect(page.getByTestId(patientLookupTestIds.mergeLink)).toHaveCount(0);
    await expect(page.locator('[data-testid^="patient-hub-favorite-"]')).toHaveCount(0);
    await expect(page.getByTestId(patientLookupTestIds.worklistFooter)).toBeVisible();
    await expect(page.getByTestId(patientLookupTestIds.worklistScroll)).toBeVisible();
  });

  test("export CSV visible for admin with patient.export", async ({ page }) => {
    await page.goto("/dashboard/patients", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(patientLookupTestIds.page)).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page.getByTestId(patientLookupTestIds.exportCsv),
    ).toBeVisible();
  });
});

test.describe("Patient Hub interactions @patient-hub", () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page, request }) => {
    const login = await apiLogin(request);
    await ensureHubPatients(request, login, 3);
    await seedBrowserAuth(page, login);
  });

  test("sort by name updates URL and acuity is not a worklist column", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await gotoPatientHub(page);
    await expectHubTable(page);

    await expect(page.getByTestId(patientLookupTestIds.sortHeader("acuity"))).toHaveCount(0);
    await page.getByTestId(patientLookupTestIds.sortHeader("name")).click();
    await expect(page).toHaveURL(/sortBy=name/);
    await expect(page.getByRole("columnheader", { name: "Engagement" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Visit" })).toBeVisible();
    await expect(page.locator('[data-testid^="patient-hub-acuity-"]')).toHaveCount(0);
  });

  test("schedule and queue are not separate sort columns", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await gotoPatientHub(page);
    await expectHubTable(page);

    await expect(page.getByTestId(patientLookupTestIds.sortHeader("scheduledAt"))).toHaveCount(0);
    await expect(page.getByTestId(patientLookupTestIds.sortHeader("waitingMinutes"))).toHaveCount(0);
  });

  test("selection checkboxes and selection bar are absent", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await gotoPatientHub(page);
    await expectHubTable(page);

    await expect(page.getByTestId(patientLookupTestIds.selectAllCheckbox)).toHaveCount(0);
    await expect(page.getByTestId(patientLookupTestIds.selectionBar)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Patients" })).toHaveCount(0);
  });

  test("pagination navigates to page 2 when enough patients", async ({
    page,
    request,
  }) => {
    const login = await apiLogin(request);
    await ensureHubPatients(request, login, 30);
    await seedBrowserAuth(page, login);

    await page.setViewportSize({ width: 1400, height: 900 });
    await gotoPatientHub(page);
    await expectHubTable(page);

    const page2 = page.getByTestId(patientLookupTestIds.paginationPage(2));
    await expect(page2).toBeVisible({ timeout: 30_000 });
    await page2.click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId(patientLookupTestIds.paginationPage(2))).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

test.describe("Patient Hub preview dock @patient-hub", () => {
  test.describe.configure({ timeout: 90_000 });

  test.use({ viewport: { width: 1400, height: 900 } });

  test.beforeEach(async ({ page, request }) => {
    const login = await apiLogin(request);
    await ensureHubPatients(request, login, 2);
    await seedHubPreviewMode(page, "docked");
    await seedBrowserAuth(page, login);
  });

  test("docked split pane toggles to floating drawer", async ({ page }) => {
    await gotoPatientHub(page);
    await expectHubTable(page);
    await openFirstHubRow(page);

    await expect(
      page.getByTestId(patientLookupTestIds.previewSplitPane),
    ).toBeVisible();
    await expect(
      page.getByTestId(patientLookupTestIds.previewDockToggle),
    ).toBeVisible();

    await page.getByTestId(patientLookupTestIds.previewDockToggle).click();
    await expect(
      page.getByTestId(patientLookupTestIds.previewDrawer),
    ).toBeVisible();
    await expect(
      page.getByTestId(patientLookupTestIds.previewSplitPane),
    ).toBeHidden();

    await page.getByTestId(patientLookupTestIds.previewDockToggle).click();
    await expect(
      page.getByTestId(patientLookupTestIds.previewSplitPane),
    ).toBeVisible();
  });
});

test.describe("Patient Hub mobile @patient-hub @mobile-hub", () => {
  test.describe.configure({ timeout: 90_000 });

  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page, request }) => {
    const login = await apiLogin(request);
    await ensureHubPatients(request, login, 2);
    await seedBrowserAuth(page, login);
  });

  test("mobile cards open bottom-sheet preview", async ({ page }) => {
    await gotoPatientHub(page);
    await expect(
      page.getByTestId(patientLookupTestIds.mobileCards),
    ).toBeVisible({ timeout: 60_000 });

    const firstCard = page.locator('[data-testid^="patient-hub-mobile-card-"]').first();
    await firstCard.click();

    await expect(
      page.getByTestId(patientLookupTestIds.previewDrawer),
    ).toBeVisible();
    await expect(
      page.getByTestId(patientLookupTestIds.previewOpenProfile),
    ).toBeVisible();
  });
});

test.describe("Patient Record @patient-hub @patient-record", () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page, request }) => {
    const login = await apiLogin(request);
    await ensureHubPatients(request, login, 2);
    await seedBrowserAuth(page, login);
  });

  test("profile opens record shell with tabs and export", async ({ page }) => {
    await page.goto("/dashboard/patients", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(patientLookupTestIds.table)).toBeVisible({
      timeout: 60_000,
    });

    const firstRow = page.locator('[data-testid^="patient-hub-row-"]').first();
    await firstRow.click();
    await page.getByTestId(patientLookupTestIds.previewOpenProfile).click();

    await expect(page.getByTestId(patientLookupTestIds.recordShell)).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page.getByTestId(patientLookupTestIds.recordSection("overview")),
    ).toBeVisible();
    await expect(
      page.getByTestId(patientLookupTestIds.recordSection("timeline")),
    ).toBeVisible();
    await expect(
      page.getByTestId(patientLookupTestIds.recordSectionNav),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "Clinical" })).toBeVisible();
    await expect(page.getByText("Coming Soon")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "More" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Open Counselling" })).toHaveCount(0);
    await expect(
      page.getByTestId(patientLookupTestIds.recordExportPdf),
    ).toBeVisible();
    await expect(
      page.getByTestId(patientLookupTestIds.recordPrint),
    ).toBeVisible();
  });

  test("record section navigation without patient switching chrome", async ({ page }) => {
    await page.goto("/dashboard/patients", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(patientLookupTestIds.table)).toBeVisible({
      timeout: 60_000,
    });

    const firstRow = page.locator('[data-testid^="patient-hub-row-"]').first();
    await firstRow.click();
    await page.getByTestId(patientLookupTestIds.previewOpenProfile).click();
    await expect(page.getByTestId(patientLookupTestIds.recordShell)).toBeVisible({
      timeout: 60_000,
    });

    await page.getByTestId(patientLookupTestIds.recordSection("clinical")).click();
    await expect(page).toHaveURL(/section=clinical/);
    await expect(page.getByTestId(patientLookupTestIds.recordSectionPanel("clinical"))).toContainText(
      "not available in Patient 360",
    );

    await expect(page.getByTestId(patientLookupTestIds.recordNav)).toHaveCount(0);
    await expect(page.getByTestId(patientLookupTestIds.switcherRail)).toHaveCount(0);
    await expect(page.getByTestId(patientLookupTestIds.workspaceTabs)).toHaveCount(0);
  });

  test("record tab groups switch clinical to billing", async ({ page }) => {
    await openFirstPatientRecord(page);

    await page.getByTestId(patientLookupTestIds.recordSection("coverage")).click();
    await expect(
      page.getByTestId(patientLookupTestIds.recordSectionPanel("coverage")),
    ).toContainText("not available in Patient 360");
    await expect(page).toHaveURL(/section=coverage/);

    await page.getByTestId(patientLookupTestIds.recordSection("overview")).click();
    await expect(
      page.getByTestId(patientLookupTestIds.recordSectionPanel("overview")),
    ).toBeVisible();
  });

  test("legacy insurance tab maps to coverage without record tools", async ({ page }) => {
    await openFirstPatientRecord(page);
    const url = page.url();
    const patientId = url.match(/\/dashboard\/patients\/([^/?#]+)/)?.[1];
    expect(patientId).toBeTruthy();
    await page.goto(`/dashboard/patients/${patientId}?tab=insurance`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByTestId(patientLookupTestIds.recordSectionPanel("coverage"))).toBeVisible({
      timeout: 60_000,
    });
    await expect(page).toHaveURL(/section=coverage/);
    await expect(page.getByRole("button", { name: "Existing record tools" })).toHaveCount(0);
  });

  test("Patient 360 stays a fixed patient without workspace switching tabs", async ({ page }) => {
    await page.goto("/dashboard/patients", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(patientLookupTestIds.table)).toBeVisible({
      timeout: 60_000,
    });

    const rows = page.locator('[data-testid^="patient-hub-row-"]');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(2);

    await rows.nth(0).click();
    await page.getByTestId(patientLookupTestIds.previewOpenProfile).click();
    await expect(page.getByTestId(patientLookupTestIds.recordShell)).toBeVisible({
      timeout: 60_000,
    });

    await page.goto("/dashboard/patients", { waitUntil: "domcontentloaded" });
    await rows.nth(1).click();
    await page.getByTestId(patientLookupTestIds.previewOpenProfile).click();
    await expect(page.getByTestId(patientLookupTestIds.recordShell)).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByTestId(patientLookupTestIds.workspaceTabs)).toHaveCount(0);
    await expect(page.getByTestId(patientLookupTestIds.switcherRail)).toHaveCount(0);
    await expect(page.getByTestId(patientLookupTestIds.recordNav)).toHaveCount(0);
  });
});

test.describe("Patient Encounter @patient-hub @patient-encounter", () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page, request }) => {
    const login = await apiLogin(request);
    await ensureHubPatients(request, login, 1);
    await seedBrowserAuth(page, login);
  });

  test("encounter route loads HPI and vitals sections", async ({ page }) => {
    await page.goto("/dashboard/patients", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(patientLookupTestIds.table)).toBeVisible({
      timeout: 60_000,
    });

    const firstRow = page.locator('[data-testid^="patient-hub-row-"]').first();
    const rowTestId = await firstRow.getAttribute("data-testid");
    const patientId = rowTestId?.replace("patient-hub-row-", "") ?? "";
    expect(patientId).toBeTruthy();

    const placeholderVisitId = "00000000-0000-4000-8000-000000000001";
    await page.goto(
      `/dashboard/patients/${patientId}/encounter/${placeholderVisitId}`,
      { waitUntil: "domcontentloaded" },
    );

    const { patientEncounterTestIds } = await import(
      "../src/lib/patients/patient-encounter-test-ids"
    );

    await expect(page.getByTestId(patientEncounterTestIds.page)).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByTestId(patientEncounterTestIds.hpiSection)).toBeVisible();
    await expect(page.getByTestId(patientEncounterTestIds.vitalsSection)).toBeVisible();

    await page.getByTestId(patientEncounterTestIds.hpiFreeText).fill(
      "Progressive blurring OD for 2 weeks",
    );
    await page.getByTestId(patientEncounterTestIds.vitalsHeartRate).fill("72");
    await page.getByTestId(patientEncounterTestIds.vitalsIopOd).fill("16");

    await page.getByTestId(patientEncounterTestIds.saveButton).click();
    await expect(page.getByText(/saved|Saving/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe("Patient Hub omnisearch @patient-hub @patient-omnisearch", () => {
  test.beforeEach(async ({ page, request }) => {
    const login = await apiLogin(request);
    await seedBrowserAuth(page, login);
  });

  test("Ctrl+K opens global patient search", async ({ page }) => {
    await page.goto("/dashboard/patients", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(patientLookupTestIds.page)).toBeVisible({
      timeout: 60_000,
    });

    await page.keyboard.press("Control+K");
    await expect(page.getByTestId(patientLookupTestIds.omnisearchInput)).toBeVisible();
    await expect(page.getByTestId(patientLookupTestIds.omnisearchList)).toBeVisible();
    await expect(page.getByTestId(patientLookupTestIds.omnisearchTabs)).toBeVisible();
  });

  test("omnisearch care programs tab lists programs", async ({ page }) => {
    await page.goto("/dashboard/patients", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(patientLookupTestIds.page)).toBeVisible({
      timeout: 60_000,
    });

    await page.keyboard.press("Control+K");
    await page.getByTestId(patientLookupTestIds.omnisearchTab("care_programs")).click();
    await expect(
      page.getByTestId(patientLookupTestIds.omnisearchTab("care_programs")),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId(patientLookupTestIds.omnisearchResult("CATARACT"))).toBeVisible({
      timeout: 15_000,
    });
  });

  test("omnisearch patients tab navigates to profile", async ({ page, request }) => {
    const login = await apiLogin(request);
    await ensureHubPatients(request, login, 1);
    await seedBrowserAuth(page, login);

    await gotoPatientHub(page);

    await page.keyboard.press("Control+K");
    await page.getByTestId(patientLookupTestIds.omnisearchTab("patients")).click();
    await page.getByTestId(patientLookupTestIds.omnisearchInput).fill("E2E");
    const firstHit = page
      .locator('[data-testid^="patient-hub-omnisearch-result-"]')
      .first();
    await expect(firstHit).toBeVisible({ timeout: 15_000 });
    await firstHit.click();

    await expect(page.getByTestId(patientLookupTestIds.recordShell)).toBeVisible({
      timeout: 60_000,
    });
  });
});
