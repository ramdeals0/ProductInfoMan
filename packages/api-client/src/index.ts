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
        const body = (await response.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        // ignore
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

  listAttributes() {
    return this.request<{ items: Array<Record<string, unknown>> }>("/api/v1/attributes");
  }

  listAttributeGroups() {
    return this.request<{ items: Array<Record<string, unknown>> }>("/api/v1/attribute-groups");
  }

  listFacetDefinitions(categoryId?: string) {
    const params = categoryId ? `?categoryId=${categoryId}` : "";
    return this.request<{ items: Array<Record<string, unknown>> }>(`/api/v1/facet-definitions${params}`);
  }

  listFacetRules(query: Record<string, string> = {}) {
    const params = new URLSearchParams(query);
    return this.request<{ items: Array<Record<string, unknown>> }>(`/api/v1/facet-rules?${params}`);
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
}

export function createApiClient(config: ApiClientConfig) {
  return new ApiClient(config);
}
