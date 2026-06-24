export { CatalogClient, createCatalogClient, type CatalogClientConfig, type SearchProductsParams } from "./catalog";

import type {
  AuditLogEntity,
  CategoryEntity,
  CategoryTreeNode,
  ChannelEntity,
  CompletenessReportEntity,
  DashboardReportEntity,
  EntityChangeHistoryEntity,
  ExportArtifactEntity,
  ImportJobEntity,
  ImportJobErrorEntity,
  ImportJobRowEntity,
  ImportReportEntity,
  OperationsReportEntity,
  OutboxEventEntity,
  ProductEntity,
  ProductMatchCandidateEntity,
  ProductSourceRecordDetailEntity,
  ProductSourceRecordEntity,
  ProductSystemIdEntity,
  PublishJobEntity,
  SurvivorshipRuleEntity,
  PublishReportEntity,
  WorkflowHistoryEntity,
  WorkflowReportEntity,
  WorkflowTaskEntity,
  WorkflowTransitionResult,
} from "@productinfoman/domain";

export type ApiClientConfig = {
  baseUrl: string;
  organizationSlug: string;
  accessToken?: string;
  userEmail?: string;
  actorRole?: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ZodIssueLike = { path?: Array<string | number>; message?: string };

function formatApiErrorMessage(body: unknown): string | null {
  if (!body) return null;
  if (typeof body === "object" && body !== null && "error" in body) {
    const error = (body as { error?: unknown }).error;
    if (typeof error === "string") return humanizeValidationMessage(error);
    if (Array.isArray(error)) return formatZodIssues(error as ZodIssueLike[]);
  }
  if (Array.isArray(body)) return formatZodIssues(body as ZodIssueLike[]);
  return null;
}

function formatZodIssues(issues: ZodIssueLike[]): string {
  return issues
    .map((issue) => {
      const field = issue.path?.length ? `${issue.path.join(".")}: ` : "";
      const detail =
        issue.message && issue.message !== "Invalid"
          ? issue.message
          : "value is invalid";
      return `${field}${detail}`;
    })
    .join("; ");
}

function humanizeValidationMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed.startsWith("[")) return message;
  try {
    const issues = JSON.parse(trimmed) as ZodIssueLike[];
    if (Array.isArray(issues) && issues.length > 0) {
      return formatZodIssues(issues);
    }
  } catch {
    // keep original message
  }
  return message;
}

export class ApiClient {
  constructor(private readonly config: ApiClientConfig) {}

  private headers(extra?: HeadersInit): HeadersInit {
    return {
      "Content-Type": "application/json",
      "X-Organization-Slug": this.config.organizationSlug,
      ...(this.config.accessToken ? { Authorization: `Bearer ${this.config.accessToken}` } : {}),
      ...(this.config.userEmail ? { "X-User-Email": this.config.userEmail } : {}),
      ...(this.config.actorRole ? { "X-Actor-Role": this.config.actorRole } : {}),
      ...extra,
    };
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers: this.headers(init?.headers),
    });

    if (!response.ok) {
      let message = response.statusText;
      try {
        const body = (await response.json()) as unknown;
        message = formatApiErrorMessage(body) ?? message;
      } catch {
        // ignore
      }
      if (response.status >= 500) {
        message = "Something went wrong. Please try again.";
      }
      throw new ApiError(message, response.status);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  // Products
  listProducts(query: Record<string, string | number | undefined> = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value != null && value !== "") params.set(key, String(value));
    }
    return this.request<{ items: ProductEntity[]; total: number; page: number; pageSize: number }>(
      `/api/v1/products?${params}`,
    );
  }

  getProduct(id: string) {
    return this.request<ProductEntity>(`/api/v1/products/${id}`);
  }

  createProduct(body: Record<string, unknown>) {
    return this.request<ProductEntity>("/api/v1/products", { method: "POST", body: JSON.stringify(body) });
  }

  updateProduct(id: string, body: Record<string, unknown>) {
    return this.request<ProductEntity>(`/api/v1/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  deleteProduct(id: string) {
    return this.request<void>(`/api/v1/products/${id}`, { method: "DELETE" });
  }

  setProductAttributes(id: string, attributes: Record<string, unknown>) {
    return this.request<ProductEntity>(`/api/v1/products/${id}/attributes`, {
      method: "PUT",
      body: JSON.stringify({ attributes }),
    });
  }

  listVariants(parentId: string) {
    return this.request<{ items: ProductEntity[] }>(`/api/v1/products/${parentId}/variants`);
  }

  getProductTree(id: string) {
    return this.request(`/api/v1/products/${id}/tree`);
  }

  // Taxonomy
  getCategoryTree() {
    return this.request<{ items: CategoryTreeNode[] }>("/api/v1/categories/tree");
  }

  listCategories() {
    return this.request<{ items: CategoryEntity[] }>("/api/v1/categories");
  }

  createCategory(body: Record<string, unknown>) {
    return this.request<CategoryEntity>("/api/v1/categories", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  updateCategory(id: string, body: Record<string, unknown>) {
    return this.request<CategoryEntity>(`/api/v1/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  listAttributes() {
    return this.request<{ items: Array<Record<string, unknown>> }>("/api/v1/attributes");
  }

  listAttributeGroups() {
    return this.request<{ items: Array<Record<string, unknown>> }>("/api/v1/attribute-groups");
  }

  createAttributeGroup(body: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/api/v1/attribute-groups", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  updateAttributeGroup(id: string, body: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`/api/v1/attribute-groups/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  createAttribute(body: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/api/v1/attributes", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  updateAttribute(id: string, body: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`/api/v1/attributes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  listFacetDefinitions(options: { categoryId?: string; includeInactive?: boolean } = {}) {
    const params = new URLSearchParams();
    if (options.categoryId) params.set("categoryId", options.categoryId);
    if (options.includeInactive) params.set("includeInactive", "true");
    const query = params.toString();
    return this.request<{ items: Array<Record<string, unknown>> }>(
      `/api/v1/facet-definitions${query ? `?${query}` : ""}`,
    );
  }

  createFacetDefinition(body: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/api/v1/facet-definitions", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  updateFacetDefinition(id: string, body: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`/api/v1/facet-definitions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  listFacetRules(query: Record<string, string> = {}) {
    const params = new URLSearchParams(query);
    return this.request<{ items: Array<Record<string, unknown>> }>(`/api/v1/facets/rules?${params}`);
  }

  createFacetRule(body: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/api/v1/facets/rules", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  updateFacetRule(id: string, body: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`/api/v1/facets/rules/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  submitFacetRule(id: string, body: Record<string, unknown> = {}) {
    return this.request<Record<string, unknown>>(`/api/v1/facets/rules/${id}/submit`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  approveFacetRule(id: string, body: Record<string, unknown> = {}) {
    return this.request<Record<string, unknown>>(`/api/v1/facets/rules/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  rejectFacetRule(id: string, body: Record<string, unknown> = {}) {
    return this.request<Record<string, unknown>>(`/api/v1/facets/rules/${id}/reject`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  deprecateFacetRule(id: string, body: Record<string, unknown> = {}) {
    return this.request<Record<string, unknown>>(`/api/v1/facets/rules/${id}/deprecate`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  cloneFacetRule(id: string) {
    return this.request<Record<string, unknown>>(`/api/v1/facets/rules/${id}/clone`, {
      method: "POST",
    });
  }

  // Imports
  listImports(query: Record<string, string | number | undefined> = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value != null) params.set(key, String(value));
    }
    return this.request<{ items: ImportJobEntity[]; total: number }>(`/api/v1/imports?${params}`);
  }

  getImport(id: string) {
    return this.request<ImportJobEntity & { summary: Record<string, unknown> | null }>(`/api/v1/imports/${id}`);
  }

  getImportErrors(id: string) {
    return this.request<{ items: ImportJobErrorEntity[] }>(`/api/v1/imports/${id}/errors`);
  }

  getImportRows(id: string, limit = 20) {
    return this.request<{ items: ImportJobRowEntity[] }>(`/api/v1/imports/${id}/rows?limit=${limit}`);
  }

  uploadImport(formData: FormData) {
    return this.request<ImportJobEntity>("/api/v1/imports/upload", {
      method: "POST",
      headers: {
        "X-Organization-Slug": this.config.organizationSlug,
        ...(this.config.accessToken ? { Authorization: `Bearer ${this.config.accessToken}` } : {}),
        ...(this.config.userEmail ? { "X-User-Email": this.config.userEmail } : {}),
        ...(this.config.actorRole ? { "X-Actor-Role": this.config.actorRole } : {}),
      },
      body: formData,
    });
  }

  validateImport(id: string) {
    return this.request<ImportJobEntity>(`/api/v1/imports/${id}/validate`, { method: "POST" });
  }

  startImport(id: string) {
    return this.request<ImportJobEntity>(`/api/v1/imports/${id}/start`, { method: "POST" });
  }

  // Workflow
  listWorkflowTasks(query: Record<string, string> = {}) {
    const params = new URLSearchParams(query);
    return this.request<{ items: WorkflowTaskEntity[] }>(`/api/v1/workflow/tasks?${params}`);
  }

  getWorkflowTask(id: string) {
    return this.request<WorkflowTaskEntity>(`/api/v1/workflow/tasks/${id}`);
  }

  getWorkflowHistory(productId: string) {
    return this.request<{ items: WorkflowHistoryEntity[] }>(`/api/v1/products/${productId}/workflow/history`);
  }

  submitProduct(productId: string, body: Record<string, unknown> = {}) {
    return this.request<WorkflowTransitionResult>(`/api/v1/products/${productId}/workflow/submit`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  approveProduct(productId: string, body: Record<string, unknown> = {}) {
    return this.request<WorkflowTransitionResult>(`/api/v1/products/${productId}/workflow/approve`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  rejectProduct(productId: string, body: Record<string, unknown>) {
    return this.request<WorkflowTransitionResult>(`/api/v1/products/${productId}/workflow/reject`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  publishProduct(productId: string, body: Record<string, unknown> = {}) {
    return this.request<WorkflowTransitionResult>(`/api/v1/products/${productId}/workflow/publish`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  // Publishing
  listChannels() {
    return this.request<{ items: ChannelEntity[] }>("/api/v1/channels");
  }

  listPublishJobs(query: Record<string, string | number | undefined> = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value != null) params.set(key, String(value));
    }
    return this.request<{ items: PublishJobEntity[]; total: number }>(`/api/v1/publish/jobs?${params}`);
  }

  getPublishJob(id: string) {
    return this.request<
      PublishJobEntity & {
        items: Array<Record<string, unknown>>;
        artifacts: ExportArtifactEntity[];
      }
    >(`/api/v1/publish/jobs/${id}`);
  }

  getChannelMappings(channelId: string) {
    return this.request<{ items: Array<Record<string, unknown>> }>(`/api/v1/channels/${channelId}/mappings`);
  }

  dryRunPublish(channelId: string, productIds?: string[]) {
    return this.request<PublishJobEntity>("/api/v1/publish/dry-run", {
      method: "POST",
      body: JSON.stringify({ channelId, productIds }),
    });
  }

  runPublish(channelId: string, productIds?: string[]) {
    return this.request<PublishJobEntity>("/api/v1/publish/run", {
      method: "POST",
      body: JSON.stringify({ channelId, productIds }),
    });
  }

  retryPublishJob(id: string) {
    return this.request<PublishJobEntity>(`/api/v1/publish/jobs/${id}/retry`, { method: "POST" });
  }

  getPublishArtifactUrl(id: string) {
    return `${this.config.baseUrl}/api/v1/publish/jobs/${id}/artifact`;
  }

  // Audit & Reports
  listAudit(query: Record<string, string | number | undefined> = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value != null && value !== "") params.set(key, String(value));
    }
    return this.request<{ items: AuditLogEntity[]; total: number }>(`/api/v1/audit?${params}`);
  }

  getAuditLog(id: string) {
    return this.request<AuditLogEntity>(`/api/v1/audit/${id}`);
  }

  getReportsSummary() {
    return this.request<OperationsReportEntity>("/api/v1/reports/summary");
  }

  getReportsDashboard(query: Record<string, string | undefined> = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    return this.request<DashboardReportEntity>(`/api/v1/reports/dashboard?${params}`);
  }

  getReportsCompleteness(query: Record<string, string | undefined> = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    return this.request<CompletenessReportEntity>(`/api/v1/reports/completeness?${params}`);
  }

  getReportsWorkflow(query: Record<string, string | undefined> = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    return this.request<WorkflowReportEntity>(`/api/v1/reports/workflow?${params}`);
  }

  getReportsImports(query: Record<string, string | undefined> = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    return this.request<ImportReportEntity>(`/api/v1/reports/imports?${params}`);
  }

  getReportsPublishes(query: Record<string, string | undefined> = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    return this.request<PublishReportEntity>(`/api/v1/reports/publishes?${params}`);
  }

  getEntityHistory(entityType: string, entityId: string) {
    return this.request<{ items: EntityChangeHistoryEntity[] }>(
      `/api/v1/entities/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}/history`,
    );
  }

  listOutboxEvents(query: Record<string, string | number | undefined> = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value != null) params.set(key, String(value));
    }
    return this.request<{ items: OutboxEventEntity[]; total: number }>(`/api/v1/events/outbox?${params}`);
  }

  // Product MDM
  listProductSystemIds(productId: string) {
    return this.request<{ items: ProductSystemIdEntity[] }>(`/api/v1/mdm/products/${productId}/systems`);
  }

  upsertProductSystemId(productId: string, body: Record<string, unknown>) {
    return this.request<ProductSystemIdEntity>(`/api/v1/mdm/products/${productId}/systems`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  listMdmSourceRecords(query: Record<string, string | number | undefined> = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value != null && value !== "") params.set(key, String(value));
    }
    return this.request<{ items: ProductSourceRecordEntity[]; total: number; page: number; pageSize: number }>(
      `/api/v1/mdm/source-records?${params}`,
    );
  }

  getMdmSourceRecord(id: string) {
    return this.request<ProductSourceRecordDetailEntity>(`/api/v1/mdm/source-records/${id}`);
  }

  resolveMdmMatch(id: string, body: Record<string, unknown>) {
    return this.request<ProductSourceRecordEntity>(`/api/v1/mdm/source-records/${id}/match`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  listSurvivorshipRules() {
    return this.request<{ items: SurvivorshipRuleEntity[] }>("/api/v1/mdm/survivorship-rules");
  }

  createSurvivorshipRule(body: Record<string, unknown>) {
    return this.request<SurvivorshipRuleEntity>("/api/v1/mdm/survivorship-rules", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  inboundMdmProduct(body: Record<string, unknown>) {
    return this.request<{ sourceRecord: ProductSourceRecordEntity; productId: string | null }>(
      "/api/v1/mdm/products/inbound",
      { method: "POST", body: JSON.stringify(body) },
    );
  }

  health() {
    return this.request<{ status: string }>("/health");
  }

  listUsers() {
    return this.request<{ items: Array<Record<string, unknown>> }>("/api/v1/users");
  }

  createUser(body: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/api/v1/users", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  updateUserRoles(userId: string, roleCodes: string[]) {
    return this.request<Record<string, unknown>>(`/api/v1/users/${userId}/roles`, {
      method: "PUT",
      body: JSON.stringify({ roleCodes }),
    });
  }

  unlockUser(userId: string) {
    return this.request<{ id: string; unlocked: boolean }>(`/api/v1/users/${userId}/unlock`, {
      method: "POST",
    });
  }

  getSecurityPolicy() {
    return this.request<Record<string, unknown>>("/api/v1/auth/security-policy");
  }

  listSecurityAudit(query: Record<string, string | number | undefined> = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value != null && value !== "") params.set(key, String(value));
    }
    return this.request<{ items: Array<Record<string, unknown>>; total: number }>(
      `/api/v1/audit/security?${params}`,
    );
  }
}

export function createApiClient(config: ApiClientConfig) {
  return new ApiClient(config);
}
