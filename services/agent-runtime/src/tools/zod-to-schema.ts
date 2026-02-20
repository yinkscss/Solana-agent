import type { ZodObject, ZodRawShape, ZodTypeAny } from 'zod';

const zodTypeToJson = (schema: ZodTypeAny): Record<string, unknown> => {
  const def = schema._def;
  const typeName = def.typeName as string;

  if (typeName === 'ZodString') return { type: 'string' };
  if (typeName === 'ZodNumber') return { type: 'number' };
  if (typeName === 'ZodBoolean') return { type: 'boolean' };

  if (typeName === 'ZodOptional') {
    return zodTypeToJson(def.innerType as ZodTypeAny);
  }

  if (typeName === 'ZodDefault') {
    return zodTypeToJson(def.innerType as ZodTypeAny);
  }

  if (typeName === 'ZodEnum') {
    return { type: 'string', enum: def.values as string[] };
  }

  if (typeName === 'ZodArray') {
    return { type: 'array', items: zodTypeToJson(def.type as ZodTypeAny) };
  }

  if (typeName === 'ZodObject') {
    return zodToJsonSchema(schema as unknown as ZodObject<ZodRawShape>);
  }

  return { type: 'string' };
};

export const zodToJsonSchema = (schema: ZodObject<ZodRawShape>): Record<string, unknown> => {
  const shape = schema.shape;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const zodType = value as ZodTypeAny;
    properties[key] = zodTypeToJson(zodType);

    const isOptional = zodType._def.typeName === 'ZodOptional' || zodType._def.typeName === 'ZodDefault';
    if (!isOptional) {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 && { required }),
  };
};
