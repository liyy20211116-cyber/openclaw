import workflowTemplateConfig from '../../../config/workflow-templates.json'
import type {
  DeliveryWorkflowRun,
  DeliveryWorkflowStep,
  SalesLead,
  WorkflowContextType,
  WorkflowProgress,
  WorkflowRunStatus,
  WorkflowStepRunStatus,
  WorkflowTemplate,
} from '../types'
import { localPersistenceService, localStateKeys } from './localPersistenceService'
import { offerCatalogService } from './offerCatalogService'

type WorkflowTemplateFile = {
  templates: WorkflowTemplate[]
}

type WorkflowContext = {
  contextType: WorkflowContextType
  contextId: string
}

const templateData = workflowTemplateConfig as WorkflowTemplateFile
const DEFAULT_WORKFLOW_ID = 'wf_ai_automation_diagnosis'

let localRuns: DeliveryWorkflowRun[] = localPersistenceService.getOrSeed(localStateKeys.workflowRuns, [] as DeliveryWorkflowRun[])
let localSteps: DeliveryWorkflowStep[] = localPersistenceService.getOrSeed(localStateKeys.workflowSteps, [] as DeliveryWorkflowStep[])

function persistWorkflowState() {
  localPersistenceService.setItem(localStateKeys.workflowRuns, localRuns)
  localPersistenceService.setItem(localStateKeys.workflowSteps, localSteps)
}

function refreshWorkflowState() {
  localRuns = localPersistenceService.getOrSeed(localStateKeys.workflowRuns, [] as DeliveryWorkflowRun[])
  localSteps = localPersistenceService.getOrSeed(localStateKeys.workflowSteps, [] as DeliveryWorkflowStep[])
}

function nowDate() {
  return new Date().toISOString().slice(0, 10)
}

function generateRunId(templateId: string, context: WorkflowContext) {
  return `wfr_${templateId}_${context.contextType}_${context.contextId}`.replace(/[^a-zA-Z0-9_]+/g, '_')
}

export function listWorkflowTemplates(): WorkflowTemplate[] {
  return [...templateData.templates]
}

export function getWorkflowTemplateById(templateId: string): WorkflowTemplate | undefined {
  return templateData.templates.find(template => template.id === templateId)
}

export function listWorkflowRuns(): DeliveryWorkflowRun[] {
  refreshWorkflowState()
  return [...localRuns]
}

export function getWorkflowRunById(runId: string): DeliveryWorkflowRun | undefined {
  refreshWorkflowState()
  return localRuns.find(run => run.id === runId)
}

export function listWorkflowSteps(runId: string): DeliveryWorkflowStep[] {
  refreshWorkflowState()
  return localSteps.filter(step => step.runId === runId)
}

export function createWorkflowRun(templateId: string, context: WorkflowContext): { run: DeliveryWorkflowRun; steps: DeliveryWorkflowStep[]; created: boolean; message: string } {
  refreshWorkflowState()
  const template = getWorkflowTemplateById(templateId) ?? getWorkflowTemplateById(DEFAULT_WORKFLOW_ID)
  if (!template) {
    throw new Error(`Workflow template not found: ${templateId}`)
  }

  const existing = localRuns.find(run => run.contextType === context.contextType && run.contextId === context.contextId)
  if (existing) {
    return {
      run: existing,
      steps: listWorkflowSteps(existing.id),
      created: false,
      message: '该上下文已创建过交付工作流，未重复创建',
    }
  }

  const createdAt = nowDate()
  const run: DeliveryWorkflowRun = {
    id: generateRunId(template.id, context),
    templateId: template.id,
    name: template.name,
    status: 'pending',
    contextType: context.contextType,
    contextId: context.contextId,
    currentStepId: template.steps[0]?.id ?? '',
    createdAt,
    updatedAt: createdAt,
  }

  const steps = template.steps.map((step): DeliveryWorkflowStep => ({
    id: `${run.id}_${step.id}`,
    runId: run.id,
    templateStepId: step.id,
    label: step.label,
    agentId: step.agentId,
    skillId: step.skillId,
    description: step.description,
    status: 'pending',
    requiresApproval: step.requiresApproval,
    expectedOutput: step.expectedOutput,
    outputSummary: '',
    createdAt,
    updatedAt: createdAt,
  }))

  localRuns = [run, ...localRuns]
  localSteps = [...steps, ...localSteps]
  persistWorkflowState()
  return { run, steps, created: true, message: '已创建交付工作流' }
}

export function updateWorkflowRunStatus(runId: string, status: WorkflowRunStatus): DeliveryWorkflowRun | undefined {
  refreshWorkflowState()
  let updated: DeliveryWorkflowRun | undefined
  localRuns = localRuns.map(run => {
    if (run.id !== runId) return run
    updated = { ...run, status, updatedAt: nowDate() }
    return updated
  })
  if (updated) persistWorkflowState()
  return updated
}

export function updateWorkflowStepStatus(stepId: string, status: WorkflowStepRunStatus): DeliveryWorkflowStep | undefined {
  refreshWorkflowState()
  let updatedStep: DeliveryWorkflowStep | undefined
  localSteps = localSteps.map(step => {
    if (step.id !== stepId) return step
    updatedStep = {
      ...step,
      status,
      outputSummary: status === 'completed' ? step.outputSummary || `${step.expectedOutput} 已完成（本地模拟）` : step.outputSummary,
      updatedAt: nowDate(),
    }
    return updatedStep
  })

  if (updatedStep) {
    const runSteps = localSteps.filter(step => step.runId === updatedStep?.runId)
    const waitingApproval = runSteps.some(step => step.status === 'waiting_approval')
    const hasFailure = runSteps.some(step => step.status === 'failed')
    const allCompleted = runSteps.length > 0 && runSteps.every(step => step.status === 'completed' || step.status === 'skipped')
    const nextPending = runSteps.find(step => step.status === 'pending' || step.status === 'running' || step.status === 'waiting_approval')
    const nextStatus: WorkflowRunStatus = hasFailure
      ? 'failed'
      : waitingApproval
        ? 'waiting_approval'
        : allCompleted
          ? 'completed'
          : runSteps.some(step => step.status === 'running')
            ? 'running'
            : 'pending'

    localRuns = localRuns.map(run => run.id === updatedStep?.runId
      ? { ...run, status: nextStatus, currentStepId: nextPending?.templateStepId ?? '', updatedAt: nowDate() }
      : run)
  }

  if (updatedStep) persistWorkflowState()
  return updatedStep
}

export function getRecommendedWorkflowForSalesLead(lead: SalesLead): WorkflowTemplate | undefined {
  const offer = offerCatalogService.getOfferById(lead.recommendedOfferId)
  const workflowId = offer?.deliveryWorkflowId ?? DEFAULT_WORKFLOW_ID
  return getWorkflowTemplateById(workflowId) ?? getWorkflowTemplateById(DEFAULT_WORKFLOW_ID)
}

export function getWorkflowProgress(runId: string): WorkflowProgress {
  const steps = listWorkflowSteps(runId)
  const totalSteps = steps.length
  const completedSteps = steps.filter(step => step.status === 'completed' || step.status === 'skipped').length
  return {
    totalSteps,
    completedSteps,
    waitingApproval: steps.some(step => step.status === 'waiting_approval'),
    hasFailure: steps.some(step => step.status === 'failed'),
    percentComplete: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
  }
}

export function resetWorkflowMockStateForTest() {
  clearWorkflowRuns()
}

export function clearWorkflowRuns() {
  localRuns = []
  localSteps = []
  persistWorkflowState()
}

export function resetWorkflowStateToSeed() {
  clearWorkflowRuns()
}

export function exportWorkflowState(): { runs: DeliveryWorkflowRun[]; steps: DeliveryWorkflowStep[] } {
  refreshWorkflowState()
  return { runs: [...localRuns], steps: [...localSteps] }
}

export const workflowService = {
  listWorkflowTemplates,
  getWorkflowTemplateById,
  listWorkflowRuns,
  getWorkflowRunById,
  listWorkflowSteps,
  createWorkflowRun,
  updateWorkflowRunStatus,
  updateWorkflowStepStatus,
  getRecommendedWorkflowForSalesLead,
  getWorkflowProgress,
  resetWorkflowMockStateForTest,
  clearWorkflowRuns,
  resetWorkflowStateToSeed,
  exportWorkflowState,
}
