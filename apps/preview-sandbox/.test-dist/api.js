export async function simulatePreview(payload) {
    const response = await fetch('/preview/simulate', {
        method: 'POST',
        headers: {
            'content-type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Preview simulate failed with ${response.status}: ${body}`);
    }
    return (await response.json());
}
//# sourceMappingURL=api.js.map