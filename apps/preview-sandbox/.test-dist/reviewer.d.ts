export type ReviewerChecklist = {
    permissionsVerified: boolean;
    mappingsVerified: boolean;
    securityEvidenceVerified: boolean;
    testsVerified: boolean;
};
export declare function isReviewerChecklistComplete(checklist: ReviewerChecklist): boolean;
export declare function buildSignoffRecord(input: {
    reviewer: string;
    checklist: ReviewerChecklist;
    recommendation: 'Go' | 'No-Go';
}): {
    reviewer: string;
    completed: boolean;
    recommendation: 'Go' | 'No-Go';
};
