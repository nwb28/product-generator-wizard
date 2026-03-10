export function isReviewerChecklistComplete(checklist) {
    return checklist.permissionsVerified && checklist.mappingsVerified && checklist.securityEvidenceVerified && checklist.testsVerified;
}
export function buildSignoffRecord(input) {
    return {
        reviewer: input.reviewer.trim(),
        completed: isReviewerChecklistComplete(input.checklist),
        recommendation: input.recommendation
    };
}
//# sourceMappingURL=reviewer.js.map