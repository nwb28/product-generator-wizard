export type ReviewerChecklist = {
  permissionsVerified: boolean;
  mappingsVerified: boolean;
  securityEvidenceVerified: boolean;
  testsVerified: boolean;
};

export function isReviewerChecklistComplete(checklist: ReviewerChecklist): boolean {
  return checklist.permissionsVerified && checklist.mappingsVerified && checklist.securityEvidenceVerified && checklist.testsVerified;
}

export function buildSignoffRecord(input: {
  reviewer: string;
  checklist: ReviewerChecklist;
  recommendation: 'Go' | 'No-Go';
}): { reviewer: string; completed: boolean; recommendation: 'Go' | 'No-Go' } {
  return {
    reviewer: input.reviewer.trim(),
    completed: isReviewerChecklistComplete(input.checklist),
    recommendation: input.recommendation
  };
}
