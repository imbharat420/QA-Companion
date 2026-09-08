//! Serde mirrors of `src/lib/api/types.ts`.
//!
//! Every struct renames to camelCase and every optional field is skipped when
//! absent, so the JSON that crosses the IPC bridge is indistinguishable from
//! what the mock adapter produces. Enum variants whose TS values are kebab-case
//! carry an explicit rename.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

/* ==========================================================================
   PRIMITIVES
   ======================================================================== */

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Critical,
    High,
    Medium,
    Low,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Tone {
    Cyan,
    Amber,
    Red,
    Green,
    Violet,
    Neutral,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TestStatus {
    Passed,
    Failed,
    Flaky,
    Skipped,
    Running,
    Pending,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SuiteStatus {
    Passing,
    Failing,
    Flaky,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SortDir {
    Asc,
    Desc,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Paged<T> {
    pub items: Vec<T>,
    pub total: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    pub search: Option<String>,
    pub limit: Option<usize>,
    pub cursor: Option<String>,
    pub sort_by: Option<String>,
    pub sort_dir: Option<SortDir>,
}

/* ==========================================================================
   WORKSPACE / PROJECT
   ======================================================================== */

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceOwner {
    pub name: String,
    pub avatar: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub path: String,
    pub framework: String,
    pub branch: String,
    pub sessions: u32,
    pub tests: u32,
    pub last_active: String,
    pub health: u32,
    pub description: String,
    pub dev_command: String,
    pub test_command: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub git_url: Option<String>,
    pub category: String,
    pub thumbnail: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub starred: Option<bool>,
    pub owner: WorkspaceOwner,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub folder: Option<String>,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WorkspaceState {
    Ready,
    Indexing,
    Uploading,
    Error,
    Offline,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceFolder {
    pub id: String,
    pub name: String,
    pub count: u32,
    pub color_token: String,
}

/* ==========================================================================
   SUITES / CASES
   ======================================================================== */

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Suite {
    pub id: String,
    pub name: String,
    pub file: String,
    pub cases: u32,
    pub pass_rate: u32,
    pub last_run: String,
    pub status: SuiteStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StepAction {
    Navigate,
    Click,
    Type,
    Select,
    Hover,
    Assert,
    Wait,
    Screenshot,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestStep {
    pub id: String,
    pub index: u32,
    pub action: StepAction,
    pub target: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    pub code: String,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AssertionKind {
    Visible,
    Text,
    Url,
    Count,
    Attribute,
    Response,
    A11y,
    Visual,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Assertion {
    pub id: String,
    pub kind: AssertionKind,
    pub target: String,
    pub expected: String,
    pub soft: bool,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GeneratedBy {
    Agent,
    Recording,
    Human,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestCase {
    pub id: String,
    pub title: String,
    pub suite_id: String,
    pub file: String,
    pub primary_locator: String,
    pub status: TestStatus,
    pub duration_ms: u32,
    pub last_run: String,
    pub owner: String,
    pub tags: Vec<String>,
    pub flake_rate: f64,
    pub steps: Vec<TestStep>,
    pub assertions: Vec<Assertion>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub generated_by: Option<GeneratedBy>,
}

/* ==========================================================================
   RUNS
   ======================================================================== */

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunGroup {
    pub title: String,
    pub count: u32,
    pub desc: String,
    pub tone: Tone,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunSpecTest {
    pub name: String,
    pub status: TestStatus,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunSpec {
    pub file: String,
    pub tests: Vec<RunSpecTest>,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RunTrigger {
    Manual,
    Ci,
    Schedule,
    Agent,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestRun {
    pub id: String,
    pub name: String,
    pub branch: String,
    pub when: String,
    pub duration: String,
    pub passed: u32,
    pub failed: u32,
    pub flaky: u32,
    pub skipped: u32,
    pub groups: Vec<RunGroup>,
    pub specs: Vec<RunSpec>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trigger: Option<RunTrigger>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub engine: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub commit_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<TestStatus>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrendPoint {
    pub run: String,
    pub pass: u32,
    pub fail: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlakyTest {
    pub id: String,
    pub title: String,
    pub file: String,
    pub flake_rate: f64,
    pub runs_affected: u32,
    pub last_failure: String,
    pub suspected_cause: String,
}

/* ==========================================================================
   FINDINGS
   ======================================================================== */

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum FindingStatus {
    New,
    Confirmed,
    Fixed,
    FalsePositive,
    WontFix,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EvidenceKind {
    Screenshot,
    Dom,
    Console,
    Network,
    Trace,
    Video,
    Har,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Evidence {
    pub id: String,
    pub kind: EvidenceKind,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub src: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub captured_at: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Finding {
    pub id: String,
    pub title: String,
    pub category: String,
    pub severity: Severity,
    pub confidence: u32,
    pub status: FindingStatus,
    pub url: String,
    pub element: String,
    pub expected: String,
    pub actual: String,
    pub rca: String,
    pub fix: String,
    pub commit: String,
    pub related_tests: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub run_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suite_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub case_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detected_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub facts: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inferences: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub evidence: Option<Vec<Evidence>>,
}

/* ==========================================================================
   COUNT MAPS — the TS side types these as Record<Union, number>, which is a
   fixed-key object, so a struct is the faithful mirror.
   ======================================================================== */

#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeverityCounts {
    pub critical: u32,
    pub high: u32,
    pub medium: u32,
    pub low: u32,
}

impl SeverityCounts {
    pub fn add(&mut self, severity: Severity) {
        match severity {
            Severity::Critical => self.critical += 1,
            Severity::High => self.high += 1,
            Severity::Medium => self.medium += 1,
            Severity::Low => self.low += 1,
        }
    }
}

#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize)]
pub struct WcagCounts {
    #[serde(rename = "A")]
    pub a: u32,
    #[serde(rename = "AA")]
    pub aa: u32,
    #[serde(rename = "AAA")]
    pub aaa: u32,
}

impl WcagCounts {
    pub fn add(&mut self, level: WcagLevel) {
        match level {
            WcagLevel::A => self.a += 1,
            WcagLevel::Aa => self.aa += 1,
            WcagLevel::Aaa => self.aaa += 1,
        }
    }
}

/* ==========================================================================
   ACCESSIBILITY
   ======================================================================== */

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum WcagLevel {
    #[serde(rename = "A")]
    A,
    #[serde(rename = "AA")]
    Aa,
    #[serde(rename = "AAA")]
    Aaa,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct A11yIssue {
    pub id: String,
    pub rule_id: String,
    pub title: String,
    pub description: String,
    pub impact: Severity,
    pub wcag_level: WcagLevel,
    pub criteria: Vec<String>,
    pub url: String,
    pub selector: String,
    pub html: String,
    pub remediation: String,
    pub node_count: u32,
    pub status: FindingStatus,
    pub category: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScorePoint {
    pub run: String,
    pub score: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct A11ySummary {
    pub score: u32,
    pub violations: u32,
    pub passes: u32,
    pub incomplete: u32,
    pub by_level: WcagCounts,
    pub by_impact: SeverityCounts,
    pub trend: Vec<ScorePoint>,
}

/* ==========================================================================
   SECURITY
   ======================================================================== */

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecurityIssue {
    pub id: String,
    pub title: String,
    pub category: String,
    pub severity: Severity,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cvss: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwe: Option<String>,
    pub url: String,
    pub evidence: String,
    pub remediation: String,
    pub status: FindingStatus,
    pub detected_at: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecurityHeaderCheck {
    pub header: String,
    pub present: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    pub expected: String,
    pub severity: Severity,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryCount {
    pub category: String,
    pub count: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecuritySummary {
    pub score: u32,
    pub by_category: Vec<CategoryCount>,
    pub by_severity: SeverityCounts,
    pub headers: Vec<SecurityHeaderCheck>,
    pub scanned_urls: u32,
    pub last_scan: String,
}

/* ==========================================================================
   PERFORMANCE
   ======================================================================== */

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PerfMetricId {
    Lcp,
    Cls,
    Inp,
    Fcp,
    Ttfb,
    Tbt,
    Si,
    Tti,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MetricUnit {
    Ms,
    S,
    Score,
    Kb,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PerfRating {
    Good,
    NeedsImprovement,
    Poor,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetricPoint {
    pub run: String,
    pub value: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerfMetric {
    pub id: PerfMetricId,
    pub label: String,
    pub value: f64,
    pub unit: MetricUnit,
    pub budget: f64,
    pub rating: PerfRating,
    pub delta: f64,
    pub history: Vec<MetricPoint>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ResourceType {
    Document,
    Script,
    Stylesheet,
    Image,
    Font,
    Xhr,
    Media,
    Other,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceEntry {
    pub id: String,
    pub url: String,
    #[serde(rename = "type")]
    pub kind: ResourceType,
    pub size_bytes: u64,
    pub transfer_bytes: u64,
    pub duration_ms: u32,
    pub start_ms: u32,
    pub blocking: bool,
    pub cached: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Device {
    Desktop,
    Mobile,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerfOpportunity {
    pub title: String,
    pub savings_ms: u32,
    pub detail: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerfSummary {
    pub score: u32,
    pub url: String,
    pub device: Device,
    pub metrics: Vec<PerfMetric>,
    pub resources: Vec<ResourceEntry>,
    pub opportunities: Vec<PerfOpportunity>,
    pub last_run: String,
}

/* ==========================================================================
   VISUAL REGRESSION
   ======================================================================== */

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewportSpec {
    pub label: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BaselineStatus {
    Approved,
    Pending,
    Changed,
    New,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ChangeKind {
    None,
    Moved,
    Changed,
    Added,
    Removed,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VisualBaseline {
    pub id: String,
    pub name: String,
    pub target: String,
    pub viewport: ViewportSpec,
    pub branch: String,
    pub status: BaselineStatus,
    pub diff_percent: f64,
    pub pixels_changed: u32,
    pub change_kind: ChangeKind,
    pub baseline_src: String,
    pub actual_src: String,
    pub diff_src: String,
    pub mask_selectors: Vec<String>,
    pub threshold: f64,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub run_id: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewportCount {
    pub viewport: String,
    pub changed: u32,
    pub total: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VisualSummary {
    pub total: u32,
    pub changed: u32,
    pub pending: u32,
    pub approved: u32,
    pub by_viewport: Vec<ViewportCount>,
}

/* ==========================================================================
   API INTELLIGENCE
   ======================================================================== */

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum HttpMethod {
    #[serde(rename = "GET")]
    Get,
    #[serde(rename = "POST")]
    Post,
    #[serde(rename = "PUT")]
    Put,
    #[serde(rename = "PATCH")]
    Patch,
    #[serde(rename = "DELETE")]
    Delete,
    #[serde(rename = "HEAD")]
    Head,
    #[serde(rename = "OPTIONS")]
    Options,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SchemaDrift {
    Missing,
    Extra,
    TypeChanged,
    Nullability,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiSchemaField {
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub required: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub drift: Option<SchemaDrift>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub documented_type: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DiscoveredVia {
    Traffic,
    Openapi,
    Manual,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiIssue {
    pub id: String,
    pub detector: String,
    pub severity: Severity,
    pub summary: String,
    pub detail: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiEndpoint {
    pub id: String,
    pub method: HttpMethod,
    pub path: String,
    pub discovered_via: DiscoveredVia,
    pub auth_required: bool,
    pub observed_statuses: Vec<u16>,
    pub call_count: u32,
    pub p50_ms: u32,
    pub p95_ms: u32,
    pub error_rate: f64,
    pub request_schema: Vec<ApiSchemaField>,
    pub response_schema: Vec<ApiSchemaField>,
    pub issues: Vec<ApiIssue>,
    pub last_seen: String,
    pub tags: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiSummary {
    pub endpoints: u32,
    pub documented: u32,
    pub undocumented: u32,
    pub drift_count: u32,
    pub by_severity: SeverityCounts,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spec_source: Option<String>,
}

/* ==========================================================================
   SCRIPT LIBRARY
   ======================================================================== */

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ScriptKind {
    Test,
    Step,
    PageObject,
    Fixture,
    Api,
    Skill,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ParamType {
    String,
    Number,
    Boolean,
    Secret,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptParam {
    pub name: String,
    #[serde(rename = "type")]
    pub kind: ParamType,
    pub required: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ScriptLanguage {
    Typescript,
    Javascript,
    Python,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SourceKind {
    Generated,
    Recording,
    Extracted,
    Upload,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptVersion {
    pub version: u32,
    pub created_at: String,
    pub author: String,
    pub note: String,
    pub diff: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptEntry {
    pub id: String,
    pub name: String,
    pub kind: ScriptKind,
    pub language: ScriptLanguage,
    pub description: String,
    pub params: Vec<ScriptParam>,
    pub tags: Vec<String>,
    pub version: u32,
    pub usage_count: u32,
    pub code: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_ref: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_kind: Option<SourceKind>,
    pub versions: Vec<ScriptVersion>,
    pub updated_at: String,
}

/* ==========================================================================
   BROWSER / INSPECTOR
   ======================================================================== */

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PageId {
    Blank,
    Loading,
    Home,
    Login,
    Checkout,
    Confirm,
}

impl PageId {
    /// Db map key: the persisted JSON has to be keyed by a plain string.
    pub fn key(self) -> &'static str {
        match self {
            Self::Blank => "blank",
            Self::Loading => "loading",
            Self::Home => "home",
            Self::Login => "login",
            Self::Checkout => "checkout",
            Self::Confirm => "confirm",
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DomNode {
    pub tag: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attrs: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<DomNode>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct A11yNode {
    pub role: String,
    pub name: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkEntry {
    pub id: u32,
    pub method: String,
    pub url: String,
    pub status: u16,
    pub ms: u32,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub kind: Option<ResourceType>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_ms: Option<u32>,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConsoleLevel {
    Log,
    Warn,
    Error,
    Info,
    Debug,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsoleEntry {
    pub id: u32,
    pub level: ConsoleLevel,
    pub text: String,
    pub ts: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SelectorStrategy {
    Testid,
    Role,
    Label,
    Text,
    Css,
    Xpath,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectorCandidate {
    pub selector: String,
    pub strategy: SelectorStrategy,
    pub stability: u32,
    pub unique: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserTab {
    pub id: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Ripple {
    pub x: f64,
    pub y: f64,
    pub key: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TypingState {
    pub field: String,
    pub text: String,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ViewportKind {
    Desktop,
    Tablet,
    Mobile,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserState {
    pub url: String,
    pub title: String,
    pub page: PageId,
    pub overlay: Option<String>,
    pub cursor: Option<Point>,
    pub highlight: Option<String>,
    pub ripple: Option<Ripple>,
    pub typing: Option<TypingState>,
    pub inputs: HashMap<String, String>,
    pub tabs: Vec<BrowserTab>,
    pub active_tab: String,
    pub viewport: ViewportKind,
    pub takeover: bool,
    pub loading: bool,
}

/// `Partial<BrowserState>`. The nested `Option` is load-bearing: the outer level
/// means "field absent from the patch", the inner one carries an explicit
/// `null`, which is how the UI clears an overlay, cursor, ripple or highlight.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserPatch {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<PageId>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub overlay: Option<Option<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cursor: Option<Option<Point>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub highlight: Option<Option<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ripple: Option<Option<Ripple>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub typing: Option<Option<TypingState>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inputs: Option<HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tabs: Option<Vec<BrowserTab>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_tab: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub viewport: Option<ViewportKind>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub takeover: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub loading: Option<bool>,
}

/* ==========================================================================
   AGENT
   ======================================================================== */

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentStatus {
    Idle,
    Thinking,
    Planning,
    Executing,
    Waiting,
    Completed,
    Stopped,
    Error,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChatFrom {
    User,
    Agent,
    System,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CardKind {
    Plan,
    Tool,
    Approval,
    Stuck,
}

/// `PlanCard | ToolActivity | ApprovalRequest | StuckPrompt` — untagged, because
/// the TS union carries its discriminator in the sibling `cardKind` field.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ChatCard {
    Plan(PlanCard),
    Tool(ToolActivity),
    Approval(ApprovalRequest),
    Stuck(StuckPrompt),
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub id: u32,
    pub from: ChatFrom,
    pub text: String,
    pub ts: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub card: Option<ChatCard>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub card_kind: Option<CardKind>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StageState {
    Pending,
    Active,
    Done,
    Failed,
    Skipped,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanStage {
    pub id: String,
    pub label: String,
    pub state: StageState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanCard {
    pub id: String,
    pub goal: String,
    pub stages: Vec<PlanStage>,
    pub budget_tokens: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolActivity {
    pub id: String,
    pub tool: String,
    pub args_summary: String,
    pub result_summary: String,
    pub duration_ms: u32,
    pub ok: bool,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Risk {
    High,
    Medium,
    Low,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RememberScope {
    Step,
    Session,
    Project,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalRequest {
    pub id: String,
    pub title: String,
    pub desc: String,
    pub action: String,
    pub risk: Risk,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload_preview: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remember_scope: Option<RememberScope>,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum StuckChoice {
    Retry,
    Skip,
    TakeControl,
    ProvideSelector,
    Stop,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StuckPrompt {
    pub id: String,
    pub reason: String,
    pub choices: Vec<StuckChoice>,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TimelineKind {
    Plan,
    Navigate,
    Click,
    Type,
    Inspect,
    Assert,
    Approval,
    Network,
    Screenshot,
    Finding,
    Scan,
    Code,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StepStatus {
    Ok,
    Fail,
    Warn,
    Info,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineStep {
    pub id: u32,
    pub ts: String,
    pub kind: TimelineKind,
    pub label: String,
    pub detail: String,
    pub status: StepStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub screenshot_src: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finding_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u32>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DoneStatus {
    Completed,
    Stopped,
    Error,
}

/// The TS discriminated union, internally tagged on `type`.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AgentEvent {
    Status {
        status: AgentStatus,
        ts: String,
    },
    Message {
        message: ChatMessage,
    },
    Plan {
        plan: PlanCard,
    },
    Step {
        step: TimelineStep,
    },
    Browser {
        patch: BrowserPatch,
    },
    Network {
        entry: NetworkEntry,
    },
    Console {
        entry: ConsoleEntry,
    },
    Dom {
        page: PageId,
        tree: DomNode,
    },
    Approval {
        request: Option<ApprovalRequest>,
    },
    Stuck {
        prompt: Option<StuckPrompt>,
    },
    Tokens {
        total: u32,
    },
    Finding {
        finding: Finding,
    },
    Done {
        status: DoneStatus,
        summary: String,
    },
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentTaskInput {
    pub prompt: String,
    pub project_id: Option<String>,
    pub mode: Option<String>,
    pub budget_tokens: Option<u32>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentTaskHandle {
    pub task_id: String,
    pub started_at: String,
}

/* ==========================================================================
   DASHBOARD ROLLUP
   ======================================================================== */

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardSummary {
    pub open_findings: u32,
    pub critical_findings: u32,
    pub running_runs: u32,
    pub pending_approvals: u32,
    pub a11y_violations: u32,
    pub security_issues: u32,
    pub visual_diffs: u32,
    pub pass_rate: u32,
    pub total_tests: u32,
    pub avg_duration_ms: u32,
}
