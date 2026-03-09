import contractsIndex from './contracts.index.json' with { type: 'json' };
import intakeSchema from './schemas/intake.schema.json' with { type: 'json' };
import manifestSchema from './schemas/manifest.schema.json' with { type: 'json' };

export const SCHEMA_V1 = '1.0.0' as const;

export { contractsIndex, intakeSchema, manifestSchema };
