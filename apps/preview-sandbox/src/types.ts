export type TenantContext = {
  tenantId: string;
  principalSub: string;
};

export type PreviewSessionStatus = 'new' | 'validated' | 'simulated' | 'reported';

export type PreviewSession = {
  id: string;
  productId: string;
  adapterId: string;
  adapterVersion: string;
  status: PreviewSessionStatus;
  createdAt: string;
  updatedAt: string;
};
