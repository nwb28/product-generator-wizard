export type WizardPrefill = {
  productType?: string;
  connectionType?: string;
  tenant?: string;
};

export function parsePrefill(search: string): WizardPrefill {
  const params = new URLSearchParams(search);
  const prefill: WizardPrefill = {};

  const productType = params.get('productType');
  if (productType) {
    prefill.productType = productType;
  }

  const connectionType = params.get('connectionType');
  if (connectionType) {
    prefill.connectionType = connectionType;
  }

  const tenant = params.get('tenant');
  if (tenant) {
    prefill.tenant = tenant;
  }

  return prefill;
}

export function applyPrefill(baseIntake: unknown, prefill: WizardPrefill): unknown {
  const intake = (baseIntake && typeof baseIntake === 'object' ? structuredClone(baseIntake) : {}) as Record<string, unknown>;

  const product = ((intake.product as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
  if (prefill.productType) {
    product.productType = prefill.productType;
  }
  if (prefill.tenant) {
    product.tenant = prefill.tenant;
  }
  intake.product = product;

  const controlPlane = ((intake.controlPlane as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
  if (prefill.connectionType) {
    controlPlane.connectionType = prefill.connectionType;
  }
  intake.controlPlane = controlPlane;

  return intake;
}
