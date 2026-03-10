import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--policy") {
      args.policy = argv[index + 1];
      index += 1;
    } else if (token === "--events") {
      args.events = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

function getPathValue(record, dottedPath) {
  const parts = dottedPath.split(".");
  let current = record;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return current;
}

export function validateAuditEventSchema({ policy, events }) {
  const errors = [];
  const requiredFields = policy.requiredFields ?? [];
  const allowedEventTypes = new Set(policy.allowedEventTypes ?? []);

  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    for (const field of requiredFields) {
      const value = getPathValue(event, field);
      if (value === undefined || value === null || value === "") {
        errors.push(`Event[${i}] missing required field '${field}'.`);
      }
    }

    if (event.schemaVersion !== policy.schemaVersion) {
      errors.push(`Event[${i}] schemaVersion '${event.schemaVersion}' does not match '${policy.schemaVersion}'.`);
    }

    if (!allowedEventTypes.has(event.eventType)) {
      errors.push(`Event[${i}] eventType '${event.eventType}' is not allowed.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const policyPath = path.resolve(process.cwd(), args.policy ?? "config/audit-event-policy.json");
  const eventsPath = path.resolve(process.cwd(), args.events ?? "fixtures/audit/events.sample.json");
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
  const events = JSON.parse(fs.readFileSync(eventsPath, "utf8"));

  const result = validateAuditEventSchema({ policy, events });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
