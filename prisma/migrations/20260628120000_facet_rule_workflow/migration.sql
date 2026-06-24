-- Facet rule workflow: draft → in_review → approved → deprecated
ALTER TABLE "FacetRule" ADD COLUMN "workflow_state_code" TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE "FacetRule" ADD COLUMN "created_by" TEXT;
ALTER TABLE "FacetRule" ADD COLUMN "updated_by" TEXT;
ALTER TABLE "FacetRule" ADD COLUMN "reviewed_by" TEXT;
ALTER TABLE "FacetRule" ADD COLUMN "reviewed_at" TIMESTAMP(3);
ALTER TABLE "FacetRule" ADD COLUMN "notes" TEXT;

CREATE INDEX "FacetRule_workflow_state_code_idx" ON "FacetRule"("workflow_state_code");
